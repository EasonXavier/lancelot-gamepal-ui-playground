import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlassSurface } from '../../src/components/glass/GlassSurface';
import type { GlassMode } from '../../src/experiments/settings';

describe('GlassSurface', () => {
  it.each<GlassMode>(['real', 'simulated', 'preblur', 'off'])(
    'maps %s to one mode class without selected glow',
    (mode) => {
      render(
        <GlassSurface data-testid="surface" mode={mode}>
          <span>内容</span>
        </GlassSurface>,
      );
      const surface = screen.getByTestId('surface');
      expect(surface).toHaveClass('glass-surface', `glass-surface--${mode}`);
      expect(surface).not.toHaveClass('glass-surface--selected');
      expect(surface).toHaveAttribute('data-glass-mode', mode);
      expect(surface).toHaveAttribute('data-selected', 'false');
    },
  );

  it('preserves the same DOM nodes when only the mode changes', () => {
    const { rerender } = render(
      <GlassSurface data-testid="surface" mode="real">
        <span data-testid="payload">内容</span>
      </GlassSurface>,
    );
    const surface = screen.getByTestId('surface');
    const payload = screen.getByTestId('payload');

    rerender(
      <GlassSurface data-testid="surface" mode="simulated">
        <span data-testid="payload">内容</span>
      </GlassSurface>,
    );

    expect(screen.getByTestId('surface')).toBe(surface);
    expect(screen.getByTestId('payload')).toBe(payload);
    expect(surface).toHaveClass('glass-surface--simulated');
    expect(surface).not.toHaveClass('glass-surface--real');
  });

  it('adds selected styling only when explicitly selected', () => {
    render(
      <GlassSurface data-testid="surface" mode="off" selected>
        当前页
      </GlassSurface>,
    );
    expect(screen.getByTestId('surface')).toHaveClass('glass-surface--selected');
  });
});
