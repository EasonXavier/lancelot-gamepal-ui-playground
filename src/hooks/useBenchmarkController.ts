import { useCallback, useEffect, useRef, useState } from 'react';

import type { GameId } from '../components/navigation/GameRail';
import type { ExperimentSettings, GlassMode } from '../experiments/settings';
import {
  BaselineSuiteRunner,
  type BaselineSuiteContext,
  type BaselineSuiteFailureReason,
  type BaselineSuiteState,
  type BaselineSuiteStatus,
} from '../performance/baselineSuiteRunner';
import {
  BenchmarkRunner,
  type BenchmarkClock,
  type BenchmarkContext,
  type BenchmarkPhase,
  type BenchmarkProfile,
  type BenchmarkState,
} from '../performance/benchmarkRunner';
import type { PerformanceRuntime, PerformanceSnapshot } from '../performance/runtime';

export type BenchmarkReportType = 'single' | 'suite';

export interface BenchmarkResultCapture {
  reportType: BenchmarkReportType;
  settings: ExperimentSettings;
  performance: PerformanceSnapshot;
  elapsedMs: number;
  completedInForeground: boolean;
  eligibleForComparison: boolean;
}

export interface BenchmarkReportTerminal {
  reportType: BenchmarkReportType;
  status: 'completed' | 'cancelled' | 'failed';
  elapsedMs: number;
  completedModes: GlassMode[];
  interruptions: number;
  terminatedPhase:
    BenchmarkPhase | 'settling' | 'running' | 'waiting-for-visibility' | null;
  failureReason: BaselineSuiteFailureReason | null;
}

export interface BenchmarkController {
  state: BenchmarkState;
  suiteState: BaselineSuiteState;
  workloadLocked: boolean;
  start(): void;
  cancel(): void;
  startSuite(): void;
  cancelSuite(): void;
}

interface BenchmarkControllerOptions {
  clock: BenchmarkClock;
  effectiveSettings: ExperimentSettings;
  panelOpen: boolean;
  performanceRuntime: PerformanceRuntime;
  selectedGame: GameId;
  visible: boolean;
  onEffectiveSettingsOverrideChange(settings: ExperimentSettings | null): void;
  onPanelOpenChange(open: boolean): void;
  onProfileChange(profile: BenchmarkProfile): void;
  onReportStart(reportType: BenchmarkReportType, settings: ExperimentSettings): void;
  onReportTerminal(terminal: BenchmarkReportTerminal): void;
  onResultCapture(capture: BenchmarkResultCapture): void;
  onSelectedGameChange(game: GameId): void;
}

type ActiveBaselineSuiteStatus = 'settling' | 'running' | 'waiting-for-visibility';

const isSuiteActive = (
  status: BaselineSuiteStatus,
): status is ActiveBaselineSuiteStatus =>
  status === 'settling' || status === 'running' || status === 'waiting-for-visibility';

const copySettings = (settings: ExperimentSettings): ExperimentSettings => ({
  ...settings,
});

export function useBenchmarkController(
  options: BenchmarkControllerOptions,
): BenchmarkController {
  const optionsRef = useRef(options);
  const singleSettingsRef = useRef<ExperimentSettings>(
    copySettings(options.effectiveSettings),
  );
  const suiteSettingsRef = useRef<ExperimentSettings>(
    copySettings(options.effectiveSettings),
  );
  const suiteRunSettingsRef = useRef<ExperimentSettings>(
    copySettings(options.effectiveSettings),
  );
  const singleTerminalReportedRef = useRef(false);
  const suiteTerminalReportedRef = useRef(false);
  const [runner] = useState(() => new BenchmarkRunner(options.clock));
  const [suiteRunner] = useState(() => new BaselineSuiteRunner(options.clock));
  const [state, setState] = useState<BenchmarkState>(() => runner.getState());
  const [suiteState, setSuiteState] = useState<BaselineSuiteState>(() =>
    suiteRunner.getState(),
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const syncState = useCallback(() => {
    if (mountedRef.current) {
      setState(runner.getState());
      setSuiteState(suiteRunner.getState());
    }
  }, [runner, suiteRunner]);

  const restoreSuiteSettings = useCallback(() => {
    optionsRef.current.onEffectiveSettingsOverrideChange(null);
  }, []);

  const reportSuiteTerminal = useCallback(
    (terminatedPhase: ActiveBaselineSuiteStatus | null) => {
      const currentState = suiteRunner.getState();
      if (
        suiteTerminalReportedRef.current ||
        (currentState.status !== 'completed' &&
          currentState.status !== 'cancelled' &&
          currentState.status !== 'failed')
      ) {
        return;
      }
      suiteTerminalReportedRef.current = true;
      restoreSuiteSettings();
      optionsRef.current.onReportTerminal({
        reportType: 'suite',
        status: currentState.status,
        elapsedMs: currentState.elapsedMs,
        completedModes: currentState.runs.map(({ mode }) => mode),
        interruptions: currentState.interruptions,
        terminatedPhase,
        failureReason: currentState.failureReason,
      });
    },
    [restoreSuiteSettings, suiteRunner],
  );

  const restoreScene = useCallback(
    (scene: ReturnType<BenchmarkContext['captureScene']>) => {
      const current = optionsRef.current;
      current.onSelectedGameChange(scene.category as GameId);
      current.onPanelOpenChange(scene.panelOpen);
      current.onProfileChange('idle');
      window.scrollTo(0, scene.scrollY);
    },
    [],
  );

  const setProfile = useCallback(
    (profile: BenchmarkProfile) => {
      const current = optionsRef.current;
      current.onProfileChange(profile);
      if (profile === 'scroll-transition') {
        current.onPanelOpenChange(false);
        window.scrollTo(0, document.documentElement.scrollHeight);
      } else if (profile === 'summarize') {
        current.onPanelOpenChange(true);
      }
      syncState();
    },
    [syncState],
  );

  const setSamplingEnabled = useCallback((enabled: boolean) => {
    const current = optionsRef.current;
    if (enabled) {
      void current.performanceRuntime.start().catch(() => undefined);
      if (current.visible) {
        current.performanceRuntime.resume();
      } else {
        current.performanceRuntime.pause();
      }
      return;
    }
    current.performanceRuntime.pause();
  }, []);

  const [singleContext] = useState<BenchmarkContext>(() => ({
    captureScene: () => {
      const current = optionsRef.current;
      return {
        scrollY: window.scrollY,
        category: current.selectedGame,
        particleCount: singleSettingsRef.current.particleCount,
        panelOpen: current.panelOpen,
      };
    },
    restoreScene,
    resetMetrics: () => optionsRef.current.performanceRuntime.reset(),
    setProfile,
    setSamplingEnabled,
    captureResult: () => optionsRef.current.performanceRuntime.getSnapshot(),
    onComplete: (result, completedInForeground) => {
      const currentState = runner.getState();
      const settings = copySettings(singleSettingsRef.current);
      optionsRef.current.onResultCapture({
        reportType: 'single',
        settings,
        performance: result as PerformanceSnapshot,
        elapsedMs: currentState.elapsedMs,
        completedInForeground,
        eligibleForComparison: completedInForeground,
      });
      if (!singleTerminalReportedRef.current) {
        singleTerminalReportedRef.current = true;
        optionsRef.current.onReportTerminal({
          reportType: 'single',
          status: 'completed',
          elapsedMs: currentState.elapsedMs,
          completedModes: [settings.glassMode],
          interruptions: 0,
          terminatedPhase: null,
          failureReason: null,
        });
      }
      syncState();
    },
  }));

  const [suiteContext] = useState<BaselineSuiteContext>(() => ({
    captureScene: () => {
      const current = optionsRef.current;
      return {
        scrollY: window.scrollY,
        category: current.selectedGame,
        particleCount: suiteSettingsRef.current.particleCount,
        panelOpen: current.panelOpen,
      };
    },
    restoreScene,
    resetMetrics: () => optionsRef.current.performanceRuntime.reset(),
    setProfile,
    setSamplingEnabled,
    captureResult: () => optionsRef.current.performanceRuntime.getSnapshot(),
    setGlassMode: (glassMode) => {
      const settings = { ...suiteSettingsRef.current, glassMode };
      suiteRunSettingsRef.current = settings;
      optionsRef.current.onEffectiveSettingsOverrideChange(copySettings(settings));
      syncState();
    },
    onComplete: (result, completedInForeground) => {
      const currentState = suiteRunner.getState();
      const completedRun = currentState.runs.at(-1);
      const settings = {
        ...suiteRunSettingsRef.current,
        glassMode: completedRun?.mode ?? suiteRunSettingsRef.current.glassMode,
      };
      optionsRef.current.onResultCapture({
        reportType: 'suite',
        settings,
        performance: result as PerformanceSnapshot,
        elapsedMs: 30_000,
        completedInForeground,
        eligibleForComparison: completedInForeground,
      });
      reportSuiteTerminal(null);
      syncState();
    },
  }));

  useEffect(() => {
    const currentSuiteState = suiteRunner.getState();
    if (isSuiteActive(currentSuiteState.status)) {
      const terminatedPhase = currentSuiteState.status;
      suiteRunner.setVisibility(options.visible);
      reportSuiteTerminal(terminatedPhase);
    } else {
      runner.setVisibility(options.visible);
    }
    syncState();
  }, [options.visible, reportSuiteTerminal, runner, suiteRunner, syncState]);

  useEffect(() => {
    const failForOrientationChange = () => {
      const currentState = suiteRunner.getState();
      if (!isSuiteActive(currentState.status)) return;
      suiteRunner.failOrientationChange();
      reportSuiteTerminal(currentState.status);
      syncState();
    };
    window.addEventListener('orientationchange', failForOrientationChange);
    return () =>
      window.removeEventListener('orientationchange', failForOrientationChange);
  }, [reportSuiteTerminal, suiteRunner, syncState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const suiteWasActive = isSuiteActive(suiteRunner.getState().status);
      runner.cancel();
      suiteRunner.cancel();
      if (suiteWasActive) {
        restoreSuiteSettings();
      }
    };
  }, [restoreSuiteSettings, runner, suiteRunner]);

  const start = useCallback(() => {
    if (
      runner.getState().status === 'running' ||
      isSuiteActive(suiteRunner.getState().status)
    ) {
      return;
    }
    const settings = copySettings(optionsRef.current.effectiveSettings);
    singleSettingsRef.current = settings;
    singleTerminalReportedRef.current = false;
    optionsRef.current.onReportStart('single', copySettings(settings));
    runner.start(singleContext);
    syncState();
  }, [runner, singleContext, suiteRunner, syncState]);

  const cancel = useCallback(() => {
    const currentState = runner.getState();
    if (currentState.status !== 'running') return;
    runner.cancel();
    if (!singleTerminalReportedRef.current) {
      singleTerminalReportedRef.current = true;
      optionsRef.current.onReportTerminal({
        reportType: 'single',
        status: 'cancelled',
        elapsedMs: runner.getState().elapsedMs,
        completedModes: [],
        interruptions: 0,
        terminatedPhase: currentState.phase,
        failureReason: null,
      });
    }
    syncState();
  }, [runner, syncState]);

  const startSuite = useCallback(() => {
    if (
      runner.getState().status === 'running' ||
      isSuiteActive(suiteRunner.getState().status)
    ) {
      return;
    }
    const settings = copySettings(optionsRef.current.effectiveSettings);
    suiteSettingsRef.current = settings;
    suiteRunSettingsRef.current = settings;
    suiteTerminalReportedRef.current = false;
    optionsRef.current.onReportStart('suite', copySettings(settings));
    suiteRunner.start(suiteContext);
    syncState();
  }, [runner, suiteContext, suiteRunner, syncState]);

  const cancelSuite = useCallback(() => {
    const currentState = suiteRunner.getState();
    if (!isSuiteActive(currentState.status)) return;
    suiteRunner.cancel();
    reportSuiteTerminal(currentState.status);
    syncState();
  }, [reportSuiteTerminal, suiteRunner, syncState]);

  return {
    state,
    suiteState,
    workloadLocked: state.status === 'running' || isSuiteActive(suiteState.status),
    start,
    cancel,
    startSuite,
    cancelSuite,
  };
}
