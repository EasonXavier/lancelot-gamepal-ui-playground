import { describe, expect, it, vi } from 'vitest';

import { FrameSampler } from '../../src/performance/frameSampler';

class FakeRaf {
  private callback: FrameRequestCallback | null = null;
  private nextId = 1;

  request = (callback: FrameRequestCallback): number => {
    this.callback = callback;
    return this.nextId++;
  };

  cancel = (): void => {
    this.callback = null;
  };

  fire(timestamp: number): void {
    const callback = this.callback;
    this.callback = null;
    if (!callback) {
      throw new Error('No animation frame is scheduled');
    }
    callback(timestamp);
  }

  hasScheduledFrame(): boolean {
    return this.callback !== null;
  }
}

describe('FrameSampler', () => {
  it('keeps only the newest intervals in a fixed-capacity buffer', () => {
    const raf = new FakeRaf();
    const sampler = new FrameSampler({
      capacity: 3,
      publishIntervalMs: 250,
      requestFrame: raf.request,
      cancelFrame: raf.cancel,
    });

    sampler.start();
    raf.fire(0);
    raf.fire(10);
    raf.fire(21);
    raf.fire(33);
    raf.fire(46);

    expect(sampler.getSnapshot().intervals).toEqual([11, 12, 13]);
  });

  it('publishes snapshots no faster than the configured interval', () => {
    const raf = new FakeRaf();
    const listener = vi.fn();
    const sampler = new FrameSampler({
      capacity: 20,
      publishIntervalMs: 250,
      requestFrame: raf.request,
      cancelFrame: raf.cancel,
    });

    sampler.subscribe(listener);
    sampler.start();
    raf.fire(0);
    raf.fire(100);
    raf.fire(200);
    raf.fire(249);
    expect(listener).not.toHaveBeenCalled();

    raf.fire(250);
    expect(listener).toHaveBeenCalledTimes(1);
    raf.fire(300);
    raf.fire(500);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('pauses and discards the background gap before recalibrating', () => {
    const raf = new FakeRaf();
    const sampler = new FrameSampler({
      capacity: 10,
      publishIntervalMs: 250,
      requestFrame: raf.request,
      cancelFrame: raf.cancel,
    });

    sampler.start();
    raf.fire(0);
    raf.fire(16);
    sampler.pause();
    expect(raf.hasScheduledFrame()).toBe(false);

    sampler.resume();
    raf.fire(10_000);
    raf.fire(10_016);

    expect(sampler.getSnapshot().intervals).toEqual([16, 16]);
    expect(sampler.getSnapshot().needsCalibration).toBe(false);
  });

  it('cleans up the RAF loop and resets accumulated samples', () => {
    const raf = new FakeRaf();
    const sampler = new FrameSampler({
      capacity: 4,
      publishIntervalMs: 250,
      requestFrame: raf.request,
      cancelFrame: raf.cancel,
    });

    sampler.start();
    raf.fire(0);
    raf.fire(16);
    sampler.stop();
    expect(raf.hasScheduledFrame()).toBe(false);

    sampler.reset();
    expect(sampler.getSnapshot().intervals).toEqual([]);
    expect(sampler.getSnapshot().needsCalibration).toBe(true);
  });
});
