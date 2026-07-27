import { useEffect, useState } from 'react';

const isVisible = () => document.visibilityState === 'visible';

export function useVisibility(): boolean {
  const [visible, setVisible] = useState(isVisible);

  useEffect(() => {
    const updateVisibility = () => setVisible(isVisible());

    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return visible;
}
