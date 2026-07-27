import type { NavigationSnapshot } from './types';

export interface NavigationTimingInput {
  startTime: number;
  requestStart: number;
  responseStart: number;
  domInteractive: number;
  loadEventEnd: number;
}

const elapsed = (end: number, start: number): number =>
  Number.isFinite(end) && Number.isFinite(start) ? Math.max(0, end - start) : 0;

export function summarizeNavigationTiming(
  entry: NavigationTimingInput | undefined,
  supported: boolean,
): NavigationSnapshot {
  if (!supported) {
    return { status: 'unsupported' };
  }
  if (!entry) {
    return { status: 'waiting' };
  }
  return {
    status: 'available',
    value: {
      ttfb: elapsed(entry.responseStart, entry.startTime),
      requestDuration: elapsed(entry.responseStart, entry.requestStart),
      domInteractive: elapsed(entry.domInteractive, entry.startTime),
      loadEvent: elapsed(entry.loadEventEnd, entry.startTime),
    },
  };
}
