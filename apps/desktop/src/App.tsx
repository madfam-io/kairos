import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';

import { Layout } from '~/components/Layout';
import { HomePage } from '~/pages/HomePage';
import { PlayerPage } from '~/pages/PlayerPage';
import { LibraryPage } from '~/pages/LibraryPage';
import { VocabularyPage } from '~/pages/VocabularyPage';
import { SettingsPage } from '~/pages/SettingsPage';
import { useSettingsStore } from '~/store/settings';

function App() {
  const { theme } = useSettingsStore();

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="player" element={<PlayerPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="vocabulary" element={<VocabularyPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
