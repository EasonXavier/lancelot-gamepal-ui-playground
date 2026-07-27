import { useCallback, useEffect, useRef, useState } from 'react';

import type { GameId } from '../components/navigation/GameRail';
import type { ExperimentSettings } from '../experiments/settings';
import {
  BenchmarkRunner,
  type BenchmarkClock,
  type BenchmarkContext,
  type BenchmarkProfile,
  type BenchmarkState,
} from '../performance/benchmarkRunner';
import type { PerformanceRuntime } from '../performance/runtime';

export interface BenchmarkController {
  state: BenchmarkState;
  start(): void;
  cancel(): void;
}

interface BenchmarkControllerOptions {
  clock: BenchmarkClock;
  effectiveSettings: ExperimentSettings;
  panelOpen: boolean;
  performanceRuntime: PerformanceRuntime;
  selectedGame: GameId;
  visible: boolean;
  onPanelOpenChange(open: boolean): void;
  onProfileChange(profile: BenchmarkProfile): void;
  onSelectedGameChange(game: GameId): void;
}

export function useBenchmarkController(
  options: BenchmarkControllerOptions,
): BenchmarkController {
  const optionsRef = useRef(options);
  const [runner] = useState(() => new BenchmarkRunner(options.clock));
  const [state, setState] = useState<BenchmarkState>(() => runner.getState());
  const mountedRef = useRef(true);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const syncState = useCallback(() => {
    if (mountedRef.current) {
      setState(runner.getState());
    }
  }, [runner]);

  const [context] = useState<BenchmarkContext>(() => ({
    captureScene: () => {
      const current = optionsRef.current;
      return {
        scrollY: window.scrollY,
        category: current.selectedGame,
        particleCount: current.effectiveSettings.particleCount,
        panelOpen: current.panelOpen,
      };
    },
    restoreScene: (scene) => {
      const current = optionsRef.current;
      current.onSelectedGameChange(scene.category as GameId);
      current.onPanelOpenChange(scene.panelOpen);
      current.onProfileChange('idle');
      window.scrollTo(0, scene.scrollY);
    },
    resetMetrics: () => optionsRef.current.performanceRuntime.reset(),
    setProfile: (profile) => {
      const current = optionsRef.current;
      current.onProfileChange(profile);
      if (profile === 'scroll-transition') {
        current.onPanelOpenChange(false);
        window.scrollTo(0, document.documentElement.scrollHeight);
      } else if (profile === 'summarize') {
        current.onPanelOpenChange(true);
      }
      syncState();
    },
    setSamplingEnabled: (enabled) => {
      const current = optionsRef.current;
      if (enabled) {
        void current.performanceRuntime.start().catch(() => undefined);
        if (current.visible) {
          current.performanceRuntime.resume();
        } else {
          current.performanceRuntime.pause();
        }
        return;
      }
      current.performanceRuntime.pause();
    },
    captureResult: () => optionsRef.current.performanceRuntime.getSnapshot(),
    onComplete: () => syncState(),
  }));

  useEffect(() => {
    runner.setVisibility(options.visible);
    syncState();
  }, [options.visible, runner, syncState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runner.cancel();
    };
  }, [runner]);

  const start = useCallback(() => {
    runner.start(context);
    syncState();
  }, [context, runner, syncState]);

  const cancel = useCallback(() => {
    runner.cancel();
    syncState();
  }, [runner, syncState]);

  return { state, start, cancel };
}
