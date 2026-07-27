import type { EnvironmentSnapshot, NetworkSnapshot } from './types';

export interface NetworkInformationInput {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface NavigatorEnvironmentInput {
  userAgent: string;
  hardwareConcurrency?: number;
  maxTouchPoints?: number;
  deviceMemory?: number;
  connection?: NetworkInformationInput;
}

export interface EnvironmentOptions {
  navigator?: NavigatorEnvironmentInput;
  devicePixelRatio?: number;
  prefersReducedMotion?: boolean;
}

const finiteOrNull = (value: number | undefined): number | null =>
  value !== undefined && Number.isFinite(value) ? value : null;

const collectConnection = (
  connection: NetworkInformationInput | undefined,
): NetworkSnapshot | null => {
  if (!connection) {
    return null;
  }
  return {
    effectiveType: connection.effectiveType ?? null,
    downlinkMbps: finiteOrNull(connection.downlink),
    rttMs: finiteOrNull(connection.rtt),
    saveData: connection.saveData ?? null,
  };
};

export function collectEnvironmentInfo(
  options: EnvironmentOptions = {},
): EnvironmentSnapshot {
  const browserNavigator = globalThis.navigator as NavigatorEnvironmentInput;
  const navigatorInfo = options.navigator ?? browserNavigator;
  const devicePixelRatio =
    options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1;
  const prefersReducedMotion =
    options.prefersReducedMotion ??
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false;

  return {
    userAgent: navigatorInfo.userAgent,
    isWeChat: /MicroMessenger/i.test(navigatorInfo.userAgent),
    devicePixelRatio,
    hardwareConcurrency: finiteOrNull(navigatorInfo.hardwareConcurrency),
    maxTouchPoints: navigatorInfo.maxTouchPoints ?? 0,
    deviceMemoryGb: finiteOrNull(navigatorInfo.deviceMemory),
    connection: collectConnection(navigatorInfo.connection),
    prefersReducedMotion,
  };
}
