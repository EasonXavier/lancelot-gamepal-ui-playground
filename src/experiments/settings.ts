export type GlassMode = 'real' | 'simulated' | 'preblur' | 'off';
export type MotionLevel = 'off' | 'low' | 'medium' | 'high' | 'maximum';
export type ParticleCount = 0 | 20 | 50 | 100 | 'maximum';
export type DprMode = 'native' | 'cap-2' | 'cap-1.5';
export type HudMode = 'compact' | 'expanded' | 'hidden';

export interface ExperimentSettings {
  glassMode: GlassMode;
  motionLevel: MotionLevel;
  particleCount: ParticleCount;
  backgroundMotion: boolean;
  touchParallax: boolean;
  cardFloat: boolean;
  reducedMotionSimulation: boolean;
  dprMode: DprMode;
  hudMode: HudMode;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SETTINGS_STORAGE_KEY = 'lancelot-ui-playground.settings';
const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: ExperimentSettings = {
  glassMode: 'real',
  motionLevel: 'medium',
  particleCount: 50,
  backgroundMotion: true,
  touchParallax: true,
  cardFloat: true,
  reducedMotionSimulation: false,
  dprMode: 'native',
  hudMode: 'compact',
};

const glassModes = new Set<GlassMode>([
  'real',
  'simulated',
  'preblur',
  'off',
]);
const motionLevels = new Set<MotionLevel>([
  'off',
  'low',
  'medium',
  'high',
  'maximum',
]);
const particleCounts = new Set<ParticleCount>([0, 20, 50, 100, 'maximum']);
const dprModes = new Set<DprMode>(['native', 'cap-2', 'cap-1.5']);
const hudModes = new Set<HudMode>(['compact', 'expanded', 'hidden']);

export function createDefaultSettings(): ExperimentSettings {
  return { ...DEFAULT_SETTINGS };
}

export function resetSettings(current: ExperimentSettings): ExperimentSettings {
  void current;
  return createDefaultSettings();
}

export function updateSettings(
  current: ExperimentSettings,
  patch: Partial<ExperimentSettings>,
): ExperimentSettings {
  return { ...current, ...patch };
}

export function resolveEffectiveSettings(
  requested: ExperimentSettings,
  prefersReducedMotion: boolean,
): ExperimentSettings {
  if (!prefersReducedMotion && !requested.reducedMotionSimulation) {
    return { ...requested };
  }
  return {
    ...requested,
    motionLevel: 'off',
    particleCount: 0,
    backgroundMotion: false,
    touchParallax: false,
    cardFloat: false,
  };
}

export function resolveDpr(devicePixelRatio: number, mode: DprMode): number {
  const nativeDpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  if (mode === 'cap-2') {
    return Math.min(nativeDpr, 2);
  }
  if (mode === 'cap-1.5') {
    return Math.min(nativeDpr, 1.5);
  }
  return nativeDpr;
}

export function saveSettings(
  storage: SettingsStorage,
  settings: ExperimentSettings,
): void {
  storage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings }),
  );
}

export function loadSettings(storage: SettingsStorage): ExperimentSettings {
  const serialized = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!serialized) {
    return createDefaultSettings();
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isPersistedSettings(parsed)) {
      return createDefaultSettings();
    }
    return { ...parsed.settings };
  } catch {
    return createDefaultSettings();
  }
}

const isPersistedSettings = (
  value: unknown,
): value is { schemaVersion: 1; settings: ExperimentSettings } => {
  if (!isRecord(value) || value.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
    return false;
  }
  const settings = value.settings;
  return (
    isRecord(settings) &&
    glassModes.has(settings.glassMode as GlassMode) &&
    motionLevels.has(settings.motionLevel as MotionLevel) &&
    particleCounts.has(settings.particleCount as ParticleCount) &&
    typeof settings.backgroundMotion === 'boolean' &&
    typeof settings.touchParallax === 'boolean' &&
    typeof settings.cardFloat === 'boolean' &&
    typeof settings.reducedMotionSimulation === 'boolean' &&
    dprModes.has(settings.dprMode as DprMode) &&
    hudModes.has(settings.hudMode as HudMode)
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
