import type { GlassMode } from '../../experiments/settings';
import { GlassSurface } from '../glass/GlassSurface';
import './home-controls.css';

// eslint-disable-next-line react-refresh/only-export-components
export const services = [
  { name: '趣味单', shape: 'wide' },
  { name: '小时单', shape: 'compact' },
  { name: '自助下单', shape: 'tall' },
  { name: '客服接待', shape: 'compact' },
  { name: '活动专区', shape: 'wide' },
  { name: '全部服务', shape: 'medium' },
] as const;

export type ServiceName = (typeof services)[number]['name'];

interface ServiceGridProps {
  mode: GlassMode;
  onSelect: (service: ServiceName) => void;
}

export function ServiceGrid({ mode, onSelect }: ServiceGridProps) {
  return (
    <section aria-label="服务入口" className="service-grid">
      {services.map((service) => (
        <button
          className={`tap-target service-card service-card--${service.shape}`}
          key={service.name}
          onClick={() => onSelect(service.name)}
          type="button"
        >
          <GlassSurface mode={mode}>{service.name}</GlassSurface>
        </button>
      ))}
    </section>
  );
}
