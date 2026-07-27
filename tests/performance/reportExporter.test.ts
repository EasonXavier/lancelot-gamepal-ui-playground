import { describe, expect, it } from 'vitest';

import {
  serializeReport,
  type ReportSnapshot,
} from '../../src/performance/reportExporter';

const createSnapshot = (): ReportSnapshot => ({
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
  settings: {
    glassMode: 'real',
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
  benchmark: { completedInForeground: null },
});

describe('serializeReport', () => {
  it('emits a stable schema and labels dropped frames as an estimate', () => {
    const report = JSON.parse(serializeReport(createSnapshot())) as Record<
      string,
      unknown
    >;
    const performance = report.performance as {
      frames: { estimatedDroppedFrames: unknown };
    };

    expect(Object.keys(report)).toEqual([
      'schemaVersion',
      'generatedAt',
      'page',
      'environment',
      'settings',
      'performance',
      'benchmark',
    ]);
    expect(report.schemaVersion).toBe(1);
    expect(performance.frames.estimatedDroppedFrames).toEqual({
      label: 'Estimated',
      value: 4,
    });
    expect(serializeReport(createSnapshot())).toBe(
      serializeReport(createSnapshot()),
    );
  });

  it('preserves null and explicit unsupported states instead of numeric zeroes', () => {
    const report = JSON.parse(serializeReport(createSnapshot())) as {
      benchmark: { completedInForeground: boolean | null };
      performance: {
        webVitals: { lcp: unknown };
        resources: { transferSize: unknown };
      };
    };

    expect(report.benchmark.completedInForeground).toBeNull();
    expect(report.performance.webVitals.lcp).toEqual({
      status: 'unsupported',
    });
    expect(report.performance.resources.transferSize).toEqual({
      status: 'not-measurable',
    });
  });

  it('drops identity and credential-shaped fields that are not in the report schema', () => {
    const polluted = Object.assign(createSnapshot(), {
      cookie: 'session=secret-cookie',
      token: 'secret-token',
      ipAddress: '203.0.113.10',
      preciseLocation: { latitude: 1, longitude: 2 },
      userId: 'wechat-user-123',
    });

    const serialized = serializeReport(polluted);

    expect(serialized).not.toContain('secret-cookie');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('203.0.113.10');
    expect(serialized).not.toContain('wechat-user-123');
    expect(serialized).not.toContain('preciseLocation');
  });
});
