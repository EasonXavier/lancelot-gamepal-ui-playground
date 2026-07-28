import type { GlassMode } from '../experiments/settings';
import {
  BenchmarkRunner,
  type BenchmarkClock,
  type BenchmarkContext,
} from './benchmarkRunner';

export const BASELINE_MODE_ORDER = [
  'real',
  'simulated',
  'preblur',
  'off',
] as const satisfies readonly GlassMode[];

export type BaselineSuiteStatus =
  | 'idle'
  | 'settling'
  | 'running'
  | 'waiting-for-visibility'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type BaselineSuiteFailureReason =
  'visibility-interruption-limit' | 'orientation-change';

export interface BaselineSuiteRun {
  mode: GlassMode;
  result: unknown;
  completedInForeground: boolean;
}

export interface BaselineSuiteState {
  status: BaselineSuiteStatus;
  mode: GlassMode | null;
  modeIndex: number | null;
  elapsedMs: number;
  consecutiveInterruptions: number;
  failureReason: BaselineSuiteFailureReason | null;
  runs: ReadonlyArray<BaselineSuiteRun>;
}

export interface BaselineSuiteContext extends BenchmarkContext {
  setGlassMode(mode: GlassMode): void;
}

const SETTLE_DURATION_MS = 3_000;

export class BaselineSuiteRunner {
  private readonly benchmarkRunner: BenchmarkRunner;
  private context: BaselineSuiteContext | null = null;
  private settleTimerId: number | null = null;
  private modeIndex = 0;
  private startedAt = 0;
  private state: BaselineSuiteState = {
    status: 'idle',
    mode: null,
    modeIndex: null,
    elapsedMs: 0,
    consecutiveInterruptions: 0,
    failureReason: null,
    runs: [],
  };

  constructor(
    private readonly clock: BenchmarkClock,
    benchmarkRunner?: BenchmarkRunner,
  ) {
    this.benchmarkRunner = benchmarkRunner ?? new BenchmarkRunner(clock);
  }

  start(context: BaselineSuiteContext): void {
    if (this.isActive()) {
      return;
    }
    this.context = context;
    this.modeIndex = 0;
    this.startedAt = this.clock.now();
    this.state = {
      status: 'settling',
      mode: BASELINE_MODE_ORDER[0],
      modeIndex: 0,
      elapsedMs: 0,
      consecutiveInterruptions: 0,
      failureReason: null,
      runs: [],
    };
    this.enterSettle();
  }

  cancel(): void {
    if (!this.isActive()) {
      return;
    }
    this.stopCurrentAttempt();
    this.finish('cancelled', null);
  }

  setVisibility(visible: boolean): void {
    if (!this.isActive()) {
      return;
    }
    if (visible) {
      if (this.state.status === 'waiting-for-visibility') {
        this.enterSettle();
      }
      return;
    }
    if (this.state.status === 'waiting-for-visibility') {
      return;
    }

    const consecutiveInterruptions = this.state.consecutiveInterruptions + 1;
    this.stopCurrentAttempt();
    if (consecutiveInterruptions >= 3) {
      this.state = { ...this.state, consecutiveInterruptions };
      this.finish('failed', 'visibility-interruption-limit');
      return;
    }
    this.state = {
      ...this.state,
      status: 'waiting-for-visibility',
      consecutiveInterruptions,
    };
  }

  failOrientationChange(): void {
    if (!this.isActive()) {
      return;
    }
    this.stopCurrentAttempt();
    this.finish('failed', 'orientation-change');
  }

  getState(): BaselineSuiteState {
    const elapsedMs = this.isActive() ? this.elapsedNow() : this.state.elapsedMs;
    return {
      ...this.state,
      elapsedMs,
      runs: this.state.runs.map((run) => ({ ...run })),
    };
  }

  private enterSettle(): void {
    const context = this.context;
    const mode = BASELINE_MODE_ORDER[this.modeIndex];
    if (!context || !mode) {
      return;
    }
    this.state = {
      ...this.state,
      status: 'settling',
      mode,
      modeIndex: this.modeIndex,
    };
    context.setSamplingEnabled(false);
    context.setGlassMode(mode);
    this.settleTimerId = this.clock.setTimeout(this.startBenchmark, SETTLE_DURATION_MS);
  }

  private readonly startBenchmark = (): void => {
    this.settleTimerId = null;
    const context = this.context;
    if (!context) {
      return;
    }
    this.state = { ...this.state, status: 'running' };
    this.benchmarkRunner.start({
      captureScene: context.captureScene,
      restoreScene: context.restoreScene,
      resetMetrics: context.resetMetrics,
      setProfile: context.setProfile,
      setSamplingEnabled: context.setSamplingEnabled,
      captureResult: context.captureResult,
      onComplete: this.completeBenchmark,
    });
  };

  private readonly completeBenchmark = (
    result: unknown,
    completedInForeground: boolean,
  ): void => {
    const context = this.context;
    const mode = BASELINE_MODE_ORDER[this.modeIndex];
    if (!context || !mode || this.state.status !== 'running') {
      return;
    }

    const runs = [...this.state.runs, { mode, result, completedInForeground }];
    const nextModeIndex = this.modeIndex + 1;
    const nextMode = BASELINE_MODE_ORDER[nextModeIndex];
    if (!nextMode) {
      this.state = {
        ...this.state,
        status: 'completed',
        mode: null,
        modeIndex: null,
        elapsedMs: this.elapsedNow(),
        consecutiveInterruptions: 0,
        runs,
      };
      this.context = null;
      context.onComplete(result, completedInForeground);
      return;
    }

    this.modeIndex = nextModeIndex;
    this.state = {
      ...this.state,
      status: 'settling',
      mode: nextMode,
      modeIndex: nextModeIndex,
      consecutiveInterruptions: 0,
      runs,
    };
    context.onComplete(result, completedInForeground);
    if (this.state.status === 'settling' && this.modeIndex === nextModeIndex) {
      this.enterSettle();
    }
  };

  private finish(
    status: 'cancelled' | 'failed',
    failureReason: BaselineSuiteFailureReason | null,
  ): void {
    this.state = {
      ...this.state,
      status,
      mode: null,
      modeIndex: null,
      elapsedMs: this.elapsedNow(),
      failureReason,
    };
    this.context = null;
  }

  private stopCurrentAttempt(): void {
    this.clearSettleTimer();
    if (this.state.status === 'running') {
      this.benchmarkRunner.cancel();
    }
  }

  private clearSettleTimer(): void {
    if (this.settleTimerId !== null) {
      this.clock.clearTimeout(this.settleTimerId);
      this.settleTimerId = null;
    }
  }

  private isActive(): boolean {
    return (
      this.state.status === 'settling' ||
      this.state.status === 'running' ||
      this.state.status === 'waiting-for-visibility'
    );
  }

  private elapsedNow(): number {
    return Math.max(0, this.clock.now() - this.startedAt);
  }
}
