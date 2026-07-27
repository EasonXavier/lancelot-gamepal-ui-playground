import type { ExperimentSettings } from '../experiments/settings';

type MetricValue = unknown;

export interface ReportSnapshot {
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
  settings: ExperimentSettings;
  performance: {
    frames: {
      averageFps: number | null;
      p95FrameTime: number | null;
      maxFrameTime: number | null;
      estimatedDroppedFrames: number | null;
      framesOver33: number;
      framesOver50: number;
    };
    webVitals: Partial<
      Record<'ttfb' | 'fcp' | 'lcp' | 'cls' | 'inp', MetricValue>
    >;
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
  };
  benchmark: { completedInForeground: boolean | null };
}

const metricOrNull = (value: MetricValue | undefined): MetricValue | null =>
  value === undefined ? null : value;

export function serializeReport(snapshot: ReportSnapshot): string {
  const report = {
    schemaVersion: 1,
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
    settings: {
      glassMode: snapshot.settings.glassMode,
      motionLevel: snapshot.settings.motionLevel,
      particleCount: snapshot.settings.particleCount,
      backgroundMotion: snapshot.settings.backgroundMotion,
      touchParallax: snapshot.settings.touchParallax,
      cardFloat: snapshot.settings.cardFloat,
      reducedMotionSimulation: snapshot.settings.reducedMotionSimulation,
      dprMode: snapshot.settings.dprMode,
      hudMode: snapshot.settings.hudMode,
    },
    performance: {
      frames: {
        averageFps: snapshot.performance.frames.averageFps,
        p95FrameTime: snapshot.performance.frames.p95FrameTime,
        maxFrameTime: snapshot.performance.frames.maxFrameTime,
        estimatedDroppedFrames: {
          label: 'Estimated',
          value: snapshot.performance.frames.estimatedDroppedFrames,
        },
        framesOver33: snapshot.performance.frames.framesOver33,
        framesOver50: snapshot.performance.frames.framesOver50,
      },
      webVitals: {
        ttfb: metricOrNull(snapshot.performance.webVitals.ttfb),
        fcp: metricOrNull(snapshot.performance.webVitals.fcp),
        lcp: metricOrNull(snapshot.performance.webVitals.lcp),
        cls: metricOrNull(snapshot.performance.webVitals.cls),
        inp: metricOrNull(snapshot.performance.webVitals.inp),
      },
      mainThread: {
        longTasks: snapshot.performance.mainThread.longTasks,
        longAnimationFrames:
          snapshot.performance.mainThread.longAnimationFrames,
      },
      resources: {
        resourceCount: snapshot.performance.resources.resourceCount,
        totalDuration: snapshot.performance.resources.totalDuration ?? null,
        transferSize: snapshot.performance.resources.transferSize,
        decodedBodySize: metricOrNull(
          snapshot.performance.resources.decodedBodySize,
        ),
      },
      capabilities: {
        navigation: metricOrNull(snapshot.performance.capabilities.navigation),
        paint: metricOrNull(snapshot.performance.capabilities.paint),
        largestContentfulPaint: metricOrNull(
          snapshot.performance.capabilities.largestContentfulPaint,
        ),
        layoutShift: metricOrNull(snapshot.performance.capabilities.layoutShift),
        eventTiming: metricOrNull(snapshot.performance.capabilities.eventTiming),
        longTask: metricOrNull(snapshot.performance.capabilities.longTask),
        longAnimationFrame: metricOrNull(
          snapshot.performance.capabilities.longAnimationFrame,
        ),
      },
    },
    benchmark: {
      completedInForeground: snapshot.benchmark.completedInForeground,
    },
  };

  return JSON.stringify(report, null, 2);
}
