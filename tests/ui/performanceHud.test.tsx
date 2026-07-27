import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PerformanceHud } from '../../src/components/performance/PerformanceHud';
import type {
  PerformanceRuntime,
  PerformanceSnapshot,
} from '../../src/performance/runtime';

const baseSnapshot: PerformanceSnapshot = {
  frames: {
    intervals: [16, 17],
    isRunning: true,
    needsCalibration: false,
    metrics: {
      sampleCount: 2,
      baselineFrameTime: 16,
      currentFps: 60,
      averageFrameTime: 16.5,
      p95FrameTime: 17,
      maxFrameTime: 17,
      framesOver33: 0,
      framesOver50: 0,
      stutterFrameRatio: 0,
      estimatedDroppedFrames: 1,
    },
  },
  webVitals: {
    ttfb: { status: 'waiting' },
    fcp: { status: 'waiting' },
    lcp: {
      status: 'available',
      value: { value: 2222, delta: 2222, rating: 'good', id: 'lcp' },
    },
    cls: {
      status: 'available',
      value: { value: 0.03, delta: 0.03, rating: 'good', id: 'cls' },
    },
    inp: {
      status: 'available',
      value: { value: 88, delta: 88, rating: 'good', id: 'inp' },
    },
  },
  mainThread: {
    longTasks: {
      status: 'available',
      value: { count: 1, totalDuration: 70, maxDuration: 70 },
    },
    longAnimationFrames: {
      status: 'available',
      value: { count: 2, totalDuration: 110, maxDuration: 80 },
    },
  },
  navigation: { status: 'waiting' },
  resources: {
    resourceCount: 4,
    totalDuration: 98,
    transferSize: { status: 'not-measurable' },
    decodedBodySize: { status: 'not-measurable' },
  },
  capabilities: {
    navigation: { status: 'available' },
    paint: { status: 'available' },
    largestContentfulPaint: { status: 'available' },
    layoutShift: { status: 'available' },
    eventTiming: { status: 'available' },
    longTask: { status: 'available' },
    longAnimationFrame: { status: 'available' },
  },
};

function runtimeWith(snapshot: PerformanceSnapshot): PerformanceRuntime {
  return {
    start: async () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    stop: () => undefined,
    reset: () => undefined,
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  };
}

describe('PerformanceHud', () => {
  it('catches compact HUD regressions by showing only FPS and P95', () => {
    render(<PerformanceHud mode="compact" runtime={runtimeWith(baseSnapshot)} />);

    expect(screen.getByText('FPS')).toBeVisible();
    expect(screen.getByText('P95')).toBeVisible();
    expect(screen.queryByText('Max frame')).not.toBeInTheDocument();
    expect(screen.queryByText('LCP')).not.toBeInTheDocument();
  });

  it('catches expanded HUD omissions and selected-glow accessibility regressions', () => {
    render(<PerformanceHud mode="expanded" runtime={runtimeWith(baseSnapshot)} />);

    [
      'FPS',
      'P95',
      'Max frame',
      'Dropped frames',
      'LCP',
      'CLS',
      'INP',
      'Long task',
      'LoAF',
      'Resources',
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeVisible();
    });
    expect(screen.getByRole('region')).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('region')).not.toHaveClass('glass-surface--selected');
  });

  it('catches hidden HUD content remaining in the DOM', () => {
    const { container } = render(
      <PerformanceHud mode="hidden" runtime={runtimeWith(baseSnapshot)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['waiting', '\u7B49\u5F85'],
    ['unsupported', '\u4E0D\u652F\u6301'],
    ['not-measurable', '\u4E0D\u53EF\u6D4B'],
  ] as const)('catches %s values being replaced with numeric zero', (status, label) => {
    const snapshot: PerformanceSnapshot = {
      ...baseSnapshot,
      webVitals: { ...baseSnapshot.webVitals, lcp: { status } },
    };
    render(<PerformanceHud mode="expanded" runtime={runtimeWith(snapshot)} />);

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByText(/^0(?:\.0+)?$/)).not.toBeInTheDocument();
  });
});
