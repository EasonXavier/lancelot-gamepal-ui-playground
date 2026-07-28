import { describe, expect, it } from 'vitest';

import type { GlassMode } from '../../src/experiments/settings';
import type {
  BenchmarkClock,
  BenchmarkProfile,
  BenchmarkSceneState,
} from '../../src/performance/benchmarkRunner';
import {
  BASELINE_MODE_ORDER,
  BaselineSuiteRunner,
  type BaselineSuiteContext,
} from '../../src/performance/baselineSuiteRunner';

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
      if (!next) {
        break;
      }
      const [id, timer] = next;
      this.timers.delete(id);
      this.currentTime = timer.dueAt;
      timer.callback();
    }
    this.currentTime = target;
  }

  pendingTimerCount(): number {
    return this.timers.size;
  }
}

class FakeBaselineSuiteContext implements BaselineSuiteContext {
  private mode: GlassMode = 'real';
  readonly modes: GlassMode[] = [];
  readonly metricResets: GlassMode[] = [];
  readonly captures: GlassMode[] = [];
  readonly completions: GlassMode[] = [];
  restoreCount = 0;
  profile: BenchmarkProfile = 'idle';
  samplingEnabled: boolean;

  constructor(
    initialSamplingEnabled = false,
    private readonly resumeSamplingOnComplete = false,
  ) {
    this.samplingEnabled = initialSamplingEnabled;
  }

  setGlassMode = (mode: GlassMode): void => {
    this.mode = mode;
    this.modes.push(mode);
  };

  captureScene = (): BenchmarkSceneState => ({
    scrollY: 0,
    category: 'cs2',
    particleCount: 50,
    panelOpen: false,
  });

  restoreScene = (): void => {
    this.restoreCount += 1;
  };

  resetMetrics = (): void => {
    this.metricResets.push(this.mode);
  };

  setProfile = (profile: BenchmarkProfile): void => {
    this.profile = profile;
  };

  setSamplingEnabled = (enabled: boolean): void => {
    this.samplingEnabled = enabled;
  };

  captureResult = (): unknown => {
    this.captures.push(this.mode);
    return { mode: this.mode, capture: this.captures.length };
  };

  onComplete = (): void => {
    this.completions.push(this.mode);
    if (
      this.resumeSamplingOnComplete &&
      this.completions.length < BASELINE_MODE_ORDER.length
    ) {
      this.samplingEnabled = true;
    }
  };
}

describe('BaselineSuiteRunner', () => {
  it('runs four exact 3s settle and 30s benchmark windows in the fixed mode order', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    expect(BASELINE_MODE_ORDER).toEqual(['real', 'simulated', 'preblur', 'off']);
    expect(runner.getState()).toMatchObject({
      status: 'settling',
      mode: 'real',
      modeIndex: 0,
      elapsedMs: 0,
    });
    expect(context.metricResets).toEqual([]);

    clock.advanceBy(2_999);
    expect(runner.getState().status).toBe('settling');
    clock.advanceBy(1);
    expect(runner.getState().status).toBe('running');
    expect(context.metricResets).toEqual(['real']);

    clock.advanceBy(29_999);
    expect(runner.getState()).toMatchObject({ status: 'running', mode: 'real' });
    clock.advanceBy(1);
    expect(runner.getState()).toMatchObject({
      status: 'settling',
      mode: 'simulated',
      modeIndex: 1,
      elapsedMs: 33_000,
    });

    clock.advanceBy(33_000);
    expect(runner.getState()).toMatchObject({
      status: 'settling',
      mode: 'preblur',
      modeIndex: 2,
      elapsedMs: 66_000,
    });
    clock.advanceBy(33_000);
    expect(runner.getState()).toMatchObject({
      status: 'settling',
      mode: 'off',
      modeIndex: 3,
      elapsedMs: 99_000,
    });
    clock.advanceBy(32_999);
    expect(runner.getState()).toMatchObject({ status: 'running', mode: 'off' });
    clock.advanceBy(1);

    expect(runner.getState()).toEqual({
      status: 'completed',
      mode: null,
      modeIndex: null,
      elapsedMs: 132_000,
      consecutiveInterruptions: 0,
      failureReason: null,
      runs: [
        {
          mode: 'real',
          result: { mode: 'real', capture: 1 },
          completedInForeground: true,
        },
        {
          mode: 'simulated',
          result: { mode: 'simulated', capture: 2 },
          completedInForeground: true,
        },
        {
          mode: 'preblur',
          result: { mode: 'preblur', capture: 3 },
          completedInForeground: true,
        },
        {
          mode: 'off',
          result: { mode: 'off', capture: 4 },
          completedInForeground: true,
        },
      ],
    });
    expect(clock.pendingTimerCount()).toBe(0);
  });

  it('resets and captures metrics independently for every completed mode', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    clock.advanceBy(132_000);

    expect(context.modes).toEqual(['real', 'simulated', 'preblur', 'off']);
    expect(context.metricResets).toEqual(['real', 'simulated', 'preblur', 'off']);
    expect(context.captures).toEqual(['real', 'simulated', 'preblur', 'off']);
    expect(context.completions).toEqual(['real', 'simulated', 'preblur', 'off']);
  });

  it('keeps sampling disabled through every exact settle boundary', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext(true, true);
    const runner = new BaselineSuiteRunner(clock);
    const boundaries = [
      { mode: 'real', modeIndex: 0, nextMode: 'simulated' },
      { mode: 'simulated', modeIndex: 1, nextMode: 'preblur' },
      { mode: 'preblur', modeIndex: 2, nextMode: 'off' },
      { mode: 'off', modeIndex: 3, nextMode: null },
    ] as const;

    runner.start(context);

    for (const boundary of boundaries) {
      expect(runner.getState()).toMatchObject({
        status: 'settling',
        mode: boundary.mode,
        modeIndex: boundary.modeIndex,
      });
      expect(context.samplingEnabled).toBe(false);

      clock.advanceBy(2_999);
      expect(runner.getState()).toMatchObject({
        status: 'settling',
        mode: boundary.mode,
      });
      expect(context.samplingEnabled).toBe(false);

      clock.advanceBy(1);
      expect(runner.getState()).toMatchObject({
        status: 'running',
        mode: boundary.mode,
      });
      expect(context.samplingEnabled).toBe(true);

      clock.advanceBy(29_999);
      expect(runner.getState()).toMatchObject({
        status: 'running',
        mode: boundary.mode,
      });
      expect(context.samplingEnabled).toBe(true);

      clock.advanceBy(1);
      if (boundary.nextMode === null) {
        expect(runner.getState()).toMatchObject({
          status: 'completed',
          mode: null,
          elapsedMs: 132_000,
        });
      } else {
        expect(runner.getState()).toMatchObject({
          status: 'settling',
          mode: boundary.nextMode,
        });
      }
      expect(context.samplingEnabled).toBe(false);
    }
  });

  it.each([
    { label: 'settle', advanceMs: 1_000, expectedRestores: 0 },
    { label: 'run', advanceMs: 4_000, expectedRestores: 1 },
  ])(
    'cancels during $label without leaving active timers',
    ({ advanceMs, expectedRestores }) => {
      const clock = new FakeClock();
      const context = new FakeBaselineSuiteContext();
      const runner = new BaselineSuiteRunner(clock);

      runner.start(context);
      clock.advanceBy(advanceMs);
      runner.cancel();

      expect(runner.getState()).toMatchObject({
        status: 'cancelled',
        mode: null,
        modeIndex: null,
        elapsedMs: advanceMs,
        runs: [],
      });
      expect(context.restoreCount).toBe(expectedRestores);
      expect(context.samplingEnabled).toBe(false);
      expect(clock.pendingTimerCount()).toBe(0);

      clock.advanceBy(132_000);
      expect(context.captures).toEqual([]);
      expect(runner.getState().status).toBe('cancelled');
    },
  );

  it('retains completed runs when a later mode is cancelled', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    clock.advanceBy(33_000);
    runner.cancel();

    expect(runner.getState()).toMatchObject({
      status: 'cancelled',
      mode: null,
      modeIndex: null,
      runs: [
        {
          mode: 'real',
          result: { mode: 'real', capture: 1 },
          completedInForeground: true,
        },
      ],
    });
    expect(clock.pendingTimerCount()).toBe(0);
  });

  it('retries the current mode from a fresh settle after visibility interruptions', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    clock.advanceBy(1_000);
    runner.setVisibility(false);
    expect(runner.getState()).toMatchObject({
      status: 'waiting-for-visibility',
      mode: 'real',
      consecutiveInterruptions: 1,
      runs: [],
    });
    expect(clock.pendingTimerCount()).toBe(0);

    clock.advanceBy(10_000);
    runner.setVisibility(true);
    expect(runner.getState().status).toBe('settling');
    clock.advanceBy(8_000);
    runner.setVisibility(false);
    expect(runner.getState()).toMatchObject({
      status: 'waiting-for-visibility',
      mode: 'real',
      consecutiveInterruptions: 2,
      runs: [],
    });
    expect(context.metricResets).toEqual(['real']);
    expect(context.captures).toEqual([]);
    expect(context.samplingEnabled).toBe(false);

    runner.setVisibility(true);
    clock.advanceBy(33_000);
    expect(runner.getState()).toMatchObject({
      status: 'settling',
      mode: 'simulated',
      consecutiveInterruptions: 0,
      runs: [{ mode: 'real', completedInForeground: true }],
    });
    expect(context.metricResets).toEqual(['real', 'real']);
    expect(context.captures).toEqual(['real']);
  });

  it('fails on the third consecutive visibility interruption', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    runner.setVisibility(false);
    expect(runner.getState().consecutiveInterruptions).toBe(1);
    runner.setVisibility(true);
    runner.setVisibility(false);
    expect(runner.getState().consecutiveInterruptions).toBe(2);
    runner.setVisibility(true);
    runner.setVisibility(false);

    expect(runner.getState()).toMatchObject({
      status: 'failed',
      mode: null,
      modeIndex: null,
      consecutiveInterruptions: 3,
      failureReason: 'visibility-interruption-limit',
      runs: [],
    });
    expect(clock.pendingTimerCount()).toBe(0);

    runner.setVisibility(true);
    clock.advanceBy(132_000);
    expect(runner.getState().status).toBe('failed');
    expect(context.metricResets).toEqual([]);
  });

  it('fails on orientation change, cleans up the active run, and retains earlier runs', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    clock.advanceBy(36_000);
    runner.failOrientationChange();

    expect(runner.getState()).toMatchObject({
      status: 'failed',
      mode: null,
      modeIndex: null,
      elapsedMs: 36_000,
      failureReason: 'orientation-change',
      runs: [{ mode: 'real', completedInForeground: true }],
    });
    expect(context.restoreCount).toBe(2);
    expect(context.samplingEnabled).toBe(false);
    expect(clock.pendingTimerCount()).toBe(0);

    clock.advanceBy(132_000);
    expect(context.captures).toEqual(['real']);
  });

  it('lets a run completion at the exact boundary win before a cancellation', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    clock.advanceBy(33_000);
    runner.cancel();

    expect(runner.getState()).toMatchObject({
      status: 'cancelled',
      elapsedMs: 33_000,
      runs: [{ mode: 'real', completedInForeground: true }],
    });
    expect(context.captures).toEqual(['real']);
    expect(clock.pendingTimerCount()).toBe(0);
  });

  it('keeps exact-boundary suite completion terminal against later lifecycle events', () => {
    const clock = new FakeClock();
    const context = new FakeBaselineSuiteContext();
    const runner = new BaselineSuiteRunner(clock);

    runner.start(context);
    clock.advanceBy(132_000);
    const completed = runner.getState();

    runner.cancel();
    runner.setVisibility(false);
    runner.failOrientationChange();

    expect(runner.getState()).toEqual(completed);
    expect(completed).toMatchObject({
      status: 'completed',
      elapsedMs: 132_000,
      runs: [
        { mode: 'real' },
        { mode: 'simulated' },
        { mode: 'preblur' },
        { mode: 'off' },
      ],
    });
    expect(clock.pendingTimerCount()).toBe(0);
  });
});
