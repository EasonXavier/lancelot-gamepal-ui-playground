import { describe, expect, it, vi } from 'vitest';

import { FrameSampler } from '../../src/performance/frameSampler';
import {
  PerformanceObserverRegistry,
  detectPerformanceCapabilities,
  type PerformanceObserverAdapter,
} from '../../src/performance/mainThreadMetrics';
import { createPerformanceRuntime } from '../../src/performance/runtime';
import {
  WebVitalsStore,
  type WebVitalReport,
  type WebVitalsModule,
} from '../../src/performance/webVitals';

function createVitals(capabilities: ReturnType<typeof detectPerformanceCapabilities>) {
  const module: WebVitalsModule = {
    onTTFB: () => undefined,
    onFCP: () => undefined,
    onLCP: () => undefined,
    onCLS: () => undefined,
    onINP: () => undefined,
  };
  return new WebVitalsStore(capabilities, async () => module);
}

function createRegistry() {
  const observers: Array<{
    adapter: PerformanceObserverAdapter;
    emit: (entries: readonly PerformanceEntry[]) => void;
    type: string;
  }> = [];
  const registry = new PerformanceObserverRegistry((emit) => {
    const record: {
      adapter: PerformanceObserverAdapter;
      emit: (entries: readonly PerformanceEntry[]) => void;
      type: string;
    } = {
      adapter: undefined as unknown as PerformanceObserverAdapter,
      emit,
      type: '',
    };
    const adapter: PerformanceObserverAdapter = {
      observe: vi.fn((options: { type: string }) => {
        record.type = options.type;
      }),
      disconnect: vi.fn(),
    };
    record.adapter = adapter;
    observers.push(record);
    return adapter;
  });
  return { observers, registry };
}

function observerFor(
  observers: ReturnType<typeof createRegistry>['observers'],
  type: string,
) {
  const observer = observers.find((candidate) => candidate.type === type);
  if (!observer) {
    throw new Error(`Expected ${type} observer`);
  }
  return observer;
}

describe('PerformanceRuntime', () => {
  it('catches publishing every observer callback by emitting at most once in 250ms', async () => {
    vi.useFakeTimers();
    const capabilities = detectPerformanceCapabilities(['longtask']);
    const { observers, registry } = createRegistry();
    const runtime = createPerformanceRuntime({
      capabilities,
      registry,
      webVitals: createVitals(capabilities),
    });
    const listener = vi.fn();
    runtime.subscribe(listener);

    await runtime.start();
    observers[0]?.emit([{ duration: 57 } as PerformanceEntry]);
    observers[0]?.emit([{ duration: 91 } as PerformanceEntry]);

    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(249);
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot().mainThread.longTasks).toEqual({
      status: 'available',
      value: { count: 2, totalDuration: 148, maxDuration: 91 },
    });
    runtime.stop();
    vi.useRealTimers();
  });

  it('catches duplicate startup, broken visibility delegation, and StrictMode cleanup leaks', async () => {
    const capabilities = detectPerformanceCapabilities(['longtask']);
    const { observers, registry } = createRegistry();
    const sampler = new FrameSampler({
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
    });
    const start = vi.spyOn(sampler, 'start');
    const pause = vi.spyOn(sampler, 'pause');
    const resume = vi.spyOn(sampler, 'resume');
    const stop = vi.spyOn(sampler, 'stop');
    const runtime = createPerformanceRuntime({
      capabilities,
      frameSampler: sampler,
      registry,
      webVitals: createVitals(capabilities),
    });

    await runtime.start();
    await runtime.start();
    runtime.pause();
    runtime.resume();
    runtime.stop();
    runtime.stop();
    await runtime.start();
    runtime.stop();

    expect(start).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledTimes(2);
    expect(observers.length).toBeGreaterThan(0);
    observers.forEach(({ adapter }) => {
      expect(adapter.disconnect).toHaveBeenCalledOnce();
    });
  });

  it('catches reset retaining live frame and observer metrics', async () => {
    const capabilities = detectPerformanceCapabilities(['longtask']);
    const { observers, registry } = createRegistry();
    let frame: FrameRequestCallback | undefined;
    const sampler = new FrameSampler({
      requestFrame: (callback) => {
        frame = callback;
        return 1;
      },
      cancelFrame: () => undefined,
    });
    const runtime = createPerformanceRuntime({
      capabilities,
      frameSampler: sampler,
      registry,
      webVitals: createVitals(capabilities),
    });

    await runtime.start();
    frame?.(0);
    frame?.(16);
    observers[0]?.emit([{ duration: 72 } as PerformanceEntry]);
    runtime.reset();

    expect(runtime.getSnapshot().frames.intervals).toEqual([]);
    expect(runtime.getSnapshot().mainThread.longTasks).toEqual({
      status: 'available',
      value: { count: 0, totalDuration: 0, maxDuration: 0 },
    });
    runtime.stop();
  });

  it('catches buffered observer history being appended across visibility and StrictMode replay', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('PerformanceObserver', {
      supportedEntryTypes: [
        'longtask',
        'long-animation-frame',
        'navigation',
        'resource',
      ],
    });
    const capabilities = detectPerformanceCapabilities([
      'longtask',
      'long-animation-frame',
      'navigation',
    ]);
    const { observers, registry } = createRegistry();
    const resourceHistory = vi.fn(() => [
      {
        duration: 8,
        transferSize: 100,
        decodedBodySize: 200,
      } as unknown as PerformanceEntry,
    ]);
    const runtime = createPerformanceRuntime({
      capabilities,
      getEntriesByType: resourceHistory,
      registry,
      webVitals: createVitals(capabilities),
    });

    await runtime.start();
    observerFor(observers, 'longtask').emit([{ duration: 50 } as PerformanceEntry]);
    observerFor(observers, 'long-animation-frame').emit([
      { duration: 60 } as PerformanceEntry,
    ]);
    observerFor(observers, 'navigation').emit([
      {
        startTime: 0,
        requestStart: 4,
        responseStart: 12,
        domInteractive: 20,
        loadEventEnd: 30,
      } as unknown as PerformanceEntry,
    ]);
    observerFor(observers, 'resource').emit([
      {
        duration: 8,
        transferSize: 100,
        decodedBodySize: 200,
      } as unknown as PerformanceEntry,
    ]);
    await vi.advanceTimersByTimeAsync(250);

    expect(runtime.getSnapshot().mainThread.longTasks).toEqual({
      status: 'available',
      value: { count: 1, totalDuration: 50, maxDuration: 50 },
    });
    expect(runtime.getSnapshot().resources.resourceCount).toBe(1);
    const observerCountBeforeVisibilityReplay = observers.length;
    runtime.pause();
    runtime.resume();
    expect(observers).toHaveLength(observerCountBeforeVisibilityReplay);

    runtime.stop();
    await runtime.start();
    observerFor(observers.slice(observerCountBeforeVisibilityReplay), 'longtask').emit([
      { duration: 50 } as PerformanceEntry,
    ]);
    observerFor(
      observers.slice(observerCountBeforeVisibilityReplay),
      'long-animation-frame',
    ).emit([{ duration: 60 } as PerformanceEntry]);
    observerFor(observers.slice(observerCountBeforeVisibilityReplay), 'resource').emit([
      {
        duration: 8,
        transferSize: 100,
        decodedBodySize: 200,
      } as unknown as PerformanceEntry,
    ]);
    await vi.advanceTimersByTimeAsync(250);

    expect(runtime.getSnapshot().mainThread.longTasks).toEqual({
      status: 'available',
      value: { count: 1, totalDuration: 50, maxDuration: 50 },
    });
    expect(runtime.getSnapshot().resources.resourceCount).toBe(1);
    expect(resourceHistory).not.toHaveBeenCalled();
    runtime.stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('catches pending publications or late callbacks escaping pause and stop', async () => {
    vi.useFakeTimers();
    const capabilities = detectPerformanceCapabilities(['longtask']);
    const { observers, registry } = createRegistry();
    const runtime = createPerformanceRuntime({
      capabilities,
      registry,
      webVitals: createVitals(capabilities),
    });
    const listener = vi.fn();
    runtime.subscribe(listener);

    await runtime.start();
    observerFor(observers, 'longtask').emit([{ duration: 40 } as PerformanceEntry]);
    runtime.pause();
    await vi.advanceTimersByTimeAsync(250);
    expect(listener).not.toHaveBeenCalled();

    runtime.resume();
    observerFor(observers, 'longtask').emit([{ duration: 50 } as PerformanceEntry]);
    runtime.stop();
    observerFor(observers, 'longtask').emit([{ duration: 90 } as PerformanceEntry]);
    await runtime.start();
    observerFor(observers.slice(1), 'longtask').emit([
      { duration: 55 } as PerformanceEntry,
    ]);
    await vi.advanceTimersByTimeAsync(250);

    expect(listener).toHaveBeenCalledOnce();
    expect(runtime.getSnapshot().mainThread.longTasks).toEqual({
      status: 'available',
      value: { count: 1, totalDuration: 55, maxDuration: 55 },
    });
    runtime.stop();
    vi.useRealTimers();
  });

  it('catches snapshots mutating between publications or notifying with a stale reference', async () => {
    vi.useFakeTimers();
    const capabilities = detectPerformanceCapabilities(['longtask']);
    const { observers, registry } = createRegistry();
    const runtime = createPerformanceRuntime({
      capabilities,
      registry,
      webVitals: createVitals(capabilities),
    });
    const beforeStart = runtime.getSnapshot();
    expect(Object.is(beforeStart, runtime.getSnapshot())).toBe(true);
    await runtime.start();
    const beforePublication = runtime.getSnapshot();
    const listener = vi.fn(() => runtime.getSnapshot());
    runtime.subscribe(listener);
    observerFor(observers, 'longtask').emit([{ duration: 45 } as PerformanceEntry]);

    expect(Object.is(beforePublication, runtime.getSnapshot())).toBe(true);
    await vi.advanceTimersByTimeAsync(250);

    expect(listener).toHaveBeenCalledOnce();
    const published = listener.mock.results[0]?.value;
    expect(Object.is(beforePublication, published)).toBe(false);
    expect(published.mainThread.longTasks).toEqual({
      status: 'available',
      value: { count: 1, totalDuration: 45, maxDuration: 45 },
    });
    runtime.stop();
    vi.useRealTimers();
  });

  it('catches reset leaving web vitals, navigation, or resources live', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('PerformanceObserver', {
      supportedEntryTypes: ['navigation', 'resource'],
    });
    const callbacks = new Map<string, (metric: WebVitalReport) => void>();
    const register = (name: string) => (callback: (metric: WebVitalReport) => void) => {
      callbacks.set(name, callback);
    };
    const capabilities = detectPerformanceCapabilities([
      'navigation',
      'largest-contentful-paint',
    ]);
    const module: WebVitalsModule = {
      onTTFB: register('TTFB'),
      onFCP: register('FCP'),
      onLCP: register('LCP'),
      onCLS: register('CLS'),
      onINP: register('INP'),
    };
    const { observers, registry } = createRegistry();
    const runtime = createPerformanceRuntime({
      capabilities,
      registry,
      webVitals: new WebVitalsStore(capabilities, async () => module),
    });

    await runtime.start();
    observerFor(observers, 'navigation').emit([
      {
        startTime: 0,
        requestStart: 2,
        responseStart: 8,
        domInteractive: 14,
        loadEventEnd: 20,
      } as unknown as PerformanceEntry,
    ]);
    observerFor(observers, 'resource').emit([
      {
        duration: 6,
        transferSize: 100,
        decodedBodySize: 200,
      } as unknown as PerformanceEntry,
    ]);
    callbacks.get('LCP')?.({
      name: 'LCP',
      value: 900,
      delta: 900,
      rating: 'good',
      id: 'lcp-reset',
    });
    await vi.advanceTimersByTimeAsync(250);
    runtime.reset();

    expect(runtime.getSnapshot().webVitals.lcp).toEqual({ status: 'waiting' });
    expect(runtime.getSnapshot().navigation).toEqual({ status: 'waiting' });
    expect(runtime.getSnapshot().resources).toEqual({
      resourceCount: 0,
      totalDuration: 0,
      transferSize: { status: 'waiting' },
      decodedBodySize: { status: 'waiting' },
    });
    runtime.stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('WebVitalsStore lifecycle', () => {
  it('catches a stopped loaded store ignoring reports after StrictMode reactivation', async () => {
    const callbacks = new Map<string, (metric: WebVitalReport) => void>();
    const register = (name: string) => (callback: (metric: WebVitalReport) => void) => {
      callbacks.set(name, callback);
    };
    const module: WebVitalsModule = {
      onTTFB: register('TTFB'),
      onFCP: register('FCP'),
      onLCP: register('LCP'),
      onCLS: register('CLS'),
      onINP: register('INP'),
    };
    const capabilities = detectPerformanceCapabilities(['event']);
    const store = new WebVitalsStore(capabilities, async () => module);

    await store.start();
    store.stop();
    await store.start();
    callbacks.get('INP')?.({
      name: 'INP',
      value: 120,
      delta: 120,
      rating: 'good',
      id: 'inp-replay',
    });

    expect(store.getSnapshot().inp).toEqual({
      status: 'available',
      value: {
        value: 120,
        delta: 120,
        rating: 'good',
        id: 'inp-replay',
      },
    });
  });
});
