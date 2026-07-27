import { describe, expect, it } from 'vitest';

import {
  SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  loadSettings,
  resetSettings,
  resolveDpr,
  resolveEffectiveSettings,
  saveSettings,
  updateSettings,
  type SettingsStorage,
} from '../../src/experiments/settings';

class MemoryStorage implements SettingsStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('experiment settings', () => {
  it('changes the single active glass mode without mutating the prior snapshot', () => {
    const initial = createDefaultSettings();
    const updated = updateSettings(initial, { glassMode: 'preblur' });

    expect(initial.glassMode).toBe('real');
    expect(updated.glassMode).toBe('preblur');
    expect(updated).not.toBe(initial);
    expect(updated.motionLevel).toBe(initial.motionLevel);
  });

  it('applies reduced motion without mutating the requested settings', () => {
    const requested = updateSettings(createDefaultSettings(), {
      motionLevel: 'maximum',
      particleCount: 'maximum',
      backgroundMotion: true,
      touchParallax: true,
      cardFloat: true,
    });

    const effective = resolveEffectiveSettings(requested, true);

    expect(effective).toMatchObject({
      motionLevel: 'off',
      particleCount: 0,
      backgroundMotion: false,
      touchParallax: false,
      cardFloat: false,
    });
    expect(requested.motionLevel).toBe('maximum');
    expect(requested.particleCount).toBe('maximum');
  });

  it('honors the native DPR and both explicit caps', () => {
    expect(resolveDpr(3, 'native')).toBe(3);
    expect(resolveDpr(3, 'cap-2')).toBe(2);
    expect(resolveDpr(3, 'cap-1.5')).toBe(1.5);
    expect(resolveDpr(1.25, 'cap-1.5')).toBe(1.25);
  });

  it('persists a schema-versioned snapshot and restores it without sharing state', () => {
    const storage = new MemoryStorage();
    const settings = updateSettings(createDefaultSettings(), {
      glassMode: 'simulated',
      motionLevel: 'high',
      dprMode: 'cap-2',
    });

    saveSettings(storage, settings);
    const serialized = storage.getItem(SETTINGS_STORAGE_KEY);
    const restored = loadSettings(storage);

    expect(JSON.parse(serialized ?? '')).toEqual({
      schemaVersion: 1,
      settings,
    });
    expect(restored).toEqual(settings);
    expect(restored).not.toBe(settings);
  });

  it('resets to defaults when persisted data has an unknown schema', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, settings: { glassMode: 'off' } }),
    );

    const restored = loadSettings(storage);
    const secondDefault = createDefaultSettings();

    expect(restored).toEqual(secondDefault);
    expect(restored).not.toBe(secondDefault);
  });

  it('resets changed settings to a fresh default snapshot', () => {
    const changed = updateSettings(createDefaultSettings(), {
      glassMode: 'off',
      motionLevel: 'maximum',
      particleCount: 'maximum',
      hudMode: 'expanded',
    });

    const reset = resetSettings(changed);

    expect(reset).toEqual(createDefaultSettings());
    expect(reset).not.toBe(changed);
  });
});
