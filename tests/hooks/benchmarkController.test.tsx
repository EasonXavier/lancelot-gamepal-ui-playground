import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDefaultSettings,
  type ExperimentSettings,
} from '../../src/experiments/settings';
import {
  useBenchmarkController,
  type BenchmarkResultCapture,
  type BenchmarkReportTerminal,
} from '../../src/hooks/useBenchmarkController';
import type { BenchmarkClock } from '../../src/performance/benchmarkRunner';
import type {
  PerformanceRuntime,
  PerformanceSnapshot,
} from '../../src/performance/runtime';

class FakeClock implements BenchmarkClock {
  private currentTime = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { dueAt: number; callback: () => void }>();

  now = (): number => this.currentTime;

  setTimeout = (callback: () => void, delayMs: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { dueAt: this.currentTime + delayMs, callback });
    return id;
  };

  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };

  advanceBy(durationMs: number): void {
    const target = this.currentTime + durationMs;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) break;
      const [id, timer] = next;
      this.timers.delete(id);
      this.currentTime = timer.dueAt;
      timer.callback();
    }
    this.currentTime = target;
  }
}

const performanceSnapshot = (fps = 60): PerformanceSnapshot => ({
  frames: {
    intervals: [16],
    isRunning: true,
    needsCalibration: false,
    metrics: {
      sampleCount: 1,
      baselineFrameTime: 16,
      currentFps: fps,
      averageFrameTime: 16,
      p95FrameTime: 16,
      maxFrameTime: 16,
      framesOver33: 0,
      framesOver50: 0,
      stutterFrameRatio: 0,
      estimatedDroppedFrames: 0,
    },
  },
  webVitals: {
    ttfb: { status: 'waiting' },
    fcp: { status: 'waiting' },
    lcp: { status: 'waiting' },
    cls: { status: 'waiting' },
    inp: { status: 'waiting' },
  },
  mainThread: {
    longTasks: { status: 'waiting' },
    longAnimationFrames: { status: 'waiting' },
  },
  navigation: { status: 'waiting' },
  resources: {
    resourceCount: 0,
    totalDuration: 0,
    transferSize: { status: 'waiting' },
    decodedBodySize: { status: 'waiting' },
  },
  capabilities: {
    navigation: { status: 'available' },
    paint: { status: 'available' },
    largestContentfulPaint: { status: 'available' },
    layoutShift: { status: 'available' },
    eventTiming: { status: 'available' },
    longTask: { status: 'available' },
    longAnimationFrame: { status: 'available' },
  },
});

class FakeRuntime implements PerformanceRuntime {
  readonly start = vi.fn(async () => undefined);
  readonly pause = vi.fn();
  readonly resume = vi.fn();
  readonly stop = vi.fn();
  readonly reset = vi.fn();
  readonly subscribe = vi.fn(() => () => undefined);
  readonly getSnapshot = vi.fn(() => performanceSnapshot());
}

interface HarnessProps {
  settings: ExperimentSettings;
  visible: boolean;
}

function renderController(initialSettings = createDefaultSettings()) {
  const clock = new FakeClock();
  const runtime = new FakeRuntime();
  const captures: BenchmarkResultCapture[] = [];
  const terminals: BenchmarkReportTerminal[] = [];
  const overrides: Array<ExperimentSettings | null> = [];
  const starts: Array<{
    reportType: 'single' | 'suite';
    settings: ExperimentSettings;
  }> = [];
  const view = renderHook(
    ({ settings, visible }: HarnessProps) =>
      useBenchmarkController({
        clock,
        effectiveSettings: settings,
        panelOpen: true,
        performanceRuntime: runtime,
        selectedGame: 'delta',
        visible,
        onEffectiveSettingsOverrideChange: (settingsOverride) =>
          overrides.push(settingsOverride),
        onPanelOpenChange: vi.fn(),
        onProfileChange: vi.fn(),
        onReportStart: (reportType, settingsAtStart) =>
          starts.push({ reportType, settings: settingsAtStart }),
        onReportTerminal: (terminal) => terminals.push(terminal),
        onResultCapture: (capture) => captures.push(capture),
        onSelectedGameChange: vi.fn(),
      }),
    { initialProps: { settings: initialSettings, visible: true } },
  );
  return { captures, clock, overrides, runtime, starts, terminals, ...view };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('suite benchmark controller ownership', () => {
  it('prevents single and suite workloads from starting over each other', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const first = renderController();

    act(() => first.result.current.startSuite());
    act(() => first.result.current.start());

    expect(first.result.current.suiteState.status).toBe('settling');
    expect(first.result.current.state.status).toBe('idle');
    expect(first.result.current.workloadLocked).toBe(true);
    expect(first.starts.map(({ reportType }) => reportType)).toEqual(['suite']);
    first.unmount();

    const second = renderController();
    act(() => second.result.current.start());
    act(() => second.result.current.startSuite());

    expect(second.result.current.state.status).toBe('running');
    expect(second.result.current.suiteState.status).toBe('idle');
    expect(second.result.current.workloadLocked).toBe(true);
    expect(second.starts.map(({ reportType }) => reportType)).toEqual(['single']);
  });

  it('freezes non-Glass settings and changes Glass only through temporary overrides', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const frozen = {
      ...createDefaultSettings(),
      glassMode: 'preblur' as const,
      motionLevel: 'low' as const,
      particleCount: 20 as const,
      dprMode: 'cap-1.5' as const,
    };
    const view = renderController(frozen);

    act(() => view.result.current.startSuite());
    view.rerender({
      settings: {
        ...frozen,
        motionLevel: 'maximum',
        particleCount: 100,
        dprMode: 'native',
      },
      visible: true,
    });
    act(() => view.clock.advanceBy(33_000));

    expect(view.starts).toEqual([{ reportType: 'suite', settings: frozen }]);
    expect(view.captures).toHaveLength(1);
    expect(view.captures[0]?.settings).toEqual({ ...frozen, glassMode: 'real' });
    expect(view.overrides.slice(0, 2)).toEqual([
      { ...frozen, glassMode: 'real' },
      { ...frozen, glassMode: 'simulated' },
    ]);
  });

  it('restores temporary suite settings when the hook unmounts while active', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const view = renderController();

    act(() => view.result.current.startSuite());
    expect(view.overrides.at(-1)).toMatchObject({ glassMode: 'real' });

    view.unmount();

    expect(view.overrides.at(-1)).toBeNull();
  });

  it.each([
    ['settle cancellation', 1_000, 'cancel'],
    ['run cancellation', 4_000, 'cancel'],
    ['completion', 132_000, 'complete'],
    ['orientation failure', 4_000, 'orientation'],
  ] as const)('restores temporary settings after %s', (_, elapsedMs, outcome) => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const view = renderController();

    act(() => view.result.current.startSuite());
    act(() => view.clock.advanceBy(elapsedMs));
    if (outcome === 'cancel') {
      act(() => view.result.current.cancelSuite());
    } else if (outcome === 'orientation') {
      act(() => window.dispatchEvent(new Event('orientationchange')));
    }

    expect(view.overrides.at(-1)).toBeNull();
    expect(view.result.current.workloadLocked).toBe(false);
    expect(view.result.current.suiteState.status).toBe(
      outcome === 'complete'
        ? 'completed'
        : outcome === 'orientation'
          ? 'failed'
          : 'cancelled',
    );
  });

  it('restores after the third consecutive visibility interruption failure', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const view = renderController();

    act(() => view.result.current.startSuite());
    for (let attempt = 0; attempt < 3; attempt += 1) {
      view.rerender({ settings: createDefaultSettings(), visible: false });
      if (attempt < 2) {
        view.rerender({ settings: createDefaultSettings(), visible: true });
        act(() => view.clock.advanceBy(3_000));
      }
    }

    expect(view.result.current.suiteState).toMatchObject({
      status: 'failed',
      failureReason: 'visibility-interruption-limit',
      consecutiveInterruptions: 3,
    });
    expect(view.overrides.at(-1)).toBeNull();
    expect(view.terminals.at(-1)).toMatchObject({
      reportType: 'suite',
      status: 'failed',
      interruptions: 3,
      failureReason: 'visibility-interruption-limit',
    });
  });

  it('reports cumulative interruptions after interrupted modes complete successfully', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const view = renderController();

    act(() => view.result.current.startSuite());
    view.rerender({ settings: createDefaultSettings(), visible: false });
    view.rerender({ settings: createDefaultSettings(), visible: true });
    act(() => view.clock.advanceBy(33_000));

    expect(view.result.current.suiteState).toMatchObject({
      mode: 'simulated',
      consecutiveInterruptions: 0,
      interruptions: 1,
      interruptionsByMode: { real: 1, simulated: 0, preblur: 0, off: 0 },
    });

    view.rerender({ settings: createDefaultSettings(), visible: false });
    view.rerender({ settings: createDefaultSettings(), visible: true });
    act(() => view.clock.advanceBy(99_000));

    expect(view.result.current.suiteState).toMatchObject({
      status: 'completed',
      interruptions: 2,
      interruptionsByMode: { real: 1, simulated: 1, preblur: 0, off: 0 },
    });
    expect(view.terminals.at(-1)).toMatchObject({
      reportType: 'suite',
      status: 'completed',
      interruptions: 2,
      interruptionsByMode: { real: 1, simulated: 1, preblur: 0, off: 0 },
      completedModes: ['real', 'simulated', 'preblur', 'off'],
    });
  });

  it('retains completed suite runs but excludes the active run on cancellation', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const view = renderController();

    act(() => view.result.current.startSuite());
    act(() => view.clock.advanceBy(38_000));
    act(() => view.result.current.cancelSuite());

    expect(view.captures.map(({ settings }) => settings.glassMode)).toEqual(['real']);
    expect(view.result.current.suiteState.runs.map(({ mode }) => mode)).toEqual([
      'real',
    ]);
    expect(view.terminals.at(-1)).toMatchObject({
      reportType: 'suite',
      status: 'cancelled',
      completedModes: ['real'],
      terminatedPhase: 'running',
    });
  });

  it('excludes a cancelled single run and marks a background completion ineligible', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const cancelled = renderController();
    act(() => cancelled.result.current.start());
    act(() => cancelled.clock.advanceBy(11_000));
    act(() => cancelled.result.current.cancel());
    expect(cancelled.captures).toEqual([]);
    expect(cancelled.terminals.at(-1)).toMatchObject({
      reportType: 'single',
      status: 'cancelled',
      terminatedPhase: 'stress',
    });
    cancelled.unmount();

    const background = renderController();
    act(() => background.result.current.start());
    background.rerender({ settings: createDefaultSettings(), visible: false });
    act(() => background.clock.advanceBy(30_000));

    expect(background.captures).toHaveLength(1);
    expect(background.captures[0]).toMatchObject({
      reportType: 'single',
      completedInForeground: false,
      eligibleForComparison: false,
    });
  });
});
