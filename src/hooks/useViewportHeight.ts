import { useEffect } from 'react';

export function useViewportHeight(): void {
  useEffect(() => {
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--app-height',
        `${window.innerHeight}px`,
      );
    };

    updateHeight();
    window.addEventListener('resize', updateHeight, { passive: true });
    window.addEventListener('orientationchange', updateHeight, { passive: true });

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, []);
}
