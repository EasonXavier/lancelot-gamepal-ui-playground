import { useCallback, useMemo, useState } from 'react';
import type { GameId } from './components/navigation/GameRail';
import { HomeScreen } from './experiments/home/HomeScreen';
import {
  useBenchmarkController,
  type BenchmarkReportTerminal,
  type BenchmarkReportType,
  type BenchmarkResultCapture,
} from './hooks/useBenchmarkController';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useViewportHeight } from './hooks/useViewportHeight';
import { useVisibility } from './hooks/useVisibility';
import { usePerformanceRuntime } from './hooks/usePerformanceRuntime';
import {
  type BenchmarkClock,
  type BenchmarkProfile,
} from './performance/benchmarkRunner';
import { BASELINE_MODE_ORDER } from './performance/baselineSuiteRunner';
import { collectEnvironmentInfo } from './performance/environmentInfo';
import {
  createReportActions,
  sanitizePageIdentifier,
  type ReportActionDependencies,
} from './performance/reportActions';
import type {
  ReportRun,
  ReportSnapshot,
  ReportStatus,
} from './performance/reportExporter';
import type { PerformanceRuntime } from './performance/runtime';
import {
  createDefaultSettings,
  loadSettings,
  resetSettings,
  resolveEffectiveSettings,
  saveSettings,
  updateSettings,
  type ExperimentSettings,
} from './experiments/settings';

export interface AppProps {
  benchmarkClock?: BenchmarkClock;
  performanceRuntime?: PerformanceRuntime;
  reportActionDependencies?: ReportActionDependencies;
}

const browserBenchmarkClock: BenchmarkClock = {
  now: () => performance.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (id) => window.clearTimeout(id),
};

export function App({
  benchmarkClock = browserBenchmarkClock,
  performanceRuntime: performanceRuntimeOverride,
  reportActionDependencies,
}: AppProps) {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameId>('delta');
  const [benchmarkProfile, setBenchmarkProfile] = useState<BenchmarkProfile>('idle');
  const [benchmarkSettingsOverride, setBenchmarkSettingsOverride] =
    useState<ExperimentSettings | null>(null);
  const [benchmarkReducedMotionOverride, setBenchmarkReducedMotionOverride] = useState<
    boolean | null
  >(null);
  const systemReducedMotion = useReducedMotion();
  const visible = useVisibility();
  const effectiveSettings = useMemo(
    () => resolveEffectiveSettings(settings, systemReducedMotion),
    [settings, systemReducedMotion],
  );
  const benchmarkEffectiveSettings = benchmarkSettingsOverride ?? effectiveSettings;
  const liveReducedMotionEffective =
    systemReducedMotion || settings.reducedMotionSimulation;
  const reducedMotionEffective =
    benchmarkReducedMotionOverride ?? liveReducedMotionEffective;
  const displayedSettings = useMemo(
    () =>
      applyBenchmarkProfile(
        benchmarkEffectiveSettings,
        benchmarkProfile,
        reducedMotionEffective,
      ),
    [benchmarkEffectiveSettings, benchmarkProfile, reducedMotionEffective],
  );
  const performanceRuntime = usePerformanceRuntime(
    visible && displayedSettings.motionLevel !== 'off',
    performanceRuntimeOverride,
  );
  const [benchmarkReportSnapshot, setBenchmarkReportSnapshot] =
    useState<ReportSnapshot>(() =>
      buildReportSnapshot('single', displayedSettings, systemReducedMotion, 'idle'),
    );
  const startBenchmarkReport = useCallback(
    (reportType: BenchmarkReportType, settingsAtStart: ExperimentSettings) => {
      setBenchmarkReducedMotionOverride(liveReducedMotionEffective);
      setBenchmarkReportSnapshot(
        buildReportSnapshot(
          reportType,
          settingsAtStart,
          systemReducedMotion,
          'running',
        ),
      );
    },
    [liveReducedMotionEffective, systemReducedMotion],
  );
  const captureBenchmarkReport = useCallback((capture: BenchmarkResultCapture) => {
    setBenchmarkReportSnapshot((current) => {
      if (current.reportType !== capture.reportType) return current;
      const run = buildReportRun(capture);
      return {
        ...current,
        benchmark: {
          ...current.benchmark,
          completedModes: [...current.benchmark.completedModes, run.glassMode],
        },
        runs: [...current.runs, run],
      };
    });
  }, []);
  const finishBenchmarkReport = useCallback((terminal: BenchmarkReportTerminal) => {
    setBenchmarkReducedMotionOverride(null);
    setBenchmarkReportSnapshot((current) => {
      if (current.reportType !== terminal.reportType) return current;
      return {
        ...current,
        benchmark: {
          ...current.benchmark,
          status: terminal.status,
          elapsedMs: terminal.elapsedMs,
          completedModes: [...terminal.completedModes],
          interruptions: terminal.interruptions,
          terminatedPhase: terminal.terminatedPhase,
          failureReason: terminal.failureReason,
        },
      };
    });
  }, []);
  const benchmarkController = useBenchmarkController({
    clock: benchmarkClock,
    effectiveSettings,
    panelOpen,
    performanceRuntime,
    selectedGame,
    visible,
    onEffectiveSettingsOverrideChange: setBenchmarkSettingsOverride,
    onPanelOpenChange: setPanelOpen,
    onProfileChange: setBenchmarkProfile,
    onReportStart: startBenchmarkReport,
    onReportTerminal: finishBenchmarkReport,
    onResultCapture: captureBenchmarkReport,
    onSelectedGameChange: setSelectedGame,
  });
  const getReportSnapshot = useCallback(() => {
    if (benchmarkReportSnapshot.benchmark.status !== 'idle') {
      return benchmarkReportSnapshot;
    }
    return {
      ...buildReportSnapshot('single', displayedSettings, systemReducedMotion, 'idle'),
      generatedAt: benchmarkReportSnapshot.generatedAt,
    };
  }, [benchmarkReportSnapshot, displayedSettings, systemReducedMotion]);
  const reportActions = useMemo(
    () => createReportActions(getReportSnapshot, reportActionDependencies),
    [getReportSnapshot, reportActionDependencies],
  );
  useViewportHeight();

  const changeSettings = useCallback((patch: Partial<ExperimentSettings>) => {
    setSettings((current) => {
      const next = updateSettings(current, patch);
      persistSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setBenchmarkReportSnapshot(
      buildReportSnapshot(
        'single',
        createDefaultSettings(),
        systemReducedMotion,
        'idle',
      ),
    );
    setSettings((current) => {
      const next = resetSettings(current);
      persistSettings(next);
      return next;
    });
  }, [systemReducedMotion]);

  return (
    <HomeScreen
      onPanelOpenChange={setPanelOpen}
      onSelectedGameChange={setSelectedGame}
      onSettingsChange={changeSettings}
      onSettingsReset={reset}
      panelOpen={panelOpen}
      effectiveSettings={displayedSettings}
      selectedGame={selectedGame}
      settings={settings}
      visible={visible}
      performanceRuntime={performanceRuntime}
      benchmarkController={benchmarkController}
      reportActions={reportActions}
    />
  );
}

function applyBenchmarkProfile(
  effectiveSettings: ExperimentSettings,
  profile: BenchmarkProfile,
  reducedMotionEffective: boolean,
): ExperimentSettings {
  if (
    reducedMotionEffective ||
    profile === 'idle' ||
    profile === 'warmup' ||
    profile === 'ambient'
  ) {
    return effectiveSettings;
  }
  return {
    ...effectiveSettings,
    motionLevel: 'maximum',
    particleCount: 'maximum',
    backgroundMotion: true,
    touchParallax: true,
    cardFloat: true,
  };
}

function buildReportSnapshot(
  reportType: BenchmarkReportType,
  effectiveSettings: ExperimentSettings,
  systemReducedMotion: boolean,
  status: ReportStatus,
): ReportSnapshot {
  const environment = collectEnvironmentInfo({
    prefersReducedMotion: systemReducedMotion,
  });
  return {
    reportType,
    generatedAt: new Date().toISOString(),
    page: { url: sanitizePageIdentifier(window.location.href) },
    environment: {
      userAgent: environment.userAgent,
      isWeChat: environment.isWeChat,
      operatingSystem: null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      screen: { width: window.screen.width, height: window.screen.height },
      devicePixelRatio: environment.devicePixelRatio,
    },
    benchmark: {
      status,
      order:
        reportType === 'suite'
          ? [...BASELINE_MODE_ORDER]
          : [effectiveSettings.glassMode],
      settleDurationMs: reportType === 'suite' ? 3_000 : 0,
      runDurationMs: 30_000,
      elapsedMs: 0,
      completedModes: [],
      interruptions: 0,
      terminatedPhase: null,
      failureReason: null,
    },
    runs: [],
  };
}

function buildReportRun(capture: BenchmarkResultCapture): ReportRun {
  const { metrics } = capture.performance.frames;
  return {
    glassMode: capture.settings.glassMode,
    settings: { ...capture.settings },
    performance: {
      frames: {
        averageFps: metrics.currentFps,
        p95FrameTime: metrics.p95FrameTime,
        maxFrameTime: metrics.maxFrameTime,
        estimatedDroppedFrames:
          metrics.sampleCount === 0 ? null : metrics.estimatedDroppedFrames,
        framesOver33: metrics.framesOver33,
        framesOver50: metrics.framesOver50,
      },
      webVitals: cloneReportValue(capture.performance.webVitals),
      mainThread: cloneReportValue(capture.performance.mainThread),
      resources: cloneReportValue(capture.performance.resources),
      capabilities: cloneReportValue(capture.performance.capabilities),
    },
    elapsedMs: capture.elapsedMs,
    completedInForeground: capture.completedInForeground,
    eligibleForComparison: capture.eligibleForComparison,
  };
}

function cloneReportValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneReportValue(item)) as T;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneReportValue(item)]),
    ) as T;
  }
  return value;
}

function loadInitialSettings(): ExperimentSettings {
  try {
    return loadSettings(window.localStorage);
  } catch {
    return createDefaultSettings();
  }
}

function persistSettings(settings: ExperimentSettings): void {
  try {
    saveSettings(window.localStorage, settings);
  } catch {
    // The UI remains usable when storage access itself is denied.
  }
}

export default App;
