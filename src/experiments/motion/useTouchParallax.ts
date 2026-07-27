import { useEffect, useRef, type RefObject } from 'react';

export function useTouchParallax(
  target: RefObject<HTMLElement | null>,
  enabled: boolean,
  amplitudePx: number,
): void {
  const frameRef = useRef<number | null>(null);
  const coordinatesRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = target.current;
    if (!element) return undefined;

    if (!enabled) {
      element.style.removeProperty('--parallax-x');
      element.style.removeProperty('--parallax-y');
      return undefined;
    }

    const scheduleWrite = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        const { x, y } = coordinatesRef.current;
        element.style.setProperty('--parallax-x', String(x));
        element.style.setProperty('--parallax-y', String(y));
        frameRef.current = null;
      });
    };

    const updateCoordinates = (clientX: number, clientY: number) => {
      const bounds = element.getBoundingClientRect();
      coordinatesRef.current = {
        x: clamp((clientX - bounds.left) / bounds.width - 0.5) * amplitudePx,
        y: clamp((clientY - bounds.top) / bounds.height - 0.5) * amplitudePx,
      };
      scheduleWrite();
    };

    const onPointerMove = (event: PointerEvent) =>
      updateCoordinates(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updateCoordinates(touch.clientX, touch.clientY);
    };

    element.addEventListener('pointermove', onPointerMove, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('touchmove', onTouchMove);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [amplitudePx, enabled, target]);
}

const clamp = (value: number) => Math.max(-0.5, Math.min(0.5, value));
