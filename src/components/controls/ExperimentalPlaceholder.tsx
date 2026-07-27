import { useEffect, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const activeElement = document.activeElement;
    const opener = activeElement instanceof HTMLElement ? activeElement : null;

    if (!dialog) return;

    dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      aria-labelledby="experimental-service-title"
      aria-modal="true"
      className="experimental-placeholder"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <h2 id="experimental-service-title">{service}</h2>
      <p>Experimental / Mock</p>
      <button
        className="tap-target experimental-placeholder__close"
        onClick={onClose}
        ref={closeButtonRef}
        type="button"
      >
        关闭
      </button>
    </dialog>
  );
}
