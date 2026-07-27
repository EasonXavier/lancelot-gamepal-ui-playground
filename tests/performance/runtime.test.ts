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
  }> = [];
  const registry = new PerformanceObserverRegistry((emit) => {
    const adapter: PerformanceObserverAdapter = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    observers.push({ adapter, emit });
    return adapter;
  });
  return { observers, registry };
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
