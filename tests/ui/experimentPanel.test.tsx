import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { ExperimentPanel } from '../../src/components/controls/ExperimentPanel';
import {
  createDefaultSettings,
  SETTINGS_STORAGE_KEY,
} from '../../src/experiments/settings';
import type { BenchmarkController } from '../../src/hooks/useBenchmarkController';
import type { ReportActions } from '../../src/performance/reportActions';

const idleBenchmarkState: BenchmarkController['state'] = {
  status: 'idle',
  phase: null,
  elapsedMs: 0,
  completedInForeground: null,
};

const reportActions: ReportActions = {
  copyJson: async () => undefined,
  downloadJson: () => undefined,
  copySummary: async () => undefined,
};

function renderCompletedSuiteResult(estimatedDroppedFrames?: number) {
  const openerRef = createRef<HTMLButtonElement>();
  const benchmarkController: BenchmarkController = {
    state: idleBenchmarkState,
    suiteState: {
      status: 'completed',
      mode: null,
      modeIndex: null,
      elapsedMs: 132_000,
      interruptions: 0,
      interruptionsByMode: { real: 0, simulated: 0, preblur: 0, off: 0 },
      consecutiveInterruptions: 0,
      failureReason: null,
      runs: [
        {
          mode: 'real',
          result: {
            frames: {
              metrics: {
                sampleCount: 1,
                currentFps: 60,
                p95FrameTime: 16,
                estimatedDroppedFrames,
              },
            },
          },
          completedInForeground: true,
        },
      ],
    },
    workloadLocked: false,
    start: vi.fn(),
    cancel: vi.fn(),
    startSuite: vi.fn(),
    cancelSuite: vi.fn(),
  };

  render(
    <>
      <button ref={openerRef} type="button">
        实验控制
      </button>
      <ExperimentPanel
        benchmarkController={benchmarkController}
        effectiveGlassMode="real"
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
        open
        openerRef={openerRef}
        reportActions={reportActions}
        settings={createDefaultSettings()}
      />
    </>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ExperimentPanel', () => {
  it('applies one glass mode immediately and persists it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '实验控制' }));
    const group = screen.getByRole('group', { name: '玻璃方式' });
    await user.click(within(group).getByRole('radio', { name: '预模糊层' }));

    expect(within(group).getAllByRole('radio', { checked: true })).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('data-glass-mode', 'preblur');
    expect(
      JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({
      schemaVersion: 1,
      settings: { glassMode: 'preblur' },
    });
  });

  it('renders the exact exclusive controls and four named toggles', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '实验控制' }));

    expect(
      within(screen.getByRole('group', { name: '玻璃方式' }))
        .getAllByRole('radio')
        .map((input) => input.getAttribute('value')),
    ).toEqual(['real', 'simulated', 'preblur', 'off']);
    expect(
      within(screen.getByRole('group', { name: '动态等级' }))
        .getAllByRole('radio')
        .map((input) => input.getAttribute('value')),
    ).toEqual(['off', 'low', 'medium', 'high', 'maximum']);
    expect(
      within(screen.getByRole('group', { name: '粒子数量' }))
        .getAllByRole('radio')
        .map((input) => input.getAttribute('value')),
    ).toEqual(['0', '20', '50', '100', 'maximum']);
    expect(
      within(screen.getByRole('group', { name: '像素密度' }))
        .getAllByRole('radio')
        .map((input) => input.getAttribute('value')),
    ).toEqual(['native', 'cap-2', 'cap-1.5']);
    expect(
      within(screen.getByRole('group', { name: 'HUD' }))
        .getAllByRole('radio')
        .map((input) => input.getAttribute('value')),
    ).toEqual(['compact', 'expanded', 'hidden']);

    for (const label of ['背景动态', '触摸视差', '卡片浮动', '模拟减少动态']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument();
    }
  });

  it('uses modal disclosure semantics and highlights one selected option per group', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: '实验控制' });

    expect(opener).toHaveAttribute('aria-expanded', 'false');
    await user.click(opener);

    const panel = screen.getByRole('dialog', { name: '实验控制' });
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveAttribute('aria-modal', 'true');

    for (const name of ['玻璃方式', '动态等级', '粒子数量', '像素密度', 'HUD']) {
      const group = screen.getByRole('group', { name });
      expect(within(group).getAllByRole('radio', { checked: true })).toHaveLength(1);
      expect(group.querySelectorAll('label.glass-surface--selected')).toHaveLength(1);
    }

    await user.click(within(panel).getByRole('button', { name: '关闭' }));
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: '实验控制' })).not.toBeInTheDocument();
  });

  it('enters, cycles and restores focus for the modal sheet', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: '实验控制' });

    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: '实验控制' });
    const close = within(dialog).getByRole('button', { name: '关闭' });
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    const enabled = within(dialog)
      .getAllByRole('button')
      .filter((button) => !button.hasAttribute('disabled'));
    expect(enabled.at(-1)).toHaveFocus();

    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '实验控制' })).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('dismisses from the idle scrim and restores the opener', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: '实验控制' });

    await user.click(opener);
    await user.click(screen.getByTestId('experiment-panel-scrim'));

    expect(screen.queryByRole('dialog', { name: '实验控制' })).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('keeps fixed regions outside the only scrolling settings body', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '实验控制' }));

    const dialog = screen.getByRole('dialog', { name: '实验控制' });
    const [header, suite, body, footer] = [...dialog.children];
    expect(header).toHaveClass('experiment-panel__heading');
    expect(suite).toHaveClass('experiment-panel__suite');
    expect(body).toHaveClass('experiment-panel__body');
    expect(footer).toHaveClass('experiment-panel__footer');
    expect(body).toContainElement(screen.getByRole('group', { name: '玻璃方式' }));
    expect(header).not.toContainElement(
      screen.getByRole('group', { name: '玻璃方式' }),
    );
    expect(suite).not.toContainElement(screen.getByRole('group', { name: '玻璃方式' }));
    expect(footer).not.toContainElement(
      screen.getByRole('group', { name: '玻璃方式' }),
    );
  });

  it.each([
    ['missing', undefined],
    ['nonfinite', Number.POSITIVE_INFINITY],
  ] as const)(
    'shows waiting instead of fabricating zero for a %s dropped-frame estimate',
    (_, estimatedDroppedFrames) => {
      renderCompletedSuiteResult(estimatedDroppedFrames);

      const row = within(screen.getByRole('table', { name: '套件结果' })).getByRole(
        'row',
        { name: /真实模糊/ },
      );
      expect(
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual(['60', '16', '等待']);
      expect(row).not.toHaveTextContent('真实模糊60160');
    },
  );

  it('resets defaults and persists the exact next state', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '实验控制' }));
    const group = screen.getByRole('group', { name: '玻璃方式' });
    await user.click(within(group).getByRole('radio', { name: '关闭模糊' }));
    await user.click(screen.getByRole('button', { name: '重置设置' }));

    expect(within(group).getByRole('radio', { name: '真实模糊' })).toBeChecked();
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toEqual({
      schemaVersion: 1,
      settings: {
        glassMode: 'real',
        motionLevel: 'medium',
        particleCount: 50,
        backgroundMotion: true,
        touchParallax: true,
        cardFloat: true,
        reducedMotionSimulation: false,
        dprMode: 'native',
        hudMode: 'compact',
      },
    });
  });
});
