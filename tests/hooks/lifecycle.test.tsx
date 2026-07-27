import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { ParticleField } from '../../src/experiments/motion/ParticleField';
import { useTouchParallax } from '../../src/experiments/motion/useTouchParallax';
import { useReducedMotion } from '../../src/hooks/useReducedMotion';
import { useViewportHeight } from '../../src/hooks/useViewportHeight';
import { useVisibility } from '../../src/hooks/useVisibility';

type MediaQueryListener = (event: MediaQueryListEvent) => void;

interface ControllableMediaQuery {
  media: string;
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setMatches: (matches: boolean) => void;
}

function createMediaQuery(initialMatches: boolean): ControllableMediaQuery {
  const listeners = new Set<MediaQueryListener>();
  const query: ControllableMediaQuery = {
    media: '(prefers-reduced-motion: reduce)',
    matches: initialMatches,
    addEventListener: vi.fn((type: string, listener: MediaQueryListener) => {
      if (type === 'change') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: MediaQueryListener) => {
      if (type === 'change') listeners.delete(listener);
    }),
    setMatches: (matches: boolean) => {
      query.matches = matches;
      listeners.forEach((listener) =>
        listener({ matches, media: query.media } as MediaQueryListEvent),
      );
    },
  };
  return query;
}

function ViewportHarness() {
  useViewportHeight();
  return null;
}

function VisibilityHarness() {
  const visible = useVisibility();
  return <output>{visible ? 'visible' : 'hidden'}</output>;
}

function ReducedMotionHarness() {
  const reduced = useReducedMotion();
  return <output>{reduced ? 'reduced' : 'full'}</output>;
}

function ParallaxHarness({ enabled = true }: { enabled?: boolean }) {
  const target = useRef<HTMLDivElement>(null);
  useTouchParallax(target, enabled);
  return <div data-testid="parallax-target" ref={target} />;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('viewport and preference hooks', () => {
  it('catches removing viewport lifecycle cleanup by updating the app height and removing both passive listeners', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });

    const { unmount } = render(<ViewportHarness />);

    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe(
      '720px',
    );
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
    expect(add).toHaveBeenCalledWith('orientationchange', expect.any(Function), {
      passive: true,
    });

    unmount();

    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    if (innerHeight) Object.defineProperty(window, 'innerHeight', innerHeight);
  });

  it('catches stale visibility state by updating on visibilitychange and cleaning up its listener', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    const { unmount } = render(<VisibilityHarness />);
    expect(screen.getByRole('status')).toHaveTextContent('visible');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('status')).toHaveTextContent('hidden');

    unmount();
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
  });

  it('catches an ignored system preference change by subscribing to and cleaning up the motion media query', () => {
    const mediaQuery = createMediaQuery(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    );

    const { unmount } = render(<ReducedMotionHarness />);
    expect(screen.getByRole('status')).toHaveTextContent('full');

    act(() => mediaQuery.setMatches(true));
    expect(screen.getByRole('status')).toHaveTextContent('reduced');

    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('catches bypassing effective reduced-motion settings by removing particles and parallax work without changing the page', () => {
    const mediaQuery = createMediaQuery(true);
    const request = vi.fn<(callback: FrameRequestCallback) => number>(() => 61);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    );
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<App />);
    const page = screen.getByRole('main');
    fireEvent(page, new MouseEvent('pointermove', { clientX: 30, clientY: 30 }));

    expect(page).toHaveAttribute('data-motion-level', 'off');
    expect(page).toHaveAttribute('data-card-float', 'false');
    expect(screen.queryByTestId('particle-field')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('motion lifecycle', () => {
  it('catches a particle ceiling or DPR regression by drawing 160 maximum particles into a capped backing store', () => {
    vi.stubGlobal('CanvasRenderingContext2D', class Canvas2DContext {});
    const context = {
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      setTransform: vi.fn(),
      set fillStyle(_value: string) {},
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context);
    const frame = vi.fn<(callback: FrameRequestCallback) => number>(() => 1);
    vi.stubGlobal('requestAnimationFrame', frame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const dpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 100 },
      innerHeight: { configurable: true, value: 50 },
      devicePixelRatio: { configurable: true, value: 3 },
    });

    render(<ParticleField count="maximum" dprMode="cap-2" paused={false} />);

    expect(screen.getByTestId('particle-field')).toHaveAttribute('width', '200');
    expect(screen.getByTestId('particle-field')).toHaveAttribute('height', '100');
    frame.mock.calls[0]?.[0](16);
    expect(getContext).toHaveBeenCalledOnce();
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(context.arc).toHaveBeenCalledTimes(160);
    if (width) Object.defineProperty(window, 'innerWidth', width);
    if (height) Object.defineProperty(window, 'innerHeight', height);
    if (dpr) Object.defineProperty(window, 'devicePixelRatio', dpr);
  });

  it('catches an orphaned canvas loop by cancelling its one queued frame on unmount', () => {
    vi.stubGlobal('CanvasRenderingContext2D', class Canvas2DContext {});
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 27),
    );
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { unmount } = render(
      <ParticleField count={20} dprMode="cap-2" paused={false} />,
    );
    unmount();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(27);
  });

  it('catches continued hidden rendering by stopping the canvas loop while paused and restarting it when visible', () => {
    vi.stubGlobal('CanvasRenderingContext2D', class Canvas2DContext {});
    const request = vi.fn(() => 31);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { rerender } = render(<ParticleField count={20} dprMode="native" paused />);
    expect(request).not.toHaveBeenCalled();

    rerender(<ParticleField count={20} dprMode="native" paused={false} />);
    expect(request).toHaveBeenCalledTimes(1);

    rerender(<ParticleField count={20} dprMode="native" paused />);
    expect(cancel).toHaveBeenCalledWith(31);
  });

  it('catches duplicated parallax work by batching passive pointer and touch input into one frame', () => {
    const request = vi.fn<(callback: FrameRequestCallback) => number>(() => 45);
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    render(<ParallaxHarness />);
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
    fireEvent(target, new MouseEvent('pointermove', { clientX: 150, clientY: 25 }));
    const touch = new Event('touchmove');
    Object.defineProperty(touch, 'touches', { value: [{ clientX: 150, clientY: 25 }] });
    fireEvent(target, touch);

    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function), {
      passive: true,
    });
    expect(add).toHaveBeenCalledWith('touchmove', expect.any(Function), {
      passive: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
    const queuedFrame = request.mock.calls[0]?.[0];
    if (!queuedFrame) throw new Error('Expected parallax input to queue a frame');
    queuedFrame(16);
    expect(target.style.getPropertyValue('--parallax-x')).toBe('0.25');
    expect(target.style.getPropertyValue('--parallax-y')).toBe('-0.25');
  });

  it('catches StrictMode parallax listener leaks by replaying and removing every input subscription', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener');

    const { unmount } = render(
      <StrictMode>
        <ParallaxHarness />
      </StrictMode>,
    );
    unmount();

    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function), {
      passive: true,
    });
    expect(add).toHaveBeenCalledWith('touchmove', expect.any(Function), {
      passive: true,
    });
    expect(remove.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(
      2,
    );
    expect(remove.mock.calls.filter(([type]) => type === 'touchmove')).toHaveLength(2);
  });
});
