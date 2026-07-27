import type { GlassMode } from '../../experiments/settings';
import { GlassSurface } from '../glass/GlassSurface';
import '../controls/home-controls.css';

// eslint-disable-next-line react-refresh/only-export-components
export const bottomItems = [
  { id: 'home', label: '首页' },
  { id: 'select', label: '挑选' },
  { id: 'orders', label: '订单' },
  { id: 'messages', label: '消息' },
  { id: 'profile', label: '我的' },
] as const;

export type BottomNavId = (typeof bottomItems)[number]['id'];

interface BottomNavProps {
  mode: GlassMode;
  selectedItem: BottomNavId;
  onSelect: (item: BottomNavId) => void;
}

export function BottomNav({ mode, selectedItem, onSelect }: BottomNavProps) {
  return (
    <nav aria-label="主要导航" className="bottom-nav">
      {bottomItems.map((item) => {
        const selected = item.id === selectedItem;

        return (
          <button
            aria-current={selected ? 'page' : undefined}
            className="tap-target bottom-nav__item"
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <GlassSurface mode={mode} selected={selected}>
              {item.label}
            </GlassSurface>
          </button>
        );
      })}
    </nav>
  );
}
