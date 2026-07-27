import { summarizeFrameIntervals } from './frameMath';
import { RingBuffer } from './ringBuffer';
import type { FrameSamplerSnapshot } from './types';

interface FrameSamplerOptions {
  capacity?: number;
  publishIntervalMs?: number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
}

export class FrameSampler {
  private readonly intervals: RingBuffer<number>;
  private readonly publishIntervalMs: number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly listeners = new Set<() => void>();
  private frameHandle: number | null = null;
  private lastTimestamp: number | null = null;
  private lastPublishedTimestamp: number | null = null;
  private started = false;
  private paused = false;
  private needsCalibration = true;

  constructor(options: FrameSamplerOptions = {}) {
    this.intervals = new RingBuffer(options.capacity ?? 3600);
    this.publishIntervalMs = options.publishIntervalMs ?? 250;
    this.requestFrame =
      options.requestFrame ?? ((callback) => window.requestAnimationFrame(callback));
    this.cancelFrame =
      options.cancelFrame ?? ((handle) => window.cancelAnimationFrame(handle));
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.paused = false;
    this.schedule();
  }

  pause(): void {
    if (!this.started || this.paused) {
      return;
    }
    this.paused = true;
    this.cancelScheduledFrame();
    this.lastTimestamp = null;
    this.lastPublishedTimestamp = null;
    this.needsCalibration = true;
  }

  resume(): void {
    if (!this.started || !this.paused) {
      return;
    }
    this.paused = false;
    this.lastTimestamp = null;
    this.lastPublishedTimestamp = null;
    this.schedule();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.cancelScheduledFrame();
    this.started = false;
    this.paused = false;
    this.lastTimestamp = null;
    this.lastPublishedTimestamp = null;
  }

  reset(): void {
    this.intervals.clear();
    this.lastTimestamp = null;
    this.lastPublishedTimestamp = null;
    this.needsCalibration = true;
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): FrameSamplerSnapshot {
    const intervals = this.intervals.toArray();
    return {
      intervals,
      metrics: summarizeFrameIntervals(intervals),
      isRunning: this.started && !this.paused,
      needsCalibration: this.needsCalibration,
    };
  }

  private readonly onFrame = (timestamp: number): void => {
    this.frameHandle = null;
    if (!this.started || this.paused) {
      return;
    }

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      this.lastPublishedTimestamp = timestamp;
    } else {
      const interval = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      if (Number.isFinite(interval) && interval > 0 && interval <= 1000) {
        this.intervals.push(interval);
        this.needsCalibration = false;
      }
      if (
        this.lastPublishedTimestamp !== null &&
        timestamp - this.lastPublishedTimestamp >= this.publishIntervalMs
      ) {
        this.lastPublishedTimestamp = timestamp;
        this.emit();
      }
    }

    this.schedule();
  };

  private schedule(): void {
    if (this.frameHandle === null && this.started && !this.paused) {
      this.frameHandle = this.requestFrame(this.onFrame);
    }
  }

  private cancelScheduledFrame(): void {
    if (this.frameHandle !== null) {
      this.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
