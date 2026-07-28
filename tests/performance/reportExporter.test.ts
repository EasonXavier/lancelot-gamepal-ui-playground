import { describe, expect, it } from 'vitest';

import {
  serializeReport,
  type ReportRun,
  type ReportSnapshot,
} from '../../src/performance/reportExporter';

const createRun = (
  glassMode: ReportRun['glassMode'] = 'real',
  completedInForeground = true,
): ReportRun => ({
  glassMode,
  settings: {
    glassMode,
    motionLevel: 'medium',
    particleCount: 50,
    backgroundMotion: true,
    touchParallax: true,
    cardFloat: true,
    reducedMotionSimulation: false,
    dprMode: 'cap-2',
    hudMode: 'compact',
  },
  performance: {
    frames: {
      averageFps: 58.4,
      p95FrameTime: 22,
      maxFrameTime: 41,
      estimatedDroppedFrames: 4,
      framesOver33: 2,
      framesOver50: 0,
    },
    webVitals: {
      inp: { status: 'waiting' },
      lcp: { status: 'unsupported' },
    },
    mainThread: {
      longTasks: { status: 'unsupported' },
      longAnimationFrames: { status: 'unsupported' },
    },
    resources: {
      resourceCount: 8,
      transferSize: { status: 'not-measurable' },
    },
    capabilities: {
      longTask: { status: 'unsupported' },
      longAnimationFrame: { status: 'unsupported' },
    },
  },
  elapsedMs: 30_000,
  completedInForeground,
  eligibleForComparison: completedInForeground,
});

const createSnapshot = (
  reportType: ReportSnapshot['reportType'] = 'single',
  runs: ReportRun[] = [createRun()],
): ReportSnapshot => ({
  reportType,
  generatedAt: '2026-07-27T06:00:00.000Z',
  page: { url: 'https://example.test/playground/' },
  environment: {
    userAgent: 'Test WebView',
    isWeChat: true,
    operatingSystem: 'TestOS',
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    devicePixelRatio: 3,
  },
  benchmark: {
    status: 'completed',
    order: reportType === 'suite' ? ['real', 'simulated', 'preblur', 'off'] : ['real'],
    settleDurationMs: reportType === 'suite' ? 3_000 : 0,
    runDurationMs: 30_000,
    elapsedMs: reportType === 'suite' ? 132_000 : 30_000,
    completedModes: runs.map(({ glassMode }) => glassMode),
    interruptions: 0,
    terminatedPhase: null,
    failureReason: null,
  },
  runs,
});

describe('serializeReport', () => {
  it('emits only schema v2 top-level fields and stable transformed run metrics', () => {
    const serialized = serializeReport(createSnapshot());
    const report = JSON.parse(serialized) as Record<string, unknown>;
    const runs = report.runs as Array<{
      performance: { frames: { estimatedDroppedFrames: unknown } };
    }>;

    expect(Object.keys(report)).toEqual([
      'schemaVersion',
      'reportType',
      'generatedAt',
      'page',
      'environment',
      'benchmark',
      'runs',
    ]);
    expect(report.schemaVersion).toBe(2);
    expect(report).not.toHaveProperty('settings');
    expect(report).not.toHaveProperty('performance');
    expect(runs[0]?.performance.frames.estimatedDroppedFrames).toEqual({
      label: 'Estimated',
      value: 4,
    });
    expect(serialized).toBe(serializeReport(createSnapshot()));
  });

  it.each([
    ['cancelled single', 'single', []],
    ['completed single', 'single', [createRun('real')]],
    [
      'completed suite',
      'suite',
      [
        createRun('real'),
        createRun('simulated'),
        createRun('preblur'),
        createRun('off'),
      ],
    ],
  ] as const)('serializes %s with the exact completed run count', (_, type, runs) => {
    const report = JSON.parse(serializeReport(createSnapshot(type, [...runs]))) as {
      schemaVersion: number;
      reportType: string;
      runs: unknown[];
    };

    expect(report.schemaVersion).toBe(2);
    expect(report.reportType).toBe(type);
    expect(report.runs).toHaveLength(runs.length);
  });

  it('retains completed suite runs after cancellation and marks background runs ineligible', () => {
    const retained = createRun('real', false);
    const snapshot = createSnapshot('suite', [retained]);
    snapshot.benchmark.status = 'cancelled';
    snapshot.benchmark.elapsedMs = 38_000;
    snapshot.benchmark.terminatedPhase = 'running';
    const report = JSON.parse(serializeReport(snapshot)) as {
      benchmark: { status: string; completedModes: string[] };
      runs: Array<{
        completedInForeground: boolean;
        eligibleForComparison: boolean;
      }>;
    };

    expect(report.benchmark).toMatchObject({
      status: 'cancelled',
      completedModes: ['real'],
    });
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]).toMatchObject({
      completedInForeground: false,
      eligibleForComparison: false,
    });
  });

  it('preserves null and explicit unsupported states instead of numeric zeroes', () => {
    const run = createRun();
    run.performance.frames.averageFps = null;
    const report = JSON.parse(serializeReport(createSnapshot('single', [run]))) as {
      runs: Array<{
        performance: {
          frames: { averageFps: number | null };
          webVitals: { lcp: unknown };
          resources: { transferSize: unknown };
        };
      }>;
    };

    expect(report.runs[0]?.performance.frames.averageFps).toBeNull();
    expect(report.runs[0]?.performance.webVitals.lcp).toEqual({
      status: 'unsupported',
    });
    expect(report.runs[0]?.performance.resources.transferSize).toEqual({
      status: 'not-measurable',
    });
  });

  it('drops identity and credential-shaped fields at report and run boundaries', () => {
    const pollutedRun = Object.assign(createRun(), {
      token: 'run-secret-token',
      userId: 'run-user-123',
    });
    const polluted = Object.assign(createSnapshot('single', [pollutedRun]), {
      cookie: 'session=secret-cookie',
      token: 'secret-token',
      ipAddress: '203.0.113.10',
      preciseLocation: { latitude: 1, longitude: 2 },
      userId: 'wechat-user-123',
    });

    const serialized = serializeReport(polluted);

    expect(serialized).not.toMatch(
      /secret-cookie|secret-token|203\.0\.113\.10|wechat-user-123|run-user-123|preciseLocation/,
    );
  });
});
