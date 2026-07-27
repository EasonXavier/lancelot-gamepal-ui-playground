import { useCallback, useState } from 'react';
import { HomeScreen } from './experiments/home/HomeScreen';
import {
  createDefaultSettings,
  loadSettings,
  resetSettings,
  saveSettings,
  updateSettings,
  type ExperimentSettings,
} from './experiments/settings';

export function App() {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [panelOpen, setPanelOpen] = useState(false);

  const changeSettings = useCallback((patch: Partial<ExperimentSettings>) => {
    setSettings((current) => {
      const next = updateSettings(current, patch);
      persistSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings((current) => {
      const next = resetSettings(current);
      persistSettings(next);
      return next;
    });
  }, []);

  return (
    <HomeScreen
      onPanelOpenChange={setPanelOpen}
      onSettingsChange={changeSettings}
      onSettingsReset={reset}
      panelOpen={panelOpen}
      settings={settings}
    />
  );
}

function loadInitialSettings(): ExperimentSettings {
  try {
    return loadSettings(window.localStorage);
  } catch {
    return createDefaultSettings();
  }
}

function persistSettings(settings: ExperimentSettings): void {
  try {
    saveSettings(window.localStorage, settings);
  } catch {
    // The UI remains usable when storage access itself is denied.
  }
}

export default App;
