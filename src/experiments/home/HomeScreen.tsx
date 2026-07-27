import { useRef, useState } from 'react';
import { ExperimentalPlaceholder } from '../../components/controls/ExperimentalPlaceholder';
import { ExperimentPanel } from '../../components/controls/ExperimentPanel';
import { ServiceGrid, type ServiceName } from '../../components/controls/ServiceGrid';
import { BottomNav, type BottomNavId } from '../../components/navigation/BottomNav';
import { PerformanceHud } from '../../components/performance/PerformanceHud';
import { GameRail, type GameId } from '../../components/navigation/GameRail';
import { ParticleField } from '../motion/ParticleField';
import { useTouchParallax } from '../motion/useTouchParallax';
import type { ExperimentSettings } from '../settings';
import type { PerformanceRuntime } from '../../performance/runtime';
import '../motion/motion.css';
import './home-screen.css';

export interface HomeScreenProps {
  settings: ExperimentSettings;
  effectiveSettings: ExperimentSettings;
  panelOpen: boolean;
  visible: boolean;
  performanceRuntime: PerformanceRuntime;
  onPanelOpenChange: (open: boolean) => void;
  onSettingsChange: (patch: Partial<ExperimentSettings>) => void;
  onSettingsReset: () => void;
}

export function HomeScreen({
  settings,
  effectiveSettings,
  panelOpen,
  visible,
  performanceRuntime,
  onPanelOpenChange,
  onSettingsChange,
  onSettingsReset,
}: HomeScreenProps) {
  const [selectedGame, setSelectedGame] = useState<GameId>('delta');
  const [selectedNav, setSelectedNav] = useState<BottomNavId>('home');
  const [activeService, setActiveService] = useState<ServiceName | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const mode = settings.glassMode;
  const particlePaused =
    !visible ||
    !effectiveSettings.backgroundMotion ||
    effectiveSettings.motionLevel === 'off';

  useTouchParallax(screenRef, effectiveSettings.touchParallax);

  return (
    <main
      className="home-screen"
      data-card-float={effectiveSettings.cardFloat}
      data-glass-mode={mode}
      data-motion-level={effectiveSettings.motionLevel}
      ref={screenRef}
    >
      {effectiveSettings.particleCount !== 0 ? (
        <ParticleField
          count={effectiveSettings.particleCount}
          dprMode={effectiveSettings.dprMode}
          paused={particlePaused}
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
      </header>
      <div className="home-screen__content">
        <GameRail mode={mode} onSelect={setSelectedGame} selectedGame={selectedGame} />
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
        onChange={onSettingsChange}
        onClose={() => onPanelOpenChange(false)}
        onReset={onSettingsReset}
        open={panelOpen}
        settings={settings}
      />
    </main>
  );
}
