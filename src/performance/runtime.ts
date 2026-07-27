import { FrameSampler } from './frameSampler';
import {
  PerformanceObserverRegistry,
  detectPerformanceCapabilities,
} from './mainThreadMetrics';
import {
  summarizeNavigationTiming,
  type NavigationTimingInput,
} from './navigationMetrics';
import type { ResourceTimingInput } from './resourceMetrics';
import type {
  Availability,
  DurationSummary,
  FrameSamplerSnapshot,
  MainThreadSnapshot,
  Measurement,
  NavigationSnapshot,
  PerformanceCapabilities,
  ResourceSnapshot,
  WebVitalsSnapshot,
} from './types';
import { WebVitalsStore } from './webVitals';

export interface PerformanceSnapshot {
  frames: FrameSamplerSnapshot;
  webVitals: WebVitalsSnapshot;
  mainThread: MainThreadSnapshot;
  navigation: NavigationSnapshot;
  resources: ResourceSnapshot;
  capabilities: PerformanceCapabilities;
}

export interface PerformanceRuntime {
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): PerformanceSnapshot;
}

export interface PerformanceRuntimeOptions {
  capabilities?: PerformanceCapabilities;
  frameSampler?: FrameSampler;
  registry?: PerformanceObserverRegistry;
  webVitals?: WebVitalsStore;
  getEntriesByType?: (type: string) => readonly PerformanceEntry[];
}

const emptyNavigation = undefined;

interface ResourceAggregate {
  resourceCount: number;
  totalDuration: number;
  transferSizeTotal: number;
  transferSizeMeasurable: boolean;
  decodedBodySizeTotal: number;
  decodedBodySizeMeasurable: boolean;
}

const createDurationSummary = (): DurationSummary => ({
  count: 0,
  totalDuration: 0,
  maxDuration: 0,
});

const accumulateDurations = (
  current: DurationSummary,
  entries: readonly PerformanceEntry[],
): DurationSummary => {
  let { count, totalDuration, maxDuration } = current;
  for (const entry of entries) {
    const duration = entry.duration;
    if (!Number.isFinite(duration) || duration < 0) {
      continue;
    }
    count += 1;
    totalDuration += duration;
    maxDuration = Math.max(maxDuration, duration);
  }
  return { count, totalDuration, maxDuration };
};

const durationMeasurement = (
  summary: DurationSummary,
  availability: Availability,
): Measurement<DurationSummary> =>
  availability.status === 'available'
    ? { status: 'available', value: summary }
    : { status: availability.status };

const createResourceAggregate = (): ResourceAggregate => ({
  resourceCount: 0,
  totalDuration: 0,
  transferSizeTotal: 0,
  transferSizeMeasurable: true,
  decodedBodySizeTotal: 0,
  decodedBodySizeMeasurable: true,
});

const accumulateResources = (
  current: ResourceAggregate,
  entries: readonly ResourceTimingInput[],
): ResourceAggregate => {
  const next = { ...current };
  for (const entry of entries) {
    next.resourceCount += 1;
    const duration = entry.duration;
    next.totalDuration += Number.isFinite(duration) ? Math.max(0, duration) : 0;

    const transferSize = entry.transferSize;
    if (
      transferSize === undefined ||
      !Number.isFinite(transferSize) ||
      transferSize <= 0
    ) {
      next.transferSizeMeasurable = false;
    } else {
      next.transferSizeTotal += transferSize;
    }

    const decodedBodySize = entry.decodedBodySize;
    if (
      decodedBodySize === undefined ||
      !Number.isFinite(decodedBodySize) ||
      decodedBodySize <= 0
    ) {
      next.decodedBodySizeMeasurable = false;
    } else {
      next.decodedBodySizeTotal += decodedBodySize;
    }
  }
  return next;
};

const sizeMeasurement = (
  entryCount: number,
  measurable: boolean,
  total: number,
): Measurement<number> => {
  if (entryCount === 0) {
    return { status: 'waiting' };
  }
  return measurable
    ? { status: 'available', value: total }
    : { status: 'not-measurable' };
};

const resourceSnapshot = (aggregate: ResourceAggregate): ResourceSnapshot => ({
  resourceCount: aggregate.resourceCount,
  totalDuration: aggregate.totalDuration,
  transferSize: sizeMeasurement(
    aggregate.resourceCount,
    aggregate.transferSizeMeasurable,
    aggregate.transferSizeTotal,
  ),
  decodedBodySize: sizeMeasurement(
    aggregate.resourceCount,
    aggregate.decodedBodySizeMeasurable,
    aggregate.decodedBodySizeTotal,
  ),
});

function browserEntries(type: string): readonly PerformanceEntry[] {
  const getEntriesByType = globalThis.performance?.getEntriesByType;
  return getEntriesByType
    ? (getEntriesByType as (entryType: string) => PerformanceEntry[]).call(
        globalThis.performance,
        type,
      )
    : [];
}

export function createPerformanceRuntime(
  options: PerformanceRuntimeOptions = {},
): PerformanceRuntime {
  const capabilities = options.capabilities ?? detectPerformanceCapabilities();
  const sampler = options.frameSampler ?? new FrameSampler();
  const registry = options.registry ?? new PerformanceObserverRegistry();
  const webVitals = options.webVitals ?? new WebVitalsStore(capabilities);
  const getEntriesByType = options.getEntriesByType ?? browserEntries;
  const listeners = new Set<() => void>();
  const observerUnsubscribers = new Set<() => void>();
  let webVitalsUnsubscribe: (() => void) | null = null;
  let frameUnsubscribe: (() => void) | null = null;
  let publicationTimer: ReturnType<typeof setTimeout> | null = null;
  let startPromise: Promise<void> | null = null;
  let started = false;
  let paused = false;
  let longTasks = createDurationSummary();
  let longAnimationFrames = createDurationSummary();
  let navigationEntry: NavigationTimingInput | undefined = emptyNavigation;
  let resources = createResourceAggregate();

  const refreshSnapshot = (): void => {
    snapshot = {
      frames: sampler.getSnapshot(),
      webVitals: webVitals.getSnapshot(),
      mainThread: {
        longTasks: durationMeasurement(longTasks, capabilities.longTask),
        longAnimationFrames: durationMeasurement(
          longAnimationFrames,
          capabilities.longAnimationFrame,
        ),
      },
      navigation: summarizeNavigationTiming(
        navigationEntry,
        capabilities.navigation.status === 'available',
      ),
      resources: resourceSnapshot(resources),
      capabilities,
    };
  };

  let snapshot: PerformanceSnapshot;
  refreshSnapshot();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const flushPublication = (): void => {
    publicationTimer = null;
    if (!started || paused) {
      return;
    }
    refreshSnapshot();
    emit();
  };

  const schedulePublication = (): void => {
    if (!started || paused || publicationTimer !== null) {
      return;
    }
    publicationTimer = setTimeout(flushPublication, 250);
  };

  const cancelPublication = (): void => {
    if (publicationTimer !== null) {
      clearTimeout(publicationTimer);
      publicationTimer = null;
    }
  };

  const disconnectObservers = (): void => {
    for (const unsubscribe of observerUnsubscribers) {
      unsubscribe();
    }
    observerUnsubscribers.clear();
  };

  const observe = (
    entryType: string,
    listener: (entries: readonly PerformanceEntry[]) => void,
  ) => {
    observerUnsubscribers.add(
      registry.subscribe(entryType, (entries) => {
        if (!started || paused) {
          return;
        }
        listener(entries);
      }),
    );
  };

  const connectObservers = (): void => {
    if (capabilities.longTask.status === 'available') {
      observe('longtask', (entries) => {
        longTasks = accumulateDurations(longTasks, entries);
        schedulePublication();
      });
    }
    if (capabilities.longAnimationFrame.status === 'available') {
      observe('long-animation-frame', (entries) => {
        longAnimationFrames = accumulateDurations(longAnimationFrames, entries);
        schedulePublication();
      });
    }
    if (capabilities.navigation.status === 'available') {
      observe('navigation', (entries) => {
        navigationEntry = entries[entries.length - 1] as unknown as
          NavigationTimingInput | undefined;
        schedulePublication();
      });
    }
    if (supportsResourceObserver()) {
      observe('resource', (entries) => {
        resources = accumulateResources(
          resources,
          entries as unknown as ResourceTimingInput[],
        );
        schedulePublication();
      });
    }
  };

  const supportsResourceObserver = (): boolean =>
    globalThis.PerformanceObserver?.supportedEntryTypes?.includes('resource') ?? false;

  const connectWebVitals = (): void => {
    if (!webVitalsUnsubscribe) {
      webVitalsUnsubscribe = webVitals.subscribe(schedulePublication);
    }
  };

  const connectFrames = (): void => {
    if (!frameUnsubscribe) {
      frameUnsubscribe = sampler.subscribe(schedulePublication);
    }
  };

  return {
    start(): Promise<void> {
      if (started) {
        return startPromise ?? Promise.resolve();
      }
      started = true;
      paused = false;
      longTasks = createDurationSummary();
      longAnimationFrames = createDurationSummary();
      navigationEntry = emptyNavigation;
      resources = createResourceAggregate();
      if (!supportsResourceObserver()) {
        resources = accumulateResources(
          resources,
          getEntriesByType('resource') as unknown as ResourceTimingInput[],
        );
      }
      sampler.start();
      connectFrames();
      connectWebVitals();
      connectObservers();
      startPromise = webVitals.start();
      void startPromise.then(schedulePublication, () => undefined);
      return startPromise;
    },

    pause(): void {
      if (!started || paused) {
        return;
      }
      paused = true;
      cancelPublication();
      sampler.pause();
      webVitals.stop();
    },

    resume(): void {
      if (!started || !paused) {
        return;
      }
      paused = false;
      sampler.resume();
      void webVitals.start().then(schedulePublication, () => undefined);
    },

    stop(): void {
      if (!started) {
        return;
      }
      started = false;
      paused = false;
      cancelPublication();
      sampler.stop();
      frameUnsubscribe?.();
      frameUnsubscribe = null;
      webVitals.stop();
      webVitalsUnsubscribe?.();
      webVitalsUnsubscribe = null;
      disconnectObservers();
      startPromise = null;
    },

    reset(): void {
      cancelPublication();
      longTasks = createDurationSummary();
      longAnimationFrames = createDurationSummary();
      navigationEntry = emptyNavigation;
      resources = createResourceAggregate();
      sampler.reset();
      webVitals.reset();
      cancelPublication();
      refreshSnapshot();
      emit();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot(): PerformanceSnapshot {
      return snapshot;
    },
  };
}
