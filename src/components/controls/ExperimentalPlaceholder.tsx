import type { ServiceName } from './ServiceGrid';
import './home-controls.css';

interface ExperimentalPlaceholderProps {
  service: ServiceName;
  onClose: () => void;
}

export function ExperimentalPlaceholder({
  service,
  onClose,
}: ExperimentalPlaceholderProps) {
  return (
    <div
      aria-labelledby="experimental-service-title"
      aria-modal="true"
      className="experimental-placeholder"
      role="dialog"
    >
      <h2 id="experimental-service-title">{service}</h2>
      <p>Experimental / Mock</p>
      <button className="tap-target" onClick={onClose} type="button">
        关闭
      </button>
    </div>
  );
}
