import { useState } from 'react';
import { HomeScreen } from './experiments/home/HomeScreen';
import { createDefaultSettings } from './experiments/settings';

export function App() {
  const [settings] = useState(createDefaultSettings);
  return <HomeScreen settings={settings} />;
}

export default App;
