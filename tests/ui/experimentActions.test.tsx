import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/App';
import {
  createDefaultSettings,
  SETTINGS_STORAGE_KEY,
} from '../../src/experiments/settings';
import { useBenchmarkController } from '../../src/hooks/useBenchmarkController';
import type { BenchmarkClock } from '../../src/performance/benchmarkRunner';
import type { ReportActionDependencies } from '../../src/performance/reportActions';
import type {
  PerformanceRuntime,
  PerformanceSnapshot,
} from '../../src/performance/runtime';

class FakeClock implements BenchmarkClock {
  private currentTime = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { dueAt: number; callback: () => void }>();

  now = (): number => this.currentTime;

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
      if (!next) {
        break;
      }
      const [id, timer] = next;
      this.timers.delete(id);
      this.currentTime = timer.dueAt;
      timer.callback();
    }
    this.currentTime = target;
  }
}

function createPerformanceSnapshot(fps: number): PerformanceSnapshot {
  return {
    frames: {
      intervals: [16],
      isRunning: true,
      needsCalibration: false,
      metrics: {
        sampleCount: 1,
        baselineFrameTime: 16,
        currentFps: fps,
        averageFrameTime: 16,
        p95FrameTime: 16,
        maxFrameTime: 16,
        framesOver33: 0,
        framesOver50: 0,
        stutterFrameRatio: 0,
        estimatedDroppedFrames: 0,
      },
    },
    webVitals: {
      ttfb: { status: 'waiting' },
      fcp: { status: 'waiting' },
      lcp: { status: 'waiting' },
      cls: { status: 'waiting' },
      inp: { status: 'waiting' },
    },
    mainThread: {
      longTasks: { status: 'waiting' },
      longAnimationFrames: { status: 'waiting' },
    },
    navigation: { status: 'waiting' },
    resources: {
      resourceCount: 0,
      totalDuration: 0,
      transferSize: { status: 'waiting' },
      decodedBodySize: { status: 'waiting' },
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
}

class FakeRuntime implements PerformanceRuntime {
  private started = false;
  private running = false;
  private fps = 60;
  private snapshot = createPerformanceSnapshot(this.fps);

  readonly start = vi.fn(async () => {
    this.started = true;
    this.running = true;
  });

  readonly pause = vi.fn(() => {
    this.running = false;
  });

  readonly resume = vi.fn(() => {
    if (this.started) {
      this.running = true;
    }
  });

  readonly stop = vi.fn(() => {
    this.started = false;
    this.running = false;
  });

  readonly reset = vi.fn(() => {
    this.fps = 60;
    this.snapshot = createPerformanceSnapshot(this.fps);
  });

  readonly subscribe = vi.fn(() => () => undefined);

  readonly getSnapshot = vi.fn(() => this.snapshot);

  tick(): void {
    if (this.running) {
      this.fps += 1;
      this.snapshot = createPerformanceSnapshot(this.fps);
    }
  }
}

function renderBenchmarkController(runtime: PerformanceRuntime, clock: FakeClock) {
  const settings = {
    ...createDefaultSettings(),
    motionLevel: 'off' as const,
    particleCount: 0 as const,
    backgroundMotion: false,
  };
  return renderHook(() =>
    useBenchmarkController({
      clock,
      effectiveSettings: settings,
      panelOpen: true,
      performanceRuntime: runtime,
      selectedGame: 'delta',
      visible: true,
      onEffectiveSettingsOverrideChange: vi.fn(),
      onPanelOpenChange: vi.fn(),
      onProfileChange: vi.fn(),
      onReportStart: vi.fn(),
      onReportTerminal: vi.fn(),
      onResultCapture: vi.fn(),
      onSelectedGameChange: vi.fn(),
    }),
  );
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');

function installBrowserBoundaries(
  writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined),
) {
  let scrollY = 320;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollY,
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(((
    x: number | ScrollToOptions,
    y?: number,
  ) => {
    scrollY = typeof x === 'number' ? (y ?? 0) : (x.top ?? 0);
  }) as typeof window.scrollTo);
  const reportActionDependencies: ReportActionDependencies = {
    clipboard: { writeText },
    document,
    Blob,
    url: {
      createObjectURL: () => 'blob:ui-report',
      revokeObjectURL: () => undefined,
    },
    now: () => new Date('2026-07-27T06:00:00.000Z'),
  };
  return { reportActionDependencies, writeText };
}

async function openConfiguredPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'CS2' }));
  await user.click(screen.getByRole('button', { name: '实验控制' }));
  const particles = screen.getByRole('group', { name: '粒子数量' });
  await user.click(within(particles).getByRole('radio', { name: '20' }));
}

async function configureNonDefaultWorkload(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(
    within(screen.getByRole('group', { name: '动态等级' })).getByRole('radio', {
      name: '低',
    }),
  );
  await user.click(
    within(screen.getByRole('group', { name: '像素密度' })).getByRole('radio', {
      name: '上限 1.5x',
    }),
  );
  for (const label of ['背景动态', '触摸视差', '卡片浮动']) {
    await user.click(screen.getByRole('checkbox', { name: label }));
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
  if (originalVisibility) {
    Object.defineProperty(document, 'visibilityState', originalVisibility);
  }
  if (originalScrollY) {
    Object.defineProperty(window, 'scrollY', originalScrollY);
  }
  vi.restoreAllMocks();
});

describe('benchmark runtime ownership', () => {
  it('starts an off/Reduced Motion runtime and freezes the completed snapshot after capture', () => {
    const clock = new FakeClock();
    const runtime = new FakeRuntime();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { result } = renderBenchmarkController(runtime, clock);

    act(() => result.current.start());
    expect(runtime.start).toHaveBeenCalledOnce();
    runtime.tick();
    act(() => clock.advanceBy(30_000));

    expect(runtime.getSnapshot).toHaveBeenCalled();
    expect(runtime.pause).toHaveBeenCalled();
    const capturedFps = runtime.getSnapshot().frames.metrics.currentFps;
    runtime.tick();
    expect(runtime.getSnapshot().frames.metrics.currentFps).toBe(capturedFps);
    expect(runtime.pause.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      runtime.getSnapshot.mock.invocationCallOrder[0] ?? 0,
    );
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('pauses unconditionally on cancel and leaves the current snapshot frozen', () => {
    const clock = new FakeClock();
    const runtime = new FakeRuntime();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { result } = renderBenchmarkController(runtime, clock);

    act(() => result.current.start());
    runtime.tick();
    const beforeCancel = runtime.getSnapshot().frames.metrics.currentFps;
    act(() => result.current.cancel());

    expect(runtime.pause).toHaveBeenCalled();
    runtime.tick();
    expect(runtime.getSnapshot().frames.metrics.currentFps).toBe(beforeCancel);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('experiment actions', () => {
  it('keeps user dismissal locked while benchmark-controlled close and reopen still work', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));

    const close = screen.getByRole('button', { name: '关闭' });
    expect(close).toBeDisabled();
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('experiment-panel-scrim'));
    expect(screen.getByRole('dialog', { name: '实验控制' })).toBeVisible();

    act(() => clock.advanceBy(19_000));
    expect(screen.queryByRole('dialog', { name: '实验控制' })).toBeNull();
    act(() => clock.advanceBy(8_000));
    expect(screen.getByRole('dialog', { name: '实验控制' })).toBeVisible();
    expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '取消 Benchmark' }));
    expect(screen.getByRole('button', { name: '关闭' })).toBeEnabled();
  });

  it('shows four-mode suite progress, interruptions and the focused result columns', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} performanceRuntime={new FakeRuntime()} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));

    const suite = screen.getByRole('region', { name: '四模式基线套件' });
    expect(within(suite).getByText('预计 2 分 12 秒')).toBeVisible();
    expect(within(suite).getAllByRole('listitem')).toHaveLength(4);
    await user.click(within(suite).getByRole('button', { name: '开始全部' }));

    expect(within(suite).getByText('真实模糊 · 准备')).toBeVisible();
    expect(within(suite).getByText('中断 0 次')).toBeVisible();
    expect(within(suite).getAllByRole('listitem')[0]).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(within(suite).getByRole('button', { name: '开始全部' })).toBeDisabled();
    expect(within(suite).getByRole('button', { name: '取消全部' })).toBeEnabled();

    act(() => clock.advanceBy(33_000));
    expect(within(suite).getAllByRole('listitem')[0]).toHaveAttribute(
      'data-state',
      'completed',
    );
    expect(within(suite).getAllByRole('listitem')[1]).toHaveAttribute(
      'data-state',
      'active',
    );
    const table = within(suite).getByRole('table', { name: '套件结果' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['模式', 'FPS', 'P95', '估算丢帧']);
    expect(within(table).getByRole('row', { name: /真实模糊 60 16 0/ })).toBeVisible();
    expect(within(table).queryByText('Max frame')).toBeNull();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(within(suite).getByText('中断 1 次')).toBeVisible();
    expect(within(suite).getByText('模拟玻璃 · 等待页面可见')).toBeVisible();
    await user.click(within(suite).getByRole('button', { name: '取消全部' }));
    expect(within(suite).getByRole('button', { name: '取消全部' })).toBeDisabled();
  });

  it('catches repeated start, transient profile persistence or incomplete full-run scene restore', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await openConfiguredPanel(user);

    const start = screen.getByRole('button', { name: '运行 30 秒 Benchmark' });
    await user.click(start);
    expect(screen.getByText('warmup')).toBeVisible();
    act(() => clock.advanceBy(1_000));
    await user.click(start);
    act(() => clock.advanceBy(10_000));

    expect(screen.getByRole('main')).toHaveAttribute('data-motion-level', 'maximum');
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', 'maximum');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ settings: { motionLevel: 'medium', particleCount: 20 } });

    act(() => clock.advanceBy(8_000));
    expect(screen.getByRole('button', { name: '实验控制' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(window.scrollTo).toHaveBeenCalledWith(
      0,
      document.documentElement.scrollHeight,
    );
    act(() => clock.advanceBy(8_000));
    expect(screen.getByText('summarize')).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', 'maximum');
    act(() => clock.advanceBy(3_000));

    expect(screen.getByText('completed')).toBeVisible();
    expect(screen.getByRole('button', { name: 'CS2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('dialog', { name: '实验控制' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('data-motion-level', 'medium');
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '20');
    expect(window.scrollY).toBe(320);
  });

  it('catches cancel leaving benchmark game, panel, scroll or particle state behind', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await openConfiguredPanel(user);

    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
    act(() => clock.advanceBy(11_000));
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', 'maximum');
    await user.click(screen.getByRole('button', { name: '取消 Benchmark' }));

    expect(screen.getByText('cancelled')).toBeVisible();
    expect(screen.getByRole('button', { name: 'CS2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('dialog', { name: '实验控制' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '20');
    expect(window.scrollY).toBe(320);
  });

  it('catches a stress profile bypassing effective Reduced Motion', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('checkbox', { name: '模拟减少动态' }));
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));

    act(() => clock.advanceBy(11_000));

    expect(screen.getByRole('main')).toHaveAttribute('data-motion-level', 'off');
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '0');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({
      settings: {
        motionLevel: 'medium',
        particleCount: 50,
        reducedMotionSimulation: true,
      },
    });
  });

  it('catches hidden benchmark time being reported as foreground complete', async () => {
    const { reportActionDependencies, writeText } = installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(
      <App
        benchmarkClock={clock}
        reportActionDependencies={reportActionDependencies}
      />,
    );
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => clock.advanceBy(30_000));
    await user.click(screen.getByRole('button', { name: '复制摘要' }));

    expect(screen.getByText('已复制')).toBeVisible();
    expect(writeText.mock.calls.at(-1)?.[0]).toContain(
      'real | waiting | waiting | waiting | no | no',
    );
  });

  it('catches missing actions or clipboard rejection becoming blocking or invisible', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {
      throw new DOMException('Clipboard denied', 'NotAllowedError');
    });
    const { reportActionDependencies } = installBrowserBoundaries(writeText);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <App
        benchmarkClock={new FakeClock()}
        reportActionDependencies={reportActionDependencies}
      />,
    );
    await user.click(screen.getByRole('button', { name: '实验控制' }));

    for (const label of [
      '运行 30 秒 Benchmark',
      '取消 Benchmark',
      '复制 JSON',
      '下载 JSON',
      '复制摘要',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeVisible();
    }

    await user.click(screen.getByRole('button', { name: '复制 JSON' }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(await screen.findByText('复制失败')).toBeVisible();
    expect(alert).not.toHaveBeenCalled();

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: '下载 JSON' }));
    expect(screen.getByText('已下载')).toBeVisible();
  });

  it.each([
    ['warmup start', 0],
    ['ambient boundary', 3_000],
    ['stress boundary', 11_000],
    ['scroll-transition boundary', 19_000],
    ['summarize boundary', 27_000],
  ])('keeps cancel available at the exact %s', async (_, elapsedMs) => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
    act(() => clock.advanceBy(elapsedMs));

    const cancel = screen.getByRole('button', { name: '取消 Benchmark' });
    expect(cancel).toBeVisible();
    await user.click(cancel);
    expect(screen.getByText('cancelled')).toBeVisible();
  });

  it('treats the exact 30-second boundary as completed rather than cancellable', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));

    act(() => clock.advanceBy(30_000));

    expect(screen.getByText('completed')).toBeVisible();
  });

  it.each([
    ['warmup', 0],
    ['ambient', 3_000],
    ['stress', 11_000],
    ['summarize', 27_000],
  ])(
    'prevents a requested particle edit before %s cancellation',
    async (_, elapsedMs) => {
      installBrowserBoundaries();
      const clock = new FakeClock();
      const user = userEvent.setup();
      render(<App benchmarkClock={clock} />);
      await openConfiguredPanel(user);
      await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
      act(() => clock.advanceBy(elapsedMs));
      const particles = screen.getByRole('group', { name: '粒子数量' });
      const attemptedEdit = within(particles).getByRole('radio', { name: '100' });

      expect(attemptedEdit).toBeDisabled();
      await user.click(attemptedEdit);
      await user.click(screen.getByRole('button', { name: '取消 Benchmark' }));

      expect(within(particles).getByRole('radio', { name: '20' })).toBeChecked();
      expect(
        JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
      ).toMatchObject({ settings: { particleCount: 20 } });
    },
  );

  it('prevents particle edits through all editable phases and restores after completion', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await openConfiguredPanel(user);
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));

    for (const advanceMs of [0, 3_000, 8_000]) {
      act(() => clock.advanceBy(advanceMs));
      expect(
        within(screen.getByRole('group', { name: '粒子数量' })).getByRole('radio', {
          name: '100',
        }),
      ).toBeDisabled();
    }
    act(() => clock.advanceBy(8_000));
    expect(screen.queryByRole('group', { name: '粒子数量' })).toBeNull();
    act(() => clock.advanceBy(8_000));
    expect(
      within(screen.getByRole('group', { name: '粒子数量' })).getByRole('radio', {
        name: '100',
      }),
    ).toBeDisabled();
    act(() => clock.advanceBy(3_000));

    expect(
      within(screen.getByRole('group', { name: '粒子数量' })).getByRole('radio', {
        name: '20',
      }),
    ).toBeChecked();
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ settings: { particleCount: 20 } });
  });

  it('prevents reset from replacing captured particles before warmup cancellation', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await openConfiguredPanel(user);
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
    const reset = screen.getByRole('button', { name: '重置设置' });

    expect(reset).toBeDisabled();
    await user.click(reset);
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '20');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ settings: { particleCount: 20 } });

    await user.click(screen.getByRole('button', { name: '取消 Benchmark' }));
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '20');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ settings: { particleCount: 20 } });
  });

  it('prevents reset from replacing captured particles before summarize completion', async () => {
    installBrowserBoundaries();
    const clock = new FakeClock();
    const user = userEvent.setup();
    render(<App benchmarkClock={clock} />);
    await openConfiguredPanel(user);
    await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
    act(() => clock.advanceBy(27_000));
    const reset = screen.getByRole('button', { name: '重置设置' });

    expect(reset).toBeDisabled();
    await user.click(reset);
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', 'maximum');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ settings: { particleCount: 20 } });

    act(() => clock.advanceBy(3_000));
    expect(screen.getByText('completed')).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '20');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ settings: { particleCount: 20 } });
  });

  it.each([
    ['warmup cancellation', 0, 'cancel'],
    ['ambient cancellation', 3_000, 'cancel'],
    ['stress cancellation', 11_000, 'cancel'],
    ['summarize cancellation', 27_000, 'cancel'],
    ['summarize completion', 27_000, 'complete'],
  ] as const)(
    'locks every motion workload mutation through %s',
    async (_, elapsedMs, outcome) => {
      installBrowserBoundaries();
      const clock = new FakeClock();
      const user = userEvent.setup();
      render(<App benchmarkClock={clock} />);
      await openConfiguredPanel(user);
      await configureNonDefaultWorkload(user);
      await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
      act(() => clock.advanceBy(elapsedMs));

      const attemptedControls = [
        within(screen.getByRole('group', { name: '玻璃方式' })).getByRole('radio', {
          name: '关闭模糊',
        }),
        within(screen.getByRole('group', { name: '动态等级' })).getByRole('radio', {
          name: '最大',
        }),
        within(screen.getByRole('group', { name: '粒子数量' })).getByRole('radio', {
          name: '100',
        }),
        within(screen.getByRole('group', { name: '像素密度' })).getByRole('radio', {
          name: '原生',
        }),
        screen.getByRole('checkbox', { name: '背景动态' }),
        screen.getByRole('checkbox', { name: '触摸视差' }),
        screen.getByRole('checkbox', { name: '卡片浮动' }),
        screen.getByRole('checkbox', { name: '模拟减少动态' }),
        within(screen.getByRole('group', { name: 'HUD' })).getByRole('radio', {
          name: '展开',
        }),
        screen.getByRole('button', { name: '重置设置' }),
        screen.getByRole('button', { name: '关闭' }),
      ];

      for (const control of attemptedControls) {
        expect(control).toBeDisabled();
        await user.click(control);
      }
      expect(screen.getByRole('button', { name: '取消 Benchmark' })).toBeEnabled();
      expect(screen.getByRole('button', { name: '复制 JSON' })).toBeEnabled();

      if (outcome === 'cancel') {
        await user.click(screen.getByRole('button', { name: '取消 Benchmark' }));
      } else {
        act(() => clock.advanceBy(3_000));
      }

      expect(
        screen.getByText(outcome === 'cancel' ? 'cancelled' : 'completed'),
      ).toBeVisible();
      expect(screen.getByRole('main')).toHaveAttribute('data-motion-level', 'low');
      expect(screen.getByRole('main')).toHaveAttribute('data-particle-count', '20');
      expect(
        JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
      ).toMatchObject({
        settings: {
          motionLevel: 'low',
          particleCount: 20,
          backgroundMotion: false,
          touchParallax: false,
          cardFloat: false,
          reducedMotionSimulation: false,
          dprMode: 'cap-1.5',
        },
      });
    },
  );

  it('publishes copy success after StrictMode replays the mount effect', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    const { reportActionDependencies } = installBrowserBoundaries(writeText);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App reportActionDependencies={reportActionDependencies} />
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '复制 JSON' }));

    expect(screen.getByText('已复制')).toBeVisible();
  });

  it.each([
    ['completed', 30_000, false],
    ['cancelled', 11_000, true],
  ] as const)(
    'keeps %s JSON and summary byte-stable while the live runtime resumes',
    async (_, elapsedMs, cancel) => {
      const { reportActionDependencies, writeText } = installBrowserBoundaries();
      const clock = new FakeClock();
      const runtime = new FakeRuntime();
      const user = userEvent.setup();
      render(
        <App
          benchmarkClock={clock}
          performanceRuntime={runtime}
          reportActionDependencies={reportActionDependencies}
        />,
      );
      await user.click(screen.getByRole('button', { name: '实验控制' }));
      await user.click(screen.getByRole('button', { name: '运行 30 秒 Benchmark' }));
      runtime.tick();
      act(() => clock.advanceBy(elapsedMs));
      if (cancel) {
        await user.click(screen.getByRole('button', { name: '取消 Benchmark' }));
      }

      await user.click(screen.getByRole('button', { name: '复制 JSON' }));
      await user.click(screen.getByRole('button', { name: '复制摘要' }));
      const capturedJson = writeText.mock.calls[0]?.[0];
      const capturedSummary = writeText.mock.calls[1]?.[0];
      if (!capturedJson || !capturedSummary) {
        throw new Error('Expected both captured report formats');
      }
      const parsedReport = JSON.parse(capturedJson) as {
        runs: Array<{ performance: { frames: { averageFps: number | null } } }>;
      };
      const capturedFps = parsedReport.runs[0]?.performance.frames.averageFps;
      expect(parsedReport.runs).toHaveLength(cancel ? 0 : 1);

      const motion = screen.getByRole('group', { name: '动态等级' });
      await user.click(within(motion).getByRole('radio', { name: '关闭' }));
      await user.click(within(motion).getByRole('radio', { name: '高' }));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      runtime.tick();
      if (capturedFps !== undefined) {
        expect(runtime.getSnapshot().frames.metrics.currentFps).not.toBe(capturedFps);
      }

      await user.click(screen.getByRole('button', { name: '复制 JSON' }));
      await user.click(screen.getByRole('button', { name: '复制摘要' }));
      expect(writeText.mock.calls[2]?.[0]).toBe(capturedJson);
      expect(writeText.mock.calls[3]?.[0]).toBe(capturedSummary);
    },
  );

  it('keeps a later copy success when an earlier copy rejects afterward', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { reportActionDependencies } = installBrowserBoundaries(writeText);
    const user = userEvent.setup();
    render(<App reportActionDependencies={reportActionDependencies} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '复制 JSON' }));
    await user.click(screen.getByRole('button', { name: '复制摘要' }));

    await act(async () => second.resolve());
    expect(screen.getByText('已复制')).toBeVisible();
    await act(async () => first.reject(new Error('older failed')));
    expect(screen.getByText('已复制')).toBeVisible();
    expect(screen.queryByText('复制失败')).toBeNull();
  });

  it('keeps a later copy failure when an earlier copy resolves afterward', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { reportActionDependencies } = installBrowserBoundaries(writeText);
    const user = userEvent.setup();
    render(<App reportActionDependencies={reportActionDependencies} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '复制 JSON' }));
    await user.click(screen.getByRole('button', { name: '复制摘要' }));

    await act(async () => second.reject(new Error('latest failed')));
    expect(screen.getByText('复制失败')).toBeVisible();
    await act(async () => first.resolve());
    expect(screen.getByText('复制失败')).toBeVisible();
    expect(screen.queryByText('已复制')).toBeNull();
  });

  it('keeps download status when an earlier copy settles and cleans up on unmount', async () => {
    const pending = deferred<void>();
    const writeText = vi.fn<(text: string) => Promise<void>>(() => pending.promise);
    const { reportActionDependencies } = installBrowserBoundaries(writeText);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const view = render(<App reportActionDependencies={reportActionDependencies} />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));
    await user.click(screen.getByRole('button', { name: '复制 JSON' }));
    await user.click(screen.getByRole('button', { name: '下载 JSON' }));
    expect(screen.getByText('已下载')).toBeVisible();

    await act(async () => pending.reject(new Error('older failed')));
    expect(screen.getByText('已下载')).toBeVisible();

    const afterUnmount = deferred<void>();
    writeText.mockImplementationOnce(() => afterUnmount.promise);
    await user.click(screen.getByRole('button', { name: '复制 JSON' }));
    view.unmount();
    await act(async () => afterUnmount.resolve());
    expect(consoleError).not.toHaveBeenCalled();
  });
});
