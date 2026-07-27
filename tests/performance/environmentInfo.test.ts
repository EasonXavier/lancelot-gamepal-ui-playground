import { describe, expect, it } from 'vitest';

import { collectEnvironmentInfo } from '../../src/performance/environmentInfo';

describe('collectEnvironmentInfo', () => {
  it('keeps unavailable device memory and network fields null', () => {
    const snapshot = collectEnvironmentInfo({
      navigator: {
        userAgent: 'Mozilla/5.0 Mobile Safari/537.36',
        hardwareConcurrency: 8,
        maxTouchPoints: 0,
      },
      devicePixelRatio: 2,
      prefersReducedMotion: true,
    });

    expect(snapshot.deviceMemoryGb).toBeNull();
    expect(snapshot.connection).toBeNull();
    expect(snapshot.hardwareConcurrency).toBe(8);
    expect(snapshot.prefersReducedMotion).toBe(true);
    expect(snapshot.isWeChat).toBe(false);
  });

  it('reports available browser environment fields without inventing values', () => {
    const snapshot = collectEnvironmentInfo({
      navigator: {
        userAgent: 'Mozilla/5.0 MicroMessenger/8.0.50',
        hardwareConcurrency: 6,
        maxTouchPoints: 5,
        deviceMemory: 8,
        connection: {
          effectiveType: '4g',
          downlink: 9.5,
          rtt: 45,
          saveData: false,
        },
      },
      devicePixelRatio: 3,
      prefersReducedMotion: false,
    });

    expect(snapshot).toMatchObject({
      isWeChat: true,
      devicePixelRatio: 3,
      hardwareConcurrency: 6,
      maxTouchPoints: 5,
      deviceMemoryGb: 8,
      connection: {
        effectiveType: '4g',
        downlinkMbps: 9.5,
        rttMs: 45,
        saveData: false,
      },
    });
  });
});
