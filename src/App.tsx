import { useState, useEffect } from 'react';
import { HomeHub } from './components/home/HomeHub';
import { StudioLayout } from './components/layout/StudioLayout';

export type ViewMode = 'home' | 'studio';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('syscraft-theme');
      return saved !== null ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  // Keep document element theme class synchronized
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('syscraft-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const handleLaunchWorkbench = (week: number) => {
    setSelectedWeek(week);
    setViewMode('studio');
  };

  const handleBackToHub = () => {
    setViewMode('home');
  };

  if (viewMode === 'home') {
    return (
      <HomeHub
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLaunchWorkbench={handleLaunchWorkbench}
      />
    );
  }

  return (
    <StudioLayout
      initialWeek={selectedWeek}
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onNavigateHome={handleBackToHub}
    />
  );
}
