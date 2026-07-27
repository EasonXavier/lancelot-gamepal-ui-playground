import { useEffect, useState } from 'react';
import {
  createPerformanceRuntime,
  type PerformanceRuntime,
} from '../performance/runtime';

export function usePerformanceRuntime(active: boolean): PerformanceRuntime {
  const [runtime] = useState<PerformanceRuntime>(createPerformanceRuntime);

  useEffect(() => {
    return () => runtime.stop();
  }, [runtime]);

  useEffect(() => {
    if (active) {
      void runtime.start().catch(() => undefined);
      runtime.resume();
    } else {
      runtime.pause();
    }
  }, [active, runtime]);

  return runtime;
}
