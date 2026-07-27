import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createReportActions,
  type ReportActionDependencies,
} from '../../src/performance/reportActions';
import type { ReportSnapshot } from '../../src/performance/reportExporter';

const createSnapshot = (): ReportSnapshot => ({
  generatedAt: '2026-07-27T06:00:00.000Z',
  page: { url: 'https://example.test/playground/' },
  environment: {
    userAgent: 'Test WebView',
    isWeChat: true,
    operatingSystem: null,
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
  benchmark: { completedInForeground: true },
});

function createDependencies() {
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:local-report');
  const revokeObjectURL = vi.fn<(url: string) => void>();
  let connectedDuringClick = false;
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      connectedDuringClick = this.isConnected;
    });
  const dependencies: ReportActionDependencies = {
    clipboard: { writeText },
    document,
    Blob,
    url: { createObjectURL, revokeObjectURL },
    now: () => new Date('2026-07-27T06:00:00.000Z'),
  };
  return {
    click,
    connectedDuringClick: () => connectedDuringClick,
    createObjectURL,
    dependencies,
    revokeObjectURL,
    writeText,
  };
}

afterEach(() => {
  document.querySelectorAll('a[download]').forEach((anchor) => anchor.remove());
  vi.restoreAllMocks();
});

describe('report actions', () => {
  it('catches ambient or credential-shaped fields escaping the whitelist JSON', async () => {
    const { dependencies, writeText } = createDependencies();
    const polluted = Object.assign(createSnapshot(), {
      authorization: 'Bearer secret-authorization',
      cookie: 'session=secret-cookie',
      identity: 'wechat-user-123',
      ipAddress: '203.0.113.10',
      location: { latitude: 1, longitude: 2 },
      token: 'secret-token',
    });
    const actions = createReportActions(() => polluted, dependencies);

    await actions.copyJson();

    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('"schemaVersion": 1');
    expect(copied).not.toMatch(
      /secret-cookie|secret-token|secret-authorization|203\.0\.113\.10|wechat-user-123|latitude/i,
    );
  });

  it('catches detached downloads, wrong filenames, duplicate clicks or leaked object URLs', () => {
    const {
      click,
      connectedDuringClick,
      createObjectURL,
      dependencies,
      revokeObjectURL,
    } = createDependencies();
    const actions = createReportActions(createSnapshot, dependencies);

    actions.downloadJson();

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('application/json;charset=utf-8');
    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor).toBeInstanceOf(HTMLAnchorElement);
    expect(anchor.download).toBe('lancelot-ui-report-2026-07-27T06-00-00-000Z.json');
    expect(anchor.href).toBe('blob:local-report');
    expect(connectedDuringClick()).toBe(true);
    expect(anchor.isConnected).toBe(false);
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-report');
  });

  it('catches summary labels, measurements or foreground state changing', async () => {
    const { dependencies, writeText } = createDependencies();
    const actions = createReportActions(createSnapshot, dependencies);

    await actions.copySummary();

    expect(writeText).toHaveBeenCalledWith(
      [
        '朗世乐 UI 性能报告',
        'Glass: real',
        'FPS: 58.4',
        'P95 Frame: 22',
        'Estimated Dropped Frames: 4',
        'Foreground Complete: yes',
      ].join('\n'),
    );
  });

  it('catches unavailable metrics being fabricated as numeric zero', async () => {
    const { dependencies, writeText } = createDependencies();
    const snapshot = createSnapshot();
    snapshot.performance.frames.averageFps = null;
    snapshot.performance.frames.p95FrameTime = null;
    snapshot.performance.frames.estimatedDroppedFrames = null;
    snapshot.benchmark.completedInForeground = null;
    const actions = createReportActions(() => snapshot, dependencies);

    await actions.copySummary();

    expect(writeText).toHaveBeenCalledWith(
      [
        '朗世乐 UI 性能报告',
        'Glass: real',
        'FPS: waiting',
        'P95 Frame: waiting',
        'Estimated Dropped Frames: waiting',
        'Foreground Complete: waiting',
      ].join('\n'),
    );
    expect(writeText.mock.calls[0]?.[0]).not.toMatch(/: 0(?:\n|$)/);
  });
});
