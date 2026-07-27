import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/App';
import { MOTION_PROFILES } from '../../src/experiments/motion/motionProfiles';
import { ParticleField } from '../../src/experiments/motion/ParticleField';
import { useTouchParallax } from '../../src/experiments/motion/useTouchParallax';

function ParallaxHarness({ amplitudePx }: { amplitudePx: number }) {
  const target = useRef<HTMLDivElement>(null);
  useTouchParallax(target, true, amplitudePx);
  return <div data-testid="parallax-target" ref={target} />;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('motion profiles', () => {
  it('defines distinct coefficients with maximum as the active workload ceiling', () => {
    expect(MOTION_PROFILES).toEqual({
      off: {
        particleSpeedMultiplier: 0,
        parallaxAmplitudePx: 0,
        cardFloatDistancePx: 0,
        cardFloatDurationMs: 0,
      },
      low: {
        particleSpeedMultiplier: 0.5,
        parallaxAmplitudePx: 6,
        cardFloatDistancePx: 1.5,
        cardFloatDurationMs: 6500,
      },
      medium: {
        particleSpeedMultiplier: 1,
        parallaxAmplitudePx: 12,
        cardFloatDistancePx: 3,
        cardFloatDurationMs: 4500,
      },
      high: {
        particleSpeedMultiplier: 1.5,
        parallaxAmplitudePx: 18,
        cardFloatDistancePx: 4.5,
        cardFloatDurationMs: 3200,
      },
      maximum: {
        particleSpeedMultiplier: 2,
        parallaxAmplitudePx: 24,
        cardFloatDistancePx: 6,
        cardFloatDurationMs: 2200,
      },
    });
  });

  it.each([
    ['低', '1.5px', '6500ms'],
    ['中', '3px', '4500ms'],
    ['高', '4.5px', '3200ms'],
    ['最大', '6px', '2200ms'],
  ])(
    'applies the %s card workload coefficients to the rendered screen',
    async (label, distance, duration) => {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('button', { name: '实验控制' }));
      await user.click(
        within(screen.getByRole('group', { name: '动态等级' })).getByRole('radio', {
          name: label,
        }),
      );

      const page = screen.getByRole('main');
      expect(page.style.getPropertyValue('--card-float-distance')).toBe(distance);
      expect(page.style.getPropertyValue('--card-float-duration')).toBe(duration);
    },
  );

  it('uses the maximum particle speed multiplier in actual frame displacement', () => {
    vi.stubGlobal('CanvasRenderingContext2D', class Canvas2DContext {});
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = {
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      setTransform: vi.fn(),
      set fillStyle(_value: string) {},
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const innerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 100 },
      innerHeight: { configurable: true, value: 50 },
    });

    render(
      <ParticleField count={20} dprMode="native" paused={false} speedMultiplier={2} />,
    );
    act(() => callbacks[0]?.(16));
    act(() => callbacks[1]?.(32));

    expect(context.arc).toHaveBeenCalledTimes(40);
    expect(context.arc).toHaveBeenNthCalledWith(21, 50, 24.25, 1.65, 0, Math.PI * 2);
    if (innerWidth) Object.defineProperty(window, 'innerWidth', innerWidth);
    if (innerHeight) Object.defineProperty(window, 'innerHeight', innerHeight);
  });

  it.each([
    ['low', 6, '1.5', '-1.5'],
    ['medium', 12, '3', '-3'],
    ['high', 18, '4.5', '-4.5'],
    ['maximum', 24, '6', '-6'],
  ])(
    'uses the %s parallax amplitude in actual style writes',
    (_, amplitudePx, expectedX, expectedY) => {
      const callbacks: FrameRequestCallback[] = [];
      vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn((callback: FrameRequestCallback) => {
          callbacks.push(callback);
          return callbacks.length;
        }),
      );
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      render(<ParallaxHarness amplitudePx={amplitudePx} />);
      const target = screen.getByTestId('parallax-target');
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        bottom: 100,
        height: 100,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      fireEvent(target, new MouseEvent('pointermove', { clientX: 150, clientY: 25 }));
      act(() => callbacks[0]?.(16));

      expect(target.style.getPropertyValue('--parallax-x')).toBe(expectedX);
      expect(target.style.getPropertyValue('--parallax-y')).toBe(expectedY);
    },
  );
});
