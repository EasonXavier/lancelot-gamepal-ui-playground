import type { FrameMetrics } from './types';

const validSamples = (values: readonly number[]): number[] =>
  values.filter((value) => Number.isFinite(value) && value > 0);

export function median(values: readonly number[]): number | null {
  const sorted = validSamples(values).toSorted((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower === undefined || upper === undefined ? null : (lower + upper) / 2;
}

export function percentile(values: readonly number[], quantile: number): number | null {
  const sorted = validSamples(values).toSorted((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }

  const boundedQuantile = Math.min(1, Math.max(0, quantile));
  const rank = Math.max(1, Math.ceil(boundedQuantile * sorted.length));
  return sorted[rank - 1] ?? null;
}

export function estimateBaselineFrameTime(intervals: readonly number[]): number | null {
  const samples = validSamples(intervals).filter((interval) => interval <= 1000);
  const lowerQuartile = percentile(samples, 0.25);
  if (lowerQuartile === null) {
    return null;
  }

  const stableWindow = samples.filter((interval) => interval <= lowerQuartile * 1.5);
  return median(stableWindow);
}

export function estimateDroppedFrames(
  intervals: readonly number[],
  baselineFrameTime: number,
): number {
  if (!Number.isFinite(baselineFrameTime) || baselineFrameTime <= 0) {
    return 0;
  }

  return validSamples(intervals).reduce(
    (total, interval) =>
      total + Math.max(0, Math.round(interval / baselineFrameTime) - 1),
    0,
  );
}

export function summarizeFrameIntervals(intervals: readonly number[]): FrameMetrics {
  const samples = validSamples(intervals);
  const baselineFrameTime = estimateBaselineFrameTime(samples);
  const averageFrameTime =
    samples.length === 0
      ? null
      : samples.reduce((total, interval) => total + interval, 0) / samples.length;
  const currentWindow = samples.slice(-30);
  const currentMedian = median(currentWindow);
  const stutterThreshold = baselineFrameTime === null ? null : baselineFrameTime * 2;
  const stutterFrames =
    stutterThreshold === null
      ? 0
      : samples.filter((interval) => interval >= stutterThreshold).length;

  return {
    sampleCount: samples.length,
    baselineFrameTime,
    currentFps: currentMedian === null ? null : 1000 / currentMedian,
    averageFrameTime,
    p95FrameTime: percentile(samples, 0.95),
    maxFrameTime: samples.length === 0 ? null : Math.max(...samples),
    framesOver33: samples.filter((interval) => interval > 33.3).length,
    framesOver50: samples.filter((interval) => interval > 50).length,
    stutterFrameRatio:
      samples.length === 0 || stutterThreshold === null
        ? null
        : stutterFrames / samples.length,
    estimatedDroppedFrames:
      baselineFrameTime === null
        ? 0
        : estimateDroppedFrames(samples, baselineFrameTime),
  };
}
