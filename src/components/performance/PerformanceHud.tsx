import { useSyncExternalStore } from 'react';
import type { HudMode } from '../../experiments/settings';
import type { PerformanceRuntime } from '../../performance/runtime';
import type { Measurement } from '../../performance/types';
import { GlassSurface } from '../glass/GlassSurface';
import './performance-hud.css';

export interface PerformanceHudProps {
  mode: HudMode;
  workloadLocked: boolean;
  runtime: PerformanceRuntime;
  onModeChange: (mode: HudMode) => void;
}

const statusLabel = {
  waiting: '\u7B49\u5F85',
  unsupported: '\u4E0D\u652F\u6301',
  'not-measurable': '\u4E0D\u53EF\u6D4B',
} as const;

function durationValue(
  measurement: Measurement<{ maxDuration: number }>,
  digits = 0,
): string {
  return measurement.status === 'available'
    ? measurement.value.maxDuration.toFixed(digits)
    : statusLabel[measurement.status];
}

function vitalValue(measurement: Measurement<{ value: number }>, digits = 0): string {
  return measurement.status === 'available'
    ? measurement.value.value.toFixed(digits)
    : statusLabel[measurement.status];
}

function frameValue(value: number | null, digits = 0): string {
  return value === null ? statusLabel.waiting : value.toFixed(digits);
}

export function PerformanceHud({
  mode,
  workloadLocked,
  runtime,
  onModeChange,
}: PerformanceHudProps) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );

  if (mode === 'hidden') {
    return null;
  }

  const { frames, mainThread, resources, webVitals } = snapshot;
  const compactMetrics = [
    ['FPS', frameValue(frames.metrics.currentFps)],
    ['P95', frameValue(frames.metrics.p95FrameTime)],
  ];
  const expandedMetrics = [
    ['Max frame', frameValue(frames.metrics.maxFrameTime)],
    [
      'Dropped frames',
      frames.metrics.sampleCount === 0
        ? statusLabel.waiting
        : String(frames.metrics.estimatedDroppedFrames),
    ],
    ['LCP', vitalValue(webVitals.lcp)],
    ['CLS', vitalValue(webVitals.cls, 3)],
    ['INP', vitalValue(webVitals.inp)],
    ['Long task', durationValue(mainThread.longTasks, 0)],
    ['LoAF', durationValue(mainThread.longAnimationFrames, 0)],
    ['Resources', String(resources.resourceCount)],
  ];
  const metrics = compactMetrics.concat(mode === 'expanded' ? expandedMetrics : []);

  return (
    <button
      aria-expanded={mode === 'expanded'}
      aria-label="Performance HUD"
      className={`performance-hud performance-hud--${mode}`}
      disabled={workloadLocked}
      onClick={() => onModeChange(mode === 'expanded' ? 'compact' : 'expanded')}
      type="button"
    >
      <GlassSurface className="performance-hud__surface" mode="real">
        {metrics.map(([label, value]) => (
          <div className="performance-hud__metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </GlassSurface>
    </button>
  );
}
