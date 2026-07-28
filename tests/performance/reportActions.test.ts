import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createReportActions,
  type ReportActionDependencies,
} from '../../src/performance/reportActions';
import type { ReportRun, ReportSnapshot } from '../../src/performance/reportExporter';

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
    webVitals: { inp: { status: 'waiting' }, lcp: { status: 'unsupported' } },
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
    operatingSystem: null,
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
  it('copies stable schema v2 JSON while preserving the page privacy whitelist', async () => {
    const { dependencies, writeText } = createDependencies();
    const snapshot = createSnapshot();
    snapshot.page.url =
      'https://user:password@example.test/lancelot-gamepal-ui-playground/?token=secret#identity';
    const polluted = Object.assign(snapshot, {
      authorization: 'Bearer secret-authorization',
      identity: 'wechat-user-123',
    });
    const actions = createReportActions(() => polluted, dependencies);

    await actions.copyJson();
    await actions.copyJson();

    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('"schemaVersion": 2');
    expect(JSON.parse(copied)).toMatchObject({
      reportType: 'single',
      page: { url: '/lancelot-gamepal-ui-playground/' },
    });
    expect(copied).not.toMatch(/secret-authorization|wechat-user-123|password/);
    expect(writeText.mock.calls[1]?.[0]).toBe(copied);
  });

  it('downloads one stable JSON blob and always cleans up its object URL', () => {
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

  it('formats one comparison row per retained suite run with eligibility', async () => {
    const { dependencies, writeText } = createDependencies();
    const snapshot = createSnapshot('suite', [
      createRun('real'),
      createRun('simulated', false),
      createRun('preblur'),
      createRun('off'),
    ]);
    const actions = createReportActions(() => snapshot, dependencies);

    await actions.copySummary();

    expect(writeText).toHaveBeenCalledWith(
      [
        '朗世乐 UI 性能报告',
        'Report: suite',
        'Status: completed',
        'Glass | FPS | P95 Frame | Estimated Dropped Frames | Foreground Complete | Eligible',
        'real | 58.4 | 22 | 4 | yes | yes',
        'simulated | 58.4 | 22 | 4 | no | no',
        'preblur | 58.4 | 22 | 4 | yes | yes',
        'off | 58.4 | 22 | 4 | yes | yes',
      ].join('\n'),
    );
  });

  it('summarizes a cancelled report without fabricating an active run', async () => {
    const { dependencies, writeText } = createDependencies();
    const snapshot = createSnapshot('single', []);
    snapshot.benchmark.status = 'cancelled';
    snapshot.benchmark.elapsedMs = 11_000;
    snapshot.benchmark.terminatedPhase = 'stress';
    const actions = createReportActions(() => snapshot, dependencies);

    await actions.copySummary();

    expect(writeText).toHaveBeenCalledWith(
      [
        '朗世乐 UI 性能报告',
        'Report: single',
        'Status: cancelled',
        'Glass | FPS | P95 Frame | Estimated Dropped Frames | Foreground Complete | Eligible',
        'No completed runs',
      ].join('\n'),
    );
  });

  it('renders unavailable completed-run metrics as waiting instead of zero', async () => {
    const { dependencies, writeText } = createDependencies();
    const run = createRun();
    run.performance.frames.averageFps = null;
    run.performance.frames.p95FrameTime = null;
    run.performance.frames.estimatedDroppedFrames = null;
    const actions = createReportActions(
      () => createSnapshot('single', [run]),
      dependencies,
    );

    await actions.copySummary();

    expect(writeText.mock.calls[0]?.[0]).toContain(
      'real | waiting | waiting | waiting | yes | yes',
    );
    expect(writeText.mock.calls[0]?.[0]).not.toMatch(/\| 0(?: \||$)/);
  });

  it.each([
    [
      'an IP host',
      'https://203.0.113.10/lancelot-gamepal-ui-playground/',
      '/lancelot-gamepal-ui-playground/',
    ],
    ['a token-bearing path', 'https://example.test/token/secret-token', '[redacted]'],
    [
      'an identity-bearing path',
      'https://example.test/users/wechat-user-123',
      '[redacted]',
    ],
    ['a root page with ambient suffixes', 'https://example.test/?token=x#user', '/'],
  ])('catches %s entering the whitelisted page identifier', async (_, input, want) => {
    const { dependencies, writeText } = createDependencies();
    const snapshot = createSnapshot();
    snapshot.page.url = input;
    const actions = createReportActions(() => snapshot, dependencies);

    await actions.copyJson();

    const copied = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as {
      page?: { url?: string };
    };
    expect(copied.page?.url).toBe(want);
  });

  it('revokes the object URL when anchor creation fails before append', () => {
    const { dependencies, revokeObjectURL } = createDependencies();
    vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
      throw new Error('createElement failed');
    });
    const actions = createReportActions(createSnapshot, dependencies);

    expect(() => actions.downloadJson()).toThrow('createElement failed');
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-report');
  });

  it('removes the anchor and revokes the object URL when timestamp creation fails', () => {
    const { dependencies, revokeObjectURL } = createDependencies();
    const anchor = document.createElement('a');
    const remove = vi.spyOn(anchor, 'remove');
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor);
    dependencies.now = () => {
      throw new Error('clock failed');
    };
    const actions = createReportActions(createSnapshot, dependencies);

    expect(() => actions.downloadJson()).toThrow('clock failed');
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('removes the anchor and revokes the object URL when anchor setup fails', () => {
    const { dependencies, revokeObjectURL } = createDependencies();
    const anchor = document.createElement('a');
    const remove = vi.spyOn(anchor, 'remove');
    Object.defineProperty(anchor, 'download', {
      configurable: true,
      set: () => {
        throw new Error('download setter failed');
      },
    });
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor);
    const actions = createReportActions(createSnapshot, dependencies);

    expect(() => actions.downloadJson()).toThrow('download setter failed');
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('removes the attached anchor and revokes the object URL when click fails', () => {
    const { click, dependencies, revokeObjectURL } = createDependencies();
    click.mockImplementationOnce(() => {
      throw new Error('click failed');
    });
    const actions = createReportActions(createSnapshot, dependencies);

    expect(() => actions.downloadJson()).toThrow('click failed');
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-report');
  });
});
