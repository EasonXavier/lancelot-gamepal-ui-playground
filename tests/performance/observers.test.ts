import { describe, expect, it, vi } from 'vitest';

import {
  PerformanceObserverRegistry,
  detectPerformanceCapabilities,
  summarizeMainThreadEntries,
  type PerformanceObserverAdapter,
} from '../../src/performance/mainThreadMetrics';
import { summarizeNavigationTiming } from '../../src/performance/navigationMetrics';
import { summarizeResourceEntries } from '../../src/performance/resourceMetrics';
import {
  WebVitalsStore,
  createInitialWebVitalsSnapshot,
  type WebVitalReport,
  type WebVitalsModule,
} from '../../src/performance/webVitals';

describe('performance capability states', () => {
  it('marks unsupported observer entry types explicitly', () => {
    const capabilities = detectPerformanceCapabilities([]);

    expect(capabilities.navigation).toEqual({ status: 'unsupported' });
    expect(capabilities.largestContentfulPaint).toEqual({
      status: 'unsupported',
    });
    expect(capabilities.longTask).toEqual({ status: 'unsupported' });
    expect(capabilities.longAnimationFrame).toEqual({
      status: 'unsupported',
    });
  });

  it('keeps INP waiting until the first interaction is reported', () => {
    const capabilities = detectPerformanceCapabilities(['event']);

    expect(createInitialWebVitalsSnapshot(capabilities).inp).toEqual({
      status: 'waiting',
    });
  });
});

describe('PerformanceObserverRegistry', () => {
  it('shares one observer per entry type and disconnects after the last cleanup', () => {
    const adapters: Array<{
      adapter: PerformanceObserverAdapter;
      emit: (entries: readonly PerformanceEntry[]) => void;
    }> = [];
    const factory = vi.fn((emit: (entries: readonly PerformanceEntry[]) => void) => {
      const adapter: PerformanceObserverAdapter = {
        observe: vi.fn(),
        disconnect: vi.fn(),
      };
      adapters.push({ adapter, emit });
      return adapter;
    });
    const registry = new PerformanceObserverRegistry(factory);
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const cleanupFirst = registry.subscribe('longtask', firstListener);
    const cleanupSecond = registry.subscribe('longtask', secondListener);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(adapters[0]?.adapter.observe).toHaveBeenCalledWith({
      type: 'longtask',
      buffered: true,
    });

    const entry = { duration: 52 } as PerformanceEntry;
    adapters[0]?.emit([entry]);
    expect(firstListener).toHaveBeenCalledWith([entry]);
    expect(secondListener).toHaveBeenCalledWith([entry]);

    cleanupFirst();
    expect(adapters[0]?.adapter.disconnect).not.toHaveBeenCalled();
    cleanupSecond();
    expect(adapters[0]?.adapter.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('main-thread, navigation and resource summaries', () => {
  it('reports unsupported main-thread metrics without numeric sentinels', () => {
    const capabilities = detectPerformanceCapabilities([]);

    expect(summarizeMainThreadEntries([], [], capabilities)).toEqual({
      longTasks: { status: 'unsupported' },
      longAnimationFrames: { status: 'unsupported' },
    });
  });

  it('keeps navigation waiting when the API exists but has no entry', () => {
    expect(summarizeNavigationTiming(undefined, true)).toEqual({
      status: 'waiting',
    });
    expect(summarizeNavigationTiming(undefined, false)).toEqual({
      status: 'unsupported',
    });
  });

  it('marks missing resource transfer sizes as not measurable', () => {
    const snapshot = summarizeResourceEntries([
      { duration: 18, transferSize: 0, decodedBodySize: 0 },
      { duration: 12 },
    ]);

    expect(snapshot.resourceCount).toBe(2);
    expect(snapshot.totalDuration).toBe(30);
    expect(snapshot.transferSize).toEqual({ status: 'not-measurable' });
    expect(snapshot.decodedBodySize).toEqual({ status: 'not-measurable' });
  });

  it('sums measurable resource transfer sizes', () => {
    const snapshot = summarizeResourceEntries([
      { duration: 8, transferSize: 1200, decodedBodySize: 2400 },
      { duration: 12, transferSize: 800, decodedBodySize: 1600 },
    ]);

    expect(snapshot.transferSize).toEqual({ status: 'available', value: 2000 });
    expect(snapshot.decodedBodySize).toEqual({
      status: 'available',
      value: 4000,
    });
  });
});

describe('WebVitalsStore', () => {
  it('loads web-vitals lazily, publishes real reports and ignores late callbacks', async () => {
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
    const loader = vi.fn(async () => module);
    const capabilities = detectPerformanceCapabilities([
      'navigation',
      'paint',
      'largest-contentful-paint',
      'layout-shift',
      'event',
    ]);
    const store = new WebVitalsStore(capabilities, loader);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(loader).not.toHaveBeenCalled();
    await store.start();
    await store.start();
    expect(loader).toHaveBeenCalledTimes(1);

    callbacks.get('INP')?.({
      name: 'INP',
      value: 128,
      delta: 128,
      rating: 'good',
      id: 'inp-1',
    });
    expect(store.getSnapshot().inp).toEqual({
      status: 'available',
      value: {
        value: 128,
        delta: 128,
        rating: 'good',
        id: 'inp-1',
      },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    store.stop();
    callbacks.get('INP')?.({
      name: 'INP',
      value: 240,
      delta: 112,
      rating: 'needs-improvement',
      id: 'inp-1',
    });
    expect(store.getSnapshot().inp).toEqual({
      status: 'available',
      value: {
        value: 128,
        delta: 128,
        rating: 'good',
        id: 'inp-1',
      },
    });
  });
});
