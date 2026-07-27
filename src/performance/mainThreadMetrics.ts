import type {
  Availability,
  DurationSummary,
  MainThreadSnapshot,
  Measurement,
  PerformanceCapabilities,
} from './types';

const capabilityFor = (
  supported: ReadonlySet<string>,
  entryType: string,
): Availability =>
  supported.has(entryType)
    ? { status: 'available' }
    : { status: 'unsupported' };

export function detectPerformanceCapabilities(
  supportedEntryTypes: readonly string[] =
    globalThis.PerformanceObserver?.supportedEntryTypes ?? [],
): PerformanceCapabilities {
  const supported = new Set(supportedEntryTypes);
  return {
    navigation: capabilityFor(supported, 'navigation'),
    paint: capabilityFor(supported, 'paint'),
    largestContentfulPaint: capabilityFor(
      supported,
      'largest-contentful-paint',
    ),
    layoutShift: capabilityFor(supported, 'layout-shift'),
    eventTiming: capabilityFor(supported, 'event'),
    longTask: capabilityFor(supported, 'longtask'),
    longAnimationFrame: capabilityFor(supported, 'long-animation-frame'),
  };
}

export interface PerformanceObserverAdapter {
  observe(options: { type: string; buffered: boolean }): void;
  disconnect(): void;
}

export type PerformanceObserverFactory = (
  emit: (entries: readonly PerformanceEntry[]) => void,
) => PerformanceObserverAdapter;

type EntryListener = (entries: readonly PerformanceEntry[]) => void;

interface SharedObserver {
  adapter: PerformanceObserverAdapter;
  listeners: Set<EntryListener>;
}

const createBrowserObserver: PerformanceObserverFactory = (emit) => {
  const observer = new PerformanceObserver((list) => emit(list.getEntries()));
  return {
    observe: (options) => observer.observe(options),
    disconnect: () => observer.disconnect(),
  };
};

export class PerformanceObserverRegistry {
  private readonly observers = new Map<string, SharedObserver>();

  constructor(
    private readonly factory: PerformanceObserverFactory = createBrowserObserver,
  ) {}

  subscribe(entryType: string, listener: EntryListener): () => void {
    let shared = this.observers.get(entryType);
    if (!shared) {
      const listeners = new Set<EntryListener>();
      const adapter = this.factory((entries) => {
        for (const currentListener of listeners) {
          currentListener(entries);
        }
      });
      shared = { adapter, listeners };
      this.observers.set(entryType, shared);
      adapter.observe({ type: entryType, buffered: true });
    }

    shared.listeners.add(listener);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      const current = this.observers.get(entryType);
      if (!current) {
        return;
      }
      current.listeners.delete(listener);
      if (current.listeners.size === 0) {
        current.adapter.disconnect();
        this.observers.delete(entryType);
      }
    };
  }
}

const summarizeDurations = (
  entries: readonly PerformanceEntry[],
): DurationSummary => {
  const durations = entries
    .map((entry) => entry.duration)
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  return {
    count: durations.length,
    totalDuration: durations.reduce((total, duration) => total + duration, 0),
    maxDuration: durations.length === 0 ? 0 : Math.max(...durations),
  };
};

const summarizeWhenSupported = (
  entries: readonly PerformanceEntry[],
  availability: Availability,
): Measurement<DurationSummary> =>
  availability.status === 'available'
    ? { status: 'available', value: summarizeDurations(entries) }
    : { status: availability.status };

export function summarizeMainThreadEntries(
  longTasks: readonly PerformanceEntry[],
  longAnimationFrames: readonly PerformanceEntry[],
  capabilities: PerformanceCapabilities,
): MainThreadSnapshot {
  return {
    longTasks: summarizeWhenSupported(longTasks, capabilities.longTask),
    longAnimationFrames: summarizeWhenSupported(
      longAnimationFrames,
      capabilities.longAnimationFrame,
    ),
  };
}
