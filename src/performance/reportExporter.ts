import type { ExperimentSettings, GlassMode } from '../experiments/settings';
import type { BaselineSuiteFailureReason } from './baselineSuiteRunner';
import type { BenchmarkPhase } from './benchmarkRunner';

type MetricValue = unknown;

export interface ReportPerformance {
  frames: {
    averageFps: number | null;
    p95FrameTime: number | null;
    maxFrameTime: number | null;
    estimatedDroppedFrames: number | null;
    framesOver33: number;
    framesOver50: number;
  };
  webVitals: Partial<Record<'ttfb' | 'fcp' | 'lcp' | 'cls' | 'inp', MetricValue>>;
  mainThread: {
    longTasks: MetricValue;
    longAnimationFrames: MetricValue;
  };
  resources: {
    resourceCount: number;
    totalDuration?: number;
    transferSize: MetricValue;
    decodedBodySize?: MetricValue;
  };
  capabilities: Partial<
    Record<
      | 'navigation'
      | 'paint'
      | 'largestContentfulPaint'
      | 'layoutShift'
      | 'eventTiming'
      | 'longTask'
      | 'longAnimationFrame',
      MetricValue
    >
  >;
}

export interface ReportRun {
  glassMode: GlassMode;
  settings: ExperimentSettings;
  performance: ReportPerformance;
  elapsedMs: number;
  completedInForeground: boolean;
  eligibleForComparison: boolean;
}

export type ReportStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface ReportSnapshot {
  reportType: 'single' | 'suite';
  generatedAt: string;
  page: { url: string };
  environment: {
    userAgent: string;
    isWeChat: boolean;
    operatingSystem: string | null;
    viewport: { width: number; height: number };
    screen: { width: number; height: number };
    devicePixelRatio: number;
  };
  benchmark: {
    status: ReportStatus;
    order: GlassMode[];
    settleDurationMs: number;
    runDurationMs: number;
    elapsedMs: number;
    completedModes: GlassMode[];
    interruptions: number;
    terminatedPhase:
      BenchmarkPhase | 'settling' | 'running' | 'waiting-for-visibility' | null;
    failureReason: BaselineSuiteFailureReason | null;
  };
  runs: ReportRun[];
}

const metricOrNull = (value: MetricValue | undefined): MetricValue | null =>
  value === undefined ? null : value;

const serializedSettings = (settings: ExperimentSettings) => ({
  glassMode: settings.glassMode,
  motionLevel: settings.motionLevel,
  particleCount: settings.particleCount,
  backgroundMotion: settings.backgroundMotion,
  touchParallax: settings.touchParallax,
  cardFloat: settings.cardFloat,
  reducedMotionSimulation: settings.reducedMotionSimulation,
  dprMode: settings.dprMode,
  hudMode: settings.hudMode,
});

const serializedPerformance = (performance: ReportPerformance) => ({
  frames: {
    averageFps: performance.frames.averageFps,
    p95FrameTime: performance.frames.p95FrameTime,
    maxFrameTime: performance.frames.maxFrameTime,
    estimatedDroppedFrames: {
      label: 'Estimated',
      value: performance.frames.estimatedDroppedFrames,
    },
    framesOver33: performance.frames.framesOver33,
    framesOver50: performance.frames.framesOver50,
  },
  webVitals: {
    ttfb: metricOrNull(performance.webVitals.ttfb),
    fcp: metricOrNull(performance.webVitals.fcp),
    lcp: metricOrNull(performance.webVitals.lcp),
    cls: metricOrNull(performance.webVitals.cls),
    inp: metricOrNull(performance.webVitals.inp),
  },
  mainThread: {
    longTasks: performance.mainThread.longTasks,
    longAnimationFrames: performance.mainThread.longAnimationFrames,
  },
  resources: {
    resourceCount: performance.resources.resourceCount,
    totalDuration: performance.resources.totalDuration ?? null,
    transferSize: performance.resources.transferSize,
    decodedBodySize: metricOrNull(performance.resources.decodedBodySize),
  },
  capabilities: {
    navigation: metricOrNull(performance.capabilities.navigation),
    paint: metricOrNull(performance.capabilities.paint),
    largestContentfulPaint: metricOrNull(
      performance.capabilities.largestContentfulPaint,
    ),
    layoutShift: metricOrNull(performance.capabilities.layoutShift),
    eventTiming: metricOrNull(performance.capabilities.eventTiming),
    longTask: metricOrNull(performance.capabilities.longTask),
    longAnimationFrame: metricOrNull(performance.capabilities.longAnimationFrame),
  },
});

export function serializeReport(snapshot: ReportSnapshot): string {
  const report = {
    schemaVersion: 2,
    reportType: snapshot.reportType,
    generatedAt: snapshot.generatedAt,
    page: { url: snapshot.page.url },
    environment: {
      userAgent: snapshot.environment.userAgent,
      isWeChat: snapshot.environment.isWeChat,
      operatingSystem: snapshot.environment.operatingSystem,
      viewport: {
        width: snapshot.environment.viewport.width,
        height: snapshot.environment.viewport.height,
      },
      screen: {
        width: snapshot.environment.screen.width,
        height: snapshot.environment.screen.height,
      },
      devicePixelRatio: snapshot.environment.devicePixelRatio,
    },
    benchmark: {
      status: snapshot.benchmark.status,
      order: [...snapshot.benchmark.order],
      settleDurationMs: snapshot.benchmark.settleDurationMs,
      runDurationMs: snapshot.benchmark.runDurationMs,
      elapsedMs: snapshot.benchmark.elapsedMs,
      completedModes: [...snapshot.benchmark.completedModes],
      interruptions: snapshot.benchmark.interruptions,
      terminatedPhase: snapshot.benchmark.terminatedPhase,
      failureReason: snapshot.benchmark.failureReason,
    },
    runs: snapshot.runs.map((run) => ({
      glassMode: run.glassMode,
      settings: serializedSettings(run.settings),
      performance: serializedPerformance(run.performance),
      elapsedMs: run.elapsedMs,
      completedInForeground: run.completedInForeground,
      eligibleForComparison: run.eligibleForComparison,
    })),
  };

  return JSON.stringify(report, null, 2);
}
