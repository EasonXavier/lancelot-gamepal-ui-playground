import { useState } from 'react';
import { ExperimentalPlaceholder } from '../../components/controls/ExperimentalPlaceholder';
import { ServiceGrid, type ServiceName } from '../../components/controls/ServiceGrid';
import { BottomNav, type BottomNavId } from '../../components/navigation/BottomNav';
import { GameRail, type GameId } from '../../components/navigation/GameRail';
import type { ExperimentSettings } from '../settings';
import './home-screen.css';

export function HomeScreen({ settings }: { settings: ExperimentSettings }) {
  const [selectedGame, setSelectedGame] = useState<GameId>('delta');
  const [selectedNav, setSelectedNav] = useState<BottomNavId>('home');
  const [activeService, setActiveService] = useState<ServiceName | null>(null);
  const mode = settings.glassMode;

  return (
    <main className="home-screen">
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
      </header>
      <div className="home-screen__content">
        <GameRail mode={mode} onSelect={setSelectedGame} selectedGame={selectedGame} />
        <ServiceGrid mode={mode} onSelect={setActiveService} />
      </div>
      <BottomNav mode={mode} onSelect={setSelectedNav} selectedItem={selectedNav} />
      {activeService ? (
        <ExperimentalPlaceholder
          onClose={() => setActiveService(null)}
          service={activeService}
        />
      ) : null}
    </main>
  );
}
