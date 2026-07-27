import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/App';
import { SETTINGS_STORAGE_KEY } from '../../src/experiments/settings';
import type { BenchmarkClock } from '../../src/performance/benchmarkRunner';
import type { ReportActionDependencies } from '../../src/performance/reportActions';

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

describe('experiment actions', () => {
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
    expect(screen.getByRole('region', { name: '实验控制' })).toBeVisible();
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
    expect(screen.getByRole('region', { name: '实验控制' })).toBeVisible();
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
    expect(writeText.mock.calls.at(-1)?.[0]).toContain('Foreground Complete: no');
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
});
