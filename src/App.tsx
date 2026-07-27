import { useCallback, useMemo, useState } from 'react';
import type { GameId } from './components/navigation/GameRail';
import { HomeScreen } from './experiments/home/HomeScreen';
import { useBenchmarkController } from './hooks/useBenchmarkController';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useViewportHeight } from './hooks/useViewportHeight';
import { useVisibility } from './hooks/useVisibility';
import { usePerformanceRuntime } from './hooks/usePerformanceRuntime';
import {
  type BenchmarkClock,
  type BenchmarkProfile,
} from './performance/benchmarkRunner';
import { collectEnvironmentInfo } from './performance/environmentInfo';
import {
  createReportActions,
  type ReportActionDependencies,
} from './performance/reportActions';
import type { ReportSnapshot } from './performance/reportExporter';
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
  reportActionDependencies?: ReportActionDependencies;
}

const browserBenchmarkClock: BenchmarkClock = {
  now: () => performance.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (id) => window.clearTimeout(id),
};

export function App({
  benchmarkClock = browserBenchmarkClock,
  reportActionDependencies,
}: AppProps) {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameId>('delta');
  const [benchmarkProfile, setBenchmarkProfile] = useState<BenchmarkProfile>('idle');
  const systemReducedMotion = useReducedMotion();
  const visible = useVisibility();
  const effectiveSettings = resolveEffectiveSettings(settings, systemReducedMotion);
  const reducedMotionEffective =
    systemReducedMotion || settings.reducedMotionSimulation;
  const displayedSettings = applyBenchmarkProfile(
    effectiveSettings,
    benchmarkProfile,
    reducedMotionEffective,
  );
  const performanceRuntime = usePerformanceRuntime(
    visible && displayedSettings.motionLevel !== 'off',
  );
  const benchmarkController = useBenchmarkController({
    clock: benchmarkClock,
    effectiveSettings,
    panelOpen,
    performanceRuntime,
    selectedGame,
    visible,
    onPanelOpenChange: setPanelOpen,
    onProfileChange: setBenchmarkProfile,
    onSelectedGameChange: setSelectedGame,
  });
  const getReportSnapshot = useCallback(
    () =>
      buildReportSnapshot(
        displayedSettings,
        performanceRuntime,
        benchmarkController.state.completedInForeground,
        systemReducedMotion,
      ),
    [
      benchmarkController.state.completedInForeground,
      displayedSettings,
      performanceRuntime,
      systemReducedMotion,
    ],
  );
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
    setSettings((current) => {
      const next = resetSettings(current);
      persistSettings(next);
      return next;
    });
  }, []);

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
  effectiveSettings: ExperimentSettings,
  runtime: PerformanceRuntime,
  completedInForeground: boolean | null,
  systemReducedMotion: boolean,
): ReportSnapshot {
  const environment = collectEnvironmentInfo({
    prefersReducedMotion: systemReducedMotion,
  });
  const performanceSnapshot = runtime.getSnapshot();
  const { metrics } = performanceSnapshot.frames;

  return {
    generatedAt: new Date().toISOString(),
    page: { url: currentPageUrl() },
    environment: {
      userAgent: environment.userAgent,
      isWeChat: environment.isWeChat,
      operatingSystem: null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      screen: { width: window.screen.width, height: window.screen.height },
      devicePixelRatio: environment.devicePixelRatio,
    },
    settings: effectiveSettings,
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
      webVitals: performanceSnapshot.webVitals,
      mainThread: performanceSnapshot.mainThread,
      resources: performanceSnapshot.resources,
      capabilities: performanceSnapshot.capabilities,
    },
    benchmark: { completedInForeground },
  };
}

function currentPageUrl(): string {
  const pageUrl = new URL(window.location.href);
  pageUrl.search = '';
  pageUrl.hash = '';
  return pageUrl.href;
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
