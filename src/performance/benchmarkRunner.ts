import type { ParticleCount } from '../experiments/settings';

export type BenchmarkPhase =
  | 'warmup'
  | 'ambient'
  | 'stress'
  | 'scroll-transition'
  | 'summarize';
export type BenchmarkProfile = BenchmarkPhase | 'idle';
export type BenchmarkStatus = 'idle' | 'running' | 'completed' | 'cancelled';

export interface BenchmarkSceneState {
  scrollY: number;
  category: string;
  particleCount: ParticleCount;
  panelOpen: boolean;
}

export interface BenchmarkClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(id: number): void;
}

export interface BenchmarkContext {
  captureScene(): BenchmarkSceneState;
  restoreScene(scene: BenchmarkSceneState): void;
  resetMetrics(): void;
  setProfile(profile: BenchmarkProfile): void;
  setSamplingEnabled(enabled: boolean): void;
  captureResult(): unknown;
  onComplete(result: unknown, completedInForeground: boolean): void;
}

export interface BenchmarkState {
  status: BenchmarkStatus;
  phase: BenchmarkPhase | null;
  elapsedMs: number;
  completedInForeground: boolean | null;
}

const phases: ReadonlyArray<{ phase: BenchmarkPhase; durationMs: number }> = [
  { phase: 'warmup', durationMs: 3_000 },
  { phase: 'ambient', durationMs: 8_000 },
  { phase: 'stress', durationMs: 8_000 },
  { phase: 'scroll-transition', durationMs: 8_000 },
  { phase: 'summarize', durationMs: 3_000 },
];

export class BenchmarkRunner {
  private context: BenchmarkContext | null = null;
  private originalScene: BenchmarkSceneState | null = null;
  private timerId: number | null = null;
  private phaseIndex = -1;
  private startedAt = 0;
  private state: BenchmarkState = {
    status: 'idle',
    phase: null,
    elapsedMs: 0,
    completedInForeground: null,
  };

  constructor(private readonly clock: BenchmarkClock) {}

  start(context: BenchmarkContext): void {
    if (this.state.status === 'running') {
      return;
    }
    this.context = context;
    this.originalScene = context.captureScene();
    this.startedAt = this.clock.now();
    this.phaseIndex = 0;
    this.state = {
      status: 'running',
      phase: phases[0]?.phase ?? null,
      elapsedMs: 0,
      completedInForeground: true,
    };
    context.resetMetrics();
    context.setSamplingEnabled(true);
    this.enterCurrentPhase();
  }

  cancel(): void {
    if (this.state.status !== 'running') {
      return;
    }
    this.clearTimer();
    this.state = {
      ...this.state,
      status: 'cancelled',
      phase: null,
      elapsedMs: this.elapsedNow(),
    };
    this.restoreSceneAndStopSampling();
  }

  setVisibility(visible: boolean): void {
    if (this.state.status !== 'running' || !this.context) {
      return;
    }
    if (!visible) {
      this.state = { ...this.state, completedInForeground: false };
    }
    this.context.setSamplingEnabled(visible);
  }

  getState(): BenchmarkState {
    if (this.state.status !== 'running') {
      return { ...this.state };
    }
    return { ...this.state, elapsedMs: this.elapsedNow() };
  }

  private enterCurrentPhase(): void {
    const current = phases[this.phaseIndex];
    if (!current || !this.context) {
      this.complete();
      return;
    }
    this.state = { ...this.state, phase: current.phase };
    this.context.setProfile(current.phase);
    this.timerId = this.clock.setTimeout(
      this.advancePhase,
      current.durationMs,
    );
  }

  private readonly advancePhase = (): void => {
    this.timerId = null;
    this.phaseIndex += 1;
    this.enterCurrentPhase();
  };

  private complete(): void {
    const context = this.context;
    if (!context) {
      return;
    }
    const result = context.captureResult();
    const completedInForeground =
      this.state.completedInForeground === true;
    this.state = {
      status: 'completed',
      phase: null,
      elapsedMs: 30_000,
      completedInForeground,
    };
    this.restoreSceneAndStopSampling();
    context.onComplete(result, completedInForeground);
  }

  private restoreSceneAndStopSampling(): void {
    if (this.context) {
      if (this.originalScene) {
        this.context.restoreScene(this.originalScene);
      }
      this.context.setProfile('idle');
      this.context.setSamplingEnabled(false);
    }
    this.context = null;
    this.originalScene = null;
  }

  private elapsedNow(): number {
    return Math.min(30_000, Math.max(0, this.clock.now() - this.startedAt));
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      this.clock.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
