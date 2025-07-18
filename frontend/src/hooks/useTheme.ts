import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme') as ThemeMode;
    return stored || 'system';
  });

  const [isDark, setIsDark] = useState(() => {
    // Default to dark mode during initialization to prevent white flash
    const stored = localStorage.getItem('theme') as ThemeMode;
    if (stored === 'light') return false;
    if (stored === 'dark') return true;
    // For system mode, check system preference or default to dark
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply dark class immediately on page load
    const stored = localStorage.getItem('theme') as ThemeMode;
    const initialTheme = stored || 'system';
    
    let shouldBeDark = true; // Default to dark
    if (initialTheme === 'light') {
      shouldBeDark = false;
    } else if (initialTheme === 'dark') {
      shouldBeDark = true;
    } else {
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    document.documentElement.classList.toggle('dark', shouldBeDark);
    setIsDark(shouldBeDark);
    
    const applyTheme = () => {
      if (themeMode === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(systemPrefersDark);
        document.documentElement.classList.toggle('dark', systemPrefersDark);
      } else {
        const shouldBeDark = themeMode === 'dark';
        setIsDark(shouldBeDark);
        document.documentElement.classList.toggle('dark', shouldBeDark);
      }
    };

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeMode === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('theme', mode);
  };

  const cycleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setTheme(modes[nextIndex]);
  };

  const getThemeLabel = () => {
    if (themeMode === 'system') {
      return `System (${isDark ? 'Dark' : 'Light'})`;
    }
    return themeMode.charAt(0).toUpperCase() + themeMode.slice(1);
  };

  return {
    themeMode,
    isDark,
    setTheme,
    cycleTheme,
    getThemeLabel,
  };
}