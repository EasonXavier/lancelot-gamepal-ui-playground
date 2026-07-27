import { useEffect, useRef } from 'react';
import { resolveDpr, type DprMode, type ParticleCount } from '../settings';
import './motion.css';

export const MAXIMUM_PARTICLES = 160;

export interface ParticleFieldProps {
  count: ParticleCount;
  dprMode: DprMode;
  paused: boolean;
  speedMultiplier: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
}

interface CanvasSize {
  width: number;
  height: number;
  dpr: number;
}

const EMPTY_SIZE: CanvasSize = { width: 0, height: 0, dpr: 0 };

export function ParticleField({
  count,
  dprMode,
  paused,
  speedMultiplier,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const sizeRef = useRef<CanvasSize>(EMPTY_SIZE);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || count === 0 || paused) return undefined;

    const particleCount = count === 'maximum' ? MAXIMUM_PARTICLES : count;
    particlesRef.current = createParticles(particleCount);
    let lastTimestamp = 0;
    let context: CanvasRenderingContext2D | null = null;
    let transformedDpr = 0;

    const resize = () => {
      const dpr = resolveDpr(window.devicePixelRatio, dprMode);
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const nextSize = { width, height, dpr };
      const previousSize = sizeRef.current;

      const backingStoreMatches =
        previousSize.width === nextSize.width &&
        previousSize.height === nextSize.height &&
        previousSize.dpr === nextSize.dpr;

      if (!backingStoreMatches) {
        sizeRef.current = nextSize;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      if (context && (!backingStoreMatches || transformedDpr !== dpr)) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        transformedDpr = dpr;
      }
      return nextSize;
    };

    const draw = (timestamp: number) => {
      if (typeof CanvasRenderingContext2D === 'undefined') {
        frameRef.current = null;
        return;
      }
      context ??= canvas.getContext('2d');
      if (!context) {
        frameRef.current = null;
        return;
      }
      const drawingContext = context;
      const size = resize();
      const elapsed = lastTimestamp === 0 ? 0 : Math.min(timestamp - lastTimestamp, 40);
      lastTimestamp = timestamp;
      drawingContext.clearRect(0, 0, size.width, size.height);
      drawingContext.fillStyle = 'rgb(237 195 144 / 0.28)';

      particlesRef.current.forEach((particle) => {
        particle.y -= (particle.speed * speedMultiplier * elapsed) / 16;
        if (particle.y < -particle.size) particle.y = size.height + particle.size;
        drawingContext.beginPath();
        drawingContext.arc(
          particle.x * size.width,
          particle.y,
          particle.size,
          0,
          Math.PI * 2,
        );
        drawingContext.fill();
      });

      frameRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    frameRef.current = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [count, dprMode, paused, speedMultiplier]);

  return (
    <canvas
      aria-hidden="true"
      className="particle-field"
      data-testid="particle-field"
      ref={canvasRef}
    />
  );
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    size: 0.7 + Math.random() * 1.9,
    speed: 0.15 + Math.random() * 0.45,
    x: Math.random(),
    y: Math.random() * window.innerHeight,
  }));
}
