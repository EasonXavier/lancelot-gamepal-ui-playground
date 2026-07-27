import type { GlassMode } from '../../experiments/settings';
import { GlassSurface } from '../glass/GlassSurface';
import '../controls/home-controls.css';

// eslint-disable-next-line react-refresh/only-export-components
export const games = [
  { id: 'delta', label: '三角洲行动' },
  { id: 'cs2', label: 'CS2' },
  { id: 'valorant', label: 'Valorant' },
  { id: 'steam', label: 'Steam 游戏' },
] as const;

export type GameId = (typeof games)[number]['id'];

interface GameRailProps {
  mode: GlassMode;
  selectedGame: GameId;
  onSelect: (game: GameId) => void;
}

export function GameRail({ mode, selectedGame, onSelect }: GameRailProps) {
  return (
    <nav aria-label="游戏切换" className="game-rail">
      {games.map((game) => {
        const selected = game.id === selectedGame;

        return (
          <button
            aria-pressed={selected}
            className="tap-target game-rail__item"
            key={game.id}
            onClick={() => onSelect(game.id)}
            type="button"
          >
            <GlassSurface mode={mode} selected={selected}>
              {selected ? (
                <svg aria-hidden="true" data-testid="game-logo" viewBox="0 0 24 24">
                  <path d="M12 3 21 19h-6l-3-6-3 6H3L12 3Z" fill="currentColor" />
                </svg>
              ) : null}
              {game.label}
            </GlassSurface>
          </button>
        );
      })}
    </nav>
  );
}
