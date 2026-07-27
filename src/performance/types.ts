export interface FrameMetrics {
  sampleCount: number;
  baselineFrameTime: number | null;
  currentFps: number | null;
  averageFrameTime: number | null;
  p95FrameTime: number | null;
  maxFrameTime: number | null;
  framesOver33: number;
  framesOver50: number;
  stutterFrameRatio: number | null;
  estimatedDroppedFrames: number;
}

export interface FrameSamplerSnapshot {
  intervals: readonly number[];
  metrics: FrameMetrics;
  isRunning: boolean;
  needsCalibration: boolean;
}

export type Availability =
  | { status: 'available' }
  | { status: 'waiting' }
  | { status: 'unsupported' }
  | { status: 'not-measurable' };
