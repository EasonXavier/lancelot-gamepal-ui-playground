import type { HTMLAttributes, ReactNode } from 'react';
import type { GlassMode } from '../../experiments/settings';
import './glass-surface.css';

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  mode: GlassMode;
  selected?: boolean;
}

export function GlassSurface({
  children,
  className = '',
  mode,
  selected = false,
  ...props
}: GlassSurfaceProps) {
  const classes = [
    'glass-surface',
    `glass-surface--${mode}`,
    selected ? 'glass-surface--selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      className={classes}
      data-glass-mode={mode}
      data-selected={String(selected)}
    >
      {children}
    </div>
  );
}
