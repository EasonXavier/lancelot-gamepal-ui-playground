import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PerformanceHud } from '../../src/components/performance/PerformanceHud';
import { createPerformanceRuntime } from '../../src/performance/runtime';
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
    render(
      <PerformanceHud
        mode="compact"
        onModeChange={vi.fn()}
        runtime={runtimeWith(baseSnapshot)}
        workloadLocked={false}
      />,
    );

    const hud = screen.getByRole('button', { name: 'Performance HUD' });
    expect(hud).toHaveAttribute('aria-expanded', 'false');
    expect(hud).toHaveTextContent('FPS60');
    expect(hud).toHaveTextContent('P9517');
    expect(screen.queryByText('Max frame')).not.toBeInTheDocument();
    expect(screen.queryByText('LCP')).not.toBeInTheDocument();
  });

  it('changes compact and expanded modes through the settings callback', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const view = render(
      <PerformanceHud
        mode="compact"
        onModeChange={onModeChange}
        runtime={runtimeWith(baseSnapshot)}
        workloadLocked={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Performance HUD' }));
    expect(onModeChange).toHaveBeenLastCalledWith('expanded');

    view.rerender(
      <PerformanceHud
        mode="expanded"
        onModeChange={onModeChange}
        runtime={runtimeWith(baseSnapshot)}
        workloadLocked={false}
      />,
    );
    const expanded = screen.getByRole('button', { name: 'Performance HUD' });
    expect(expanded).toHaveAttribute('aria-expanded', 'true');
    await user.click(expanded);
    expect(onModeChange).toHaveBeenLastCalledWith('compact');
  });

  it('prevents HUD mode changes while a workload owns the settings', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(
      <PerformanceHud
        mode="compact"
        onModeChange={onModeChange}
        runtime={runtimeWith(baseSnapshot)}
        workloadLocked
      />,
    );

    const hud = screen.getByRole('button', { name: 'Performance HUD' });
    expect(hud).toBeDisabled();
    await user.click(hud);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('catches expanded HUD omissions and selected-glow accessibility regressions', () => {
    render(
      <PerformanceHud
        mode="expanded"
        onModeChange={vi.fn()}
        runtime={runtimeWith(baseSnapshot)}
        workloadLocked={false}
      />,
    );

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
    expect(
      screen
        .getByRole('button', { name: 'Performance HUD' })
        .querySelector('.glass-surface--selected'),
    ).toBeNull();
  });

  it('shows waiting for dropped frames before the runtime has a frame sample', () => {
    const runtime = createPerformanceRuntime();

    render(
      <PerformanceHud
        mode="expanded"
        onModeChange={vi.fn()}
        runtime={runtime}
        workloadLocked={false}
      />,
    );

    const metric = screen.getByText('Dropped frames').closest('div');
    expect(metric).toHaveTextContent('Dropped frames\u7B49\u5F85');
    expect(metric).not.toHaveTextContent('Dropped frames0');
  });

  it('catches hidden HUD content remaining in the DOM', () => {
    const { container } = render(
      <PerformanceHud
        mode="hidden"
        onModeChange={vi.fn()}
        runtime={runtimeWith(baseSnapshot)}
        workloadLocked={false}
      />,
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
    render(
      <PerformanceHud
        mode="expanded"
        onModeChange={vi.fn()}
        runtime={runtimeWith(snapshot)}
        workloadLocked={false}
      />,
    );

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByText(/^0(?:\.0+)?$/)).not.toBeInTheDocument();
  });
});
