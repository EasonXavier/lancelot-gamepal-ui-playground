import { useEffect, useState } from 'react';
import {
  createPerformanceRuntime,
  type PerformanceRuntime,
} from '../performance/runtime';

export function usePerformanceRuntime(
  active: boolean,
  runtimeOverride?: PerformanceRuntime,
): PerformanceRuntime {
  const [ownedRuntime] = useState<PerformanceRuntime>(createPerformanceRuntime);
  const runtime = runtimeOverride ?? ownedRuntime;

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
