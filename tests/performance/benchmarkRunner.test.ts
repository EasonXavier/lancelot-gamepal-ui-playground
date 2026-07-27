import { describe, expect, it } from 'vitest';

import {
  BenchmarkRunner,
  type BenchmarkClock,
  type BenchmarkContext,
  type BenchmarkProfile,
  type BenchmarkSceneState,
} from '../../src/performance/benchmarkRunner';

class FakeClock implements BenchmarkClock {
  private currentTime = 0;
  private nextId = 1;
  private readonly timers = new Map<
    number,
    { dueAt: number; callback: () => void }
  >();

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
}

class FakeBenchmarkContext implements BenchmarkContext {
  readonly originalScene: BenchmarkSceneState = {
    scrollY: 320,
    category: 'cs2',
    particleCount: 20,
    panelOpen: true,
  };
  profile: BenchmarkProfile = 'idle';
  samplingEnabled = false;
  resetCount = 0;
  restoredScene: BenchmarkSceneState | null = null;
  completion: { completedInForeground: boolean; result: unknown } | null = null;

  captureScene = (): BenchmarkSceneState => ({ ...this.originalScene });

  restoreScene = (scene: BenchmarkSceneState): void => {
    this.restoredScene = { ...scene };
  };

  resetMetrics = (): void => {
    this.resetCount += 1;
  };

  setProfile = (profile: BenchmarkProfile): void => {
    this.profile = profile;
  };

  setSamplingEnabled = (enabled: boolean): void => {
    this.samplingEnabled = enabled;
  };

  captureResult = (): unknown => ({ averageFps: 57 });

  onComplete = (
    result: unknown,
    completedInForeground: boolean,
  ): void => {
    this.completion = { completedInForeground, result };
  };
}

describe('BenchmarkRunner', () => {
  it('runs the exact 3s, 8s, 8s, 8s and 3s phases before restoring the scene', () => {
    const clock = new FakeClock();
    const context = new FakeBenchmarkContext();
    const runner = new BenchmarkRunner(clock);

    runner.start(context);
    expect(runner.getState().phase).toBe('warmup');
    expect(context.resetCount).toBe(1);

    clock.advanceBy(2_999);
    expect(runner.getState().phase).toBe('warmup');
    clock.advanceBy(1);
    expect(runner.getState().phase).toBe('ambient');
    clock.advanceBy(8_000);
    expect(runner.getState().phase).toBe('stress');
    clock.advanceBy(8_000);
    expect(runner.getState().phase).toBe('scroll-transition');
    clock.advanceBy(8_000);
    expect(runner.getState().phase).toBe('summarize');
    clock.advanceBy(3_000);

    expect(runner.getState()).toMatchObject({
      status: 'completed',
      phase: null,
      elapsedMs: 30_000,
      completedInForeground: true,
    });
    expect(context.restoredScene).toEqual(context.originalScene);
    expect(context.profile).toBe('idle');
    expect(context.samplingEnabled).toBe(false);
    expect(context.completion).toEqual({
      completedInForeground: true,
      result: { averageFps: 57 },
    });
  });

  it('excludes background samples and marks the result incomplete in foreground', () => {
    const clock = new FakeClock();
    const context = new FakeBenchmarkContext();
    const runner = new BenchmarkRunner(clock);

    runner.start(context);
    expect(context.samplingEnabled).toBe(true);
    runner.setVisibility(false);
    expect(context.samplingEnabled).toBe(false);
    expect(runner.getState().completedInForeground).toBe(false);

    clock.advanceBy(1_000);
    runner.setVisibility(true);
    expect(context.samplingEnabled).toBe(true);
    clock.advanceBy(29_000);

    expect(runner.getState().status).toBe('completed');
    expect(context.completion).toEqual({
      completedInForeground: false,
      result: { averageFps: 57 },
    });
  });

  it('cancels pending phases and restores scroll, category, particles and panel state', () => {
    const clock = new FakeClock();
    const context = new FakeBenchmarkContext();
    const runner = new BenchmarkRunner(clock);

    runner.start(context);
    clock.advanceBy(4_000);
    runner.cancel();

    expect(runner.getState().status).toBe('cancelled');
    expect(context.restoredScene).toEqual({
      scrollY: 320,
      category: 'cs2',
      particleCount: 20,
      panelOpen: true,
    });
    expect(context.profile).toBe('idle');
    expect(context.samplingEnabled).toBe(false);

    clock.advanceBy(60_000);
    expect(runner.getState().status).toBe('cancelled');
    expect(context.completion).toBeNull();
  });
});
