import { useRef, useState, type CSSProperties } from 'react';
import { ExperimentalPlaceholder } from '../../components/controls/ExperimentalPlaceholder';
import { ExperimentPanel } from '../../components/controls/ExperimentPanel';
import { ServiceGrid, type ServiceName } from '../../components/controls/ServiceGrid';
import { BottomNav, type BottomNavId } from '../../components/navigation/BottomNav';
import { PerformanceHud } from '../../components/performance/PerformanceHud';
import { GameRail, type GameId } from '../../components/navigation/GameRail';
import { ParticleField } from '../motion/ParticleField';
import { MOTION_PROFILES } from '../motion/motionProfiles';
import { useTouchParallax } from '../motion/useTouchParallax';
import type { ExperimentSettings } from '../settings';
import type { BenchmarkController } from '../../hooks/useBenchmarkController';
import type { ReportActions } from '../../performance/reportActions';
import type { PerformanceRuntime } from '../../performance/runtime';
import '../motion/motion.css';
import './home-screen.css';

export interface HomeScreenProps {
  settings: ExperimentSettings;
  effectiveSettings: ExperimentSettings;
  panelOpen: boolean;
  selectedGame: GameId;
  visible: boolean;
  benchmarkController: BenchmarkController;
  performanceRuntime: PerformanceRuntime;
  reportActions: ReportActions;
  onPanelOpenChange: (open: boolean) => void;
  onSelectedGameChange: (game: GameId) => void;
  onSettingsChange: (patch: Partial<ExperimentSettings>) => void;
  onSettingsReset: () => void;
}

export function HomeScreen({
  settings,
  effectiveSettings,
  panelOpen,
  selectedGame,
  visible,
  benchmarkController,
  performanceRuntime,
  reportActions,
  onPanelOpenChange,
  onSelectedGameChange,
  onSettingsChange,
  onSettingsReset,
}: HomeScreenProps) {
  const [selectedNav, setSelectedNav] = useState<BottomNavId>('home');
  const [activeService, setActiveService] = useState<ServiceName | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const mode = settings.glassMode;
  const motionProfile = MOTION_PROFILES[effectiveSettings.motionLevel];
  const motionEnabled = effectiveSettings.motionLevel !== 'off';
  const particlePaused =
    !visible || !effectiveSettings.backgroundMotion || !motionEnabled;

  useTouchParallax(
    screenRef,
    effectiveSettings.touchParallax && motionEnabled,
    motionProfile.parallaxAmplitudePx,
  );

  return (
    <main
      className="home-screen"
      data-card-float={effectiveSettings.cardFloat && motionEnabled}
      data-glass-mode={mode}
      data-motion-level={effectiveSettings.motionLevel}
      data-particle-count={String(effectiveSettings.particleCount)}
      ref={screenRef}
      style={
        {
          '--card-float-distance': `${motionProfile.cardFloatDistancePx}px`,
          '--card-float-duration': `${motionProfile.cardFloatDurationMs}ms`,
        } as CSSProperties
      }
    >
      {effectiveSettings.particleCount !== 0 ? (
        <ParticleField
          count={effectiveSettings.particleCount}
          dprMode={effectiveSettings.dprMode}
          paused={particlePaused}
          speedMultiplier={motionProfile.particleSpeedMultiplier}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="home-screen__character"
        data-testid="character-layer"
      />
      <header className="home-screen__header">
        <span aria-hidden="true" className="home-screen__mark">
          L
        </span>
        <span className="home-screen__brand">朗世乐</span>
        <button
          aria-expanded={panelOpen}
          className="tap-target home-screen__experiment-toggle"
          onClick={() => onPanelOpenChange(!panelOpen)}
          type="button"
        >
          实验控制
        </button>
        {benchmarkController.state.status === 'running' && !panelOpen ? (
          <button
            className="tap-target home-screen__experiment-toggle"
            onClick={benchmarkController.cancel}
            type="button"
          >
            取消 Benchmark
          </button>
        ) : null}
      </header>
      <div className="home-screen__content">
        <GameRail
          mode={mode}
          onSelect={onSelectedGameChange}
          selectedGame={selectedGame}
        />
        <ServiceGrid mode={mode} onSelect={setActiveService} />
      </div>
      <BottomNav mode={mode} onSelect={setSelectedNav} selectedItem={selectedNav} />
      <PerformanceHud mode={effectiveSettings.hudMode} runtime={performanceRuntime} />
      {activeService ? (
        <ExperimentalPlaceholder
          onClose={() => setActiveService(null)}
          service={activeService}
        />
      ) : null}
      <ExperimentPanel
        benchmarkController={benchmarkController}
        onChange={onSettingsChange}
        onClose={() => onPanelOpenChange(false)}
        onReset={onSettingsReset}
        open={panelOpen}
        reportActions={reportActions}
        settings={settings}
      />
    </main>
  );
}
