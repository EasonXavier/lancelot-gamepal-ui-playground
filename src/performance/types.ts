export interface FrameMetrics {
  sampleCount: number;
  baselineFrameTime: number | null;
  currentFps: number | null;
  averageFrameTime: number | null;
  p95FrameTime: number | null;
  maxFrameTime: number | null;
  framesOver33: number;
  framesOver50: number;
  stutterFrameRatio: number | null;
  estimatedDroppedFrames: number;
}

export interface FrameSamplerSnapshot {
  intervals: readonly number[];
  metrics: FrameMetrics;
  isRunning: boolean;
  needsCalibration: boolean;
}

export type Availability =
  | { status: 'available' }
  | { status: 'waiting' }
  | { status: 'unsupported' }
  | { status: 'not-measurable' };

export type Measurement<T> =
  | { status: 'available'; value: T }
  | { status: 'waiting' }
  | { status: 'unsupported' }
  | { status: 'not-measurable' };

export interface PerformanceCapabilities {
  navigation: Availability;
  paint: Availability;
  largestContentfulPaint: Availability;
  layoutShift: Availability;
  eventTiming: Availability;
  longTask: Availability;
  longAnimationFrame: Availability;
}

export interface WebVitalValue {
  value: number;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
}

export interface WebVitalsSnapshot {
  ttfb: Measurement<WebVitalValue>;
  fcp: Measurement<WebVitalValue>;
  lcp: Measurement<WebVitalValue>;
  cls: Measurement<WebVitalValue>;
  inp: Measurement<WebVitalValue>;
}

export interface DurationSummary {
  count: number;
  totalDuration: number;
  maxDuration: number;
}

export interface MainThreadSnapshot {
  longTasks: Measurement<DurationSummary>;
  longAnimationFrames: Measurement<DurationSummary>;
}

export interface ResourceSnapshot {
  resourceCount: number;
  totalDuration: number;
  transferSize: Measurement<number>;
  decodedBodySize: Measurement<number>;
}

export interface NavigationMetrics {
  ttfb: number;
  requestDuration: number;
  domInteractive: number;
  loadEvent: number;
}

export type NavigationSnapshot = Measurement<NavigationMetrics>;

export interface NetworkSnapshot {
  effectiveType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean | null;
}

export interface EnvironmentSnapshot {
  userAgent: string;
  isWeChat: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number | null;
  maxTouchPoints: number;
  deviceMemoryGb: number | null;
  connection: NetworkSnapshot | null;
  prefersReducedMotion: boolean;
}
