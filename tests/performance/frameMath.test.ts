import { describe, expect, it } from 'vitest';

import {
  estimateBaselineFrameTime,
  estimateDroppedFrames,
  median,
  percentile,
  summarizeFrameIntervals,
} from '../../src/performance/frameMath';

describe('frame math', () => {
  it('returns null for statistics without valid samples', () => {
    expect(median([])).toBeNull();
    expect(percentile([], 0.95)).toBeNull();
    expect(
      estimateBaselineFrameTime([0, Number.NaN, Number.POSITIVE_INFINITY]),
    ).toBeNull();
  });

  it('calculates odd and even medians without mutating the source', () => {
    const even = [16, 4, 12, 8];

    expect(median([16, 4, 8])).toBe(8);
    expect(median(even)).toBe(10);
    expect(even).toEqual([16, 4, 12, 8]);
  });

  it('uses nearest-rank percentiles from hand-checked samples', () => {
    expect(percentile([50, 10, 30, 20, 40], 0.95)).toBe(50);
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20);
  });

  it('estimates the display baseline from the measured interval median', () => {
    expect(estimateBaselineFrameTime([8.4, 8.3, 8.5, 8.2, 8.3])).toBe(8.3);
    expect(estimateBaselineFrameTime([16.7, 16.6, 16.8])).toBe(16.7);
  });

  it('estimates dropped frames relative to the measured baseline', () => {
    expect(estimateDroppedFrames([8.3, 16.6, 25, 50], 8.3)).toBe(8);
    expect(estimateDroppedFrames([16.7, 16.8], 0)).toBe(0);
  });

  it('summarizes long frames and stutter without assuming 60 Hz', () => {
    const metrics = summarizeFrameIntervals([8, 8, 8, 16, 40, 60]);

    expect(metrics.sampleCount).toBe(6);
    expect(metrics.baselineFrameTime).toBe(8);
    expect(metrics.averageFrameTime).toBeCloseTo(23.333, 3);
    expect(metrics.p95FrameTime).toBe(60);
    expect(metrics.maxFrameTime).toBe(60);
    expect(metrics.framesOver33).toBe(2);
    expect(metrics.framesOver50).toBe(1);
    expect(metrics.stutterFrameRatio).toBeCloseTo(0.5, 5);
    expect(metrics.estimatedDroppedFrames).toBe(12);
  });
});
