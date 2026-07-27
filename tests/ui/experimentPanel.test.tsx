import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { SETTINGS_STORAGE_KEY } from '../../src/experiments/settings';

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
    await user.click(within(group).getByRole('radio', { name: 'Preblur Layer' }));

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

  it('uses disclosure semantics and highlights exactly one selected option per group', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: '实验控制' });

    expect(opener).toHaveAttribute('aria-expanded', 'false');
    await user.click(opener);

    const panel = screen.getByRole('region', { name: '实验控制' });
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    for (const name of ['玻璃方式', '动态等级', '粒子数量', '像素密度', 'HUD']) {
      const group = screen.getByRole('group', { name });
      expect(within(group).getAllByRole('radio', { checked: true })).toHaveLength(1);
      expect(group.querySelectorAll('label.glass-surface--selected')).toHaveLength(1);
    }

    await user.click(within(panel).getByRole('button', { name: '收起' }));
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: '实验控制' })).not.toBeInTheDocument();
  });

  it('resets defaults and persists the exact next state', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '实验控制' }));
    const group = screen.getByRole('group', { name: '玻璃方式' });
    await user.click(within(group).getByRole('radio', { name: 'Blur Off' }));
    await user.click(screen.getByRole('button', { name: '重置设置' }));

    expect(within(group).getByRole('radio', { name: 'Real Blur' })).toBeChecked();
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
