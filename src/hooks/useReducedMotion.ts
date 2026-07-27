import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getPreference = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? false
    : window.matchMedia(QUERY).matches;

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(getPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(QUERY);
    const updatePreference = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);

    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
}
