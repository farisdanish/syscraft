import { useState, useEffect } from 'react';
import { HomeHub } from './components/home/HomeHub';
import { AboutArchitecture } from './components/about/AboutArchitecture';
import { StudioLayout } from './components/layout/StudioLayout';
import { getAllTaskStates } from './services/storage';
import { CURRICULUM_TASKS, resolveNextActionableTask } from './data/curriculumTasks';
import type { TaskState } from './types';

export type ViewMode = 'curriculum' | 'architecture' | 'studio';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('curriculum');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [actionableWeek, setActionableWeek] = useState<number>(1);
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

  // Refresh active frontier for architecture view on navigation
  useEffect(() => {
    if (viewMode !== 'architecture') return;
    let active = true;
    void getAllTaskStates()
      .then((stored) => {
        if (!active) return;
        const stateMap: Record<string, TaskState> = {};
        for (const s of stored) {
          stateMap[s.taskId] = s;
        }
        const action = resolveNextActionableTask(CURRICULUM_TASKS, stateMap);
        setActionableWeek(action.week);
      })
      .catch((err) => {
        console.warn('[App] Failed to resolve actionable week for architecture view:', err);
      });
    return () => {
      active = false;
    };
  }, [viewMode]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const handleLaunchWorkbench = (week: number) => {
    setSelectedWeek(week);
    setViewMode('studio');
  };

  const handleNavigateCurriculum = () => {
    setViewMode('curriculum');
  };

  const handleNavigateArchitecture = () => {
    setViewMode('architecture');
  };

  if (viewMode === 'architecture') {
    return (
      <AboutArchitecture
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onNavigateHome={handleNavigateCurriculum}
        onLaunchWorkbench={handleLaunchWorkbench}
        actionableWeek={actionableWeek}
      />
    );
  }

  if (viewMode === 'studio') {
    return (
      <StudioLayout
        initialWeek={selectedWeek}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onNavigateHome={handleNavigateCurriculum}
        onNavigateArchitecture={handleNavigateArchitecture}
      />
    );
  }

  return (
    <HomeHub
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onLaunchWorkbench={handleLaunchWorkbench}
      onNavigateArchitecture={handleNavigateArchitecture}
    />
  );
}
