import type {
  PerformanceCapabilities,
  WebVitalValue,
  WebVitalsSnapshot,
} from './types';

export type WebVitalName = 'TTFB' | 'FCP' | 'LCP' | 'CLS' | 'INP';

export interface WebVitalReport extends WebVitalValue {
  name: WebVitalName;
}

type WebVitalCallback = (metric: WebVitalReport) => void;

export interface WebVitalsModule {
  onTTFB(callback: WebVitalCallback): void;
  onFCP(callback: WebVitalCallback): void;
  onLCP(callback: WebVitalCallback): void;
  onCLS(callback: WebVitalCallback): void;
  onINP(callback: WebVitalCallback): void;
}

export type WebVitalsLoader = () => Promise<WebVitalsModule>;

const defaultLoader: WebVitalsLoader = async () => {
  const module = await import('web-vitals');
  return {
    onTTFB: (callback) => module.onTTFB((metric) => callback(metric)),
    onFCP: (callback) => module.onFCP((metric) => callback(metric)),
    onLCP: (callback) => module.onLCP((metric) => callback(metric)),
    onCLS: (callback) => module.onCLS((metric) => callback(metric)),
    onINP: (callback) => module.onINP((metric) => callback(metric)),
  };
};

const waitingOrUnsupported = (
  supported: boolean,
): { status: 'waiting' } | { status: 'unsupported' } =>
  supported ? { status: 'waiting' } : { status: 'unsupported' };

export function createInitialWebVitalsSnapshot(
  capabilities: PerformanceCapabilities,
): WebVitalsSnapshot {
  return {
    ttfb: waitingOrUnsupported(capabilities.navigation.status === 'available'),
    fcp: waitingOrUnsupported(capabilities.paint.status === 'available'),
    lcp: waitingOrUnsupported(
      capabilities.largestContentfulPaint.status === 'available',
    ),
    cls: waitingOrUnsupported(capabilities.layoutShift.status === 'available'),
    inp: waitingOrUnsupported(capabilities.eventTiming.status === 'available'),
  };
}

const snapshotKeyByName = {
  TTFB: 'ttfb',
  FCP: 'fcp',
  LCP: 'lcp',
  CLS: 'cls',
  INP: 'inp',
} as const;

export class WebVitalsStore {
  private snapshot: WebVitalsSnapshot;
  private readonly capabilities: PerformanceCapabilities;
  private readonly listeners = new Set<() => void>();
  private startPromise: Promise<void> | null = null;
  private active = false;

  constructor(
    capabilities: PerformanceCapabilities,
    private readonly loader: WebVitalsLoader = defaultLoader,
  ) {
    this.capabilities = capabilities;
    this.snapshot = createInitialWebVitalsSnapshot(capabilities);
  }

  getSnapshot(): WebVitalsSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): Promise<void> {
    if (this.startPromise) {
      this.active = true;
      return this.startPromise;
    }
    this.active = true;
    this.startPromise = this.loadAndRegister();
    return this.startPromise;
  }

  stop(): void {
    this.active = false;
  }

  reset(): void {
    this.snapshot = createInitialWebVitalsSnapshot(this.capabilities);
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async loadAndRegister(): Promise<void> {
    try {
      const module = await this.loader();
      module.onTTFB(this.onReport);
      module.onFCP(this.onReport);
      module.onLCP(this.onReport);
      module.onCLS(this.onReport);
      module.onINP(this.onReport);
    } catch (error) {
      this.startPromise = null;
      this.active = false;
      throw error;
    }
  }

  private readonly onReport = (report: WebVitalReport): void => {
    if (!this.active) {
      return;
    }
    const key = snapshotKeyByName[report.name];
    const value: WebVitalValue = {
      value: report.value,
      delta: report.delta,
      rating: report.rating,
      id: report.id,
    };
    this.snapshot = {
      ...this.snapshot,
      [key]: { status: 'available', value },
    };
    for (const listener of this.listeners) {
      listener();
    }
  };
}
