import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/App';
import {
  createDefaultSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  type ExperimentSettings,
} from '../../src/experiments/settings';
import type { BenchmarkController } from '../../src/hooks/useBenchmarkController';
import type { BenchmarkClock } from '../../src/performance/benchmarkRunner';
import type {
  ReportActions,
  ReportActionDependencies,
} from '../../src/performance/reportActions';

const home = vi.hoisted(() => ({
  controller: null as BenchmarkController | null,
  reportActions: null as ReportActions | null,
  settings: null as ExperimentSettings | null,
}));

type MediaQueryListener = (event: MediaQueryListEvent) => void;

function createMediaQuery(initialMatches: boolean) {
  const listeners = new Set<MediaQueryListener>();
  const query = {
    media: '(prefers-reduced-motion: reduce)',
    matches: initialMatches,
    addEventListener: vi.fn((type: string, listener: MediaQueryListener) => {
      if (type === 'change') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: MediaQueryListener) => {
      if (type === 'change') listeners.delete(listener);
    }),
    setMatches(matches: boolean) {
      query.matches = matches;
      listeners.forEach((listener) =>
        listener({ matches, media: query.media } as MediaQueryListEvent),
      );
    },
  };
  return query;
}

vi.mock('../../src/experiments/home/HomeScreen', () => ({
  HomeScreen: (props: {
    benchmarkController: BenchmarkController;
    effectiveSettings: ExperimentSettings;
    reportActions: ReportActions;
  }) => {
    home.controller = props.benchmarkController;
    home.reportActions = props.reportActions;
    home.settings = props.effectiveSettings;
    return (
      <main
        data-glass-mode={props.effectiveSettings.glassMode}
        data-motion-level={props.effectiveSettings.motionLevel}
      />
    );
  },
}));

class FakeClock implements BenchmarkClock {
  private currentTime = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { dueAt: number; callback: () => void }>();

  now = () => this.currentTime;
  setTimeout = (callback: () => void, delayMs: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { dueAt: this.currentTime + delayMs, callback });
    return id;
  };
  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };
  advanceBy(durationMs: number): void {
    const target = this.currentTime + durationMs;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) break;
      const [id, timer] = next;
      this.timers.delete(id);
      this.currentTime = timer.dueAt;
      timer.callback();
    }
    this.currentTime = target;
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  home.controller = null;
  home.reportActions = null;
  home.settings = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('App suite settings ownership', () => {
  it('applies and restores suite Glass modes without persisting temporary settings', () => {
    const stored = { ...createDefaultSettings(), glassMode: 'preblur' as const };
    saveSettings(localStorage, stored);
    const before = localStorage.getItem(SETTINGS_STORAGE_KEY);
    render(<App benchmarkClock={new FakeClock()} />);

    if (!home.controller) throw new Error('Expected controller from HomeScreen');
    act(() => home.controller?.startSuite());

    expect(screen.getByRole('main')).toHaveAttribute('data-glass-mode', 'real');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(before);

    act(() => home.controller?.cancelSuite());
    expect(screen.getByRole('main')).toHaveAttribute('data-glass-mode', 'preblur');
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(before);
  });

  it('publishes each completed suite run while excluding the next active run', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    const dependencies: ReportActionDependencies = {
      clipboard: { writeText },
      document,
      Blob,
      url: {
        createObjectURL: () => 'blob:report',
        revokeObjectURL: () => undefined,
      },
      now: () => new Date('2026-07-29T00:00:00.000Z'),
    };
    const clock = new FakeClock();
    render(<App benchmarkClock={clock} reportActionDependencies={dependencies} />);
    if (!home.controller) throw new Error('Expected controller from HomeScreen');

    act(() => home.controller?.startSuite());
    act(() => clock.advanceBy(38_000));
    if (!home.reportActions) throw new Error('Expected report actions from HomeScreen');
    await act(() => home.reportActions?.copyJson());
    const report = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as {
      benchmark: { completedModes: string[] };
      runs: Array<{ glassMode: string }>;
    };

    expect(report.benchmark.completedModes).toEqual(['real']);
    expect(report.runs.map(({ glassMode }) => glassMode)).toEqual(['real']);
  });

  it('publishes a completed suite as four ordered schema v2 runs', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    const dependencies: ReportActionDependencies = {
      clipboard: { writeText },
      document,
      Blob,
      url: {
        createObjectURL: () => 'blob:report',
        revokeObjectURL: () => undefined,
      },
      now: () => new Date('2026-07-29T00:00:00.000Z'),
    };
    const clock = new FakeClock();
    render(<App benchmarkClock={clock} reportActionDependencies={dependencies} />);
    if (!home.controller) throw new Error('Expected controller from HomeScreen');

    act(() => home.controller?.startSuite());
    act(() => clock.advanceBy(132_000));
    if (!home.reportActions) throw new Error('Expected report actions from HomeScreen');
    await act(() => home.reportActions?.copyJson());
    const report = JSON.parse(writeText.mock.calls[0]?.[0] ?? '{}') as {
      schemaVersion: number;
      reportType: string;
      benchmark: {
        status: string;
        elapsedMs: number;
        completedModes: string[];
        interruptionsByMode: Record<string, number>;
      };
      runs: Array<{
        glassMode: string;
        elapsedMs: number;
        completedInForeground: boolean;
        eligibleForComparison: boolean;
      }>;
    };
    const expectedOrder = ['real', 'simulated', 'preblur', 'off'];

    expect(report).toMatchObject({
      schemaVersion: 2,
      reportType: 'suite',
      benchmark: {
        status: 'completed',
        elapsedMs: 132_000,
        completedModes: expectedOrder,
        interruptionsByMode: { real: 0, simulated: 0, preblur: 0, off: 0 },
      },
    });
    expect(report.runs.map(({ glassMode }) => glassMode)).toEqual(expectedOrder);
    expect(report.runs).toHaveLength(4);
    expect(report.runs).toEqual(
      expectedOrder.map((glassMode) =>
        expect.objectContaining({
          glassMode,
          elapsedMs: 30_000,
          completedInForeground: true,
          eligibleForComparison: true,
        }),
      ),
    );
  });

  it('freezes the effective reduced-motion decision for the active suite workload', () => {
    const mediaQuery = createMediaQuery(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    );
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const clock = new FakeClock();
    render(<App benchmarkClock={clock} />);
    if (!home.controller) throw new Error('Expected controller from HomeScreen');

    act(() => home.controller?.startSuite());
    act(() => mediaQuery.setMatches(true));
    act(() => clock.advanceBy(14_000));

    expect(screen.getByRole('main')).toHaveAttribute('data-motion-level', 'maximum');

    act(() => home.controller?.cancelSuite());
    expect(screen.getByRole('main')).toHaveAttribute('data-motion-level', 'off');
  });
});
