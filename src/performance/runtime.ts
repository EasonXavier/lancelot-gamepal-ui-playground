import { FrameSampler } from './frameSampler';
import {
  PerformanceObserverRegistry,
  detectPerformanceCapabilities,
  summarizeMainThreadEntries,
} from './mainThreadMetrics';
import {
  summarizeNavigationTiming,
  type NavigationTimingInput,
} from './navigationMetrics';
import { summarizeResourceEntries, type ResourceTimingInput } from './resourceMetrics';
import type {
  FrameSamplerSnapshot,
  MainThreadSnapshot,
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
  let longTasks: PerformanceEntry[] = [];
  let longAnimationFrames: PerformanceEntry[] = [];
  let navigationEntry: NavigationTimingInput | undefined = emptyNavigation;
  let resourceEntries: ResourceTimingInput[] = [];

  const refreshSnapshot = (): void => {
    snapshot = {
      frames: sampler.getSnapshot(),
      webVitals: webVitals.getSnapshot(),
      mainThread: summarizeMainThreadEntries(
        longTasks,
        longAnimationFrames,
        capabilities,
      ),
      navigation: summarizeNavigationTiming(
        navigationEntry,
        capabilities.navigation.status === 'available',
      ),
      resources: summarizeResourceEntries(resourceEntries),
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
    observerUnsubscribers.add(registry.subscribe(entryType, listener));
  };

  const connectObservers = (): void => {
    if (capabilities.longTask.status === 'available') {
      observe('longtask', (entries) => {
        longTasks = [...longTasks, ...entries];
        schedulePublication();
      });
    }
    if (capabilities.longAnimationFrame.status === 'available') {
      observe('long-animation-frame', (entries) => {
        longAnimationFrames = [...longAnimationFrames, ...entries];
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
        resourceEntries = [
          ...resourceEntries,
          ...(entries as unknown as ResourceTimingInput[]),
        ];
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
      if (capabilities.navigation.status === 'available') {
        navigationEntry = getEntriesByType('navigation').at(-1) as unknown as
          NavigationTimingInput | undefined;
      }
      if (supportsResourceObserver()) {
        resourceEntries = getEntriesByType(
          'resource',
        ) as unknown as ResourceTimingInput[];
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
      disconnectObservers();
    },

    resume(): void {
      if (!started || !paused) {
        return;
      }
      paused = false;
      sampler.resume();
      connectObservers();
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
      longTasks = [];
      longAnimationFrames = [];
      navigationEntry = emptyNavigation;
      resourceEntries = [];
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
