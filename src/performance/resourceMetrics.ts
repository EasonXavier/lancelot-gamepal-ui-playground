import type { Measurement, ResourceSnapshot } from './types';

export interface ResourceTimingInput {
  duration: number;
  transferSize?: number;
  decodedBodySize?: number;
}

const sumMeasurableSizes = (
  entries: readonly ResourceTimingInput[],
  field: 'transferSize' | 'decodedBodySize',
): Measurement<number> => {
  if (entries.length === 0) {
    return { status: 'waiting' };
  }
  let total = 0;
  for (const entry of entries) {
    const value = entry[field];
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      return { status: 'not-measurable' };
    }
    total += value;
  }
  return { status: 'available', value: total };
};

export function summarizeResourceEntries(
  entries: readonly ResourceTimingInput[],
): ResourceSnapshot {
  return {
    resourceCount: entries.length,
    totalDuration: entries.reduce(
      (total, entry) =>
        total + (Number.isFinite(entry.duration) ? Math.max(0, entry.duration) : 0),
      0,
    ),
    transferSize: sumMeasurableSizes(entries, 'transferSize'),
    decodedBodySize: sumMeasurableSizes(entries, 'decodedBodySize'),
  };
}
