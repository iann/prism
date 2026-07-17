/**
 *
 * Manages dark/light mode theming throughout the application.
 * Persists user preference to localStorage and respects system preference.
 *
 * HOW IT WORKS:
 * 1. On mount, checks localStorage for saved preference
 * 2. If "system", listens for OS dark mode changes
 * 3. Applies "dark" class to <html> element when dark mode is active
 * 4. Provides context for components to read/change theme
 *
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { applyAppTheme, isAppThemeId, type AppThemeId } from '@/lib/themes/appThemes';

/**
 * Theme modes
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Theme context value
 */
interface ThemeContextValue {
  /** Current theme setting (light, dark, or system) */
  theme: ThemeMode;
  /** Resolved theme (light or dark - what's actually shown) */
  resolvedTheme: 'light' | 'dark';
  /** Update the theme */
  setTheme: (theme: ThemeMode) => void;
  /** Named color palette applied to all semantic surfaces and widgets. */
  colorTheme: AppThemeId;
  /** Update the named color palette. */
  setColorTheme: (theme: AppThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Storage key for persisting theme preference
 */
const STORAGE_KEY = 'prism-theme';
const COLOR_THEME_STORAGE_KEY = 'prism-color-theme';
const DEFAULT_COLOR_THEME: AppThemeId = 'kitchen-calm';

/**
 * Get the system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Theme Provider Props
 */
interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if none is stored */
  defaultTheme?: ThemeMode;
}

/**
 * THEME PROVIDER COMPONENT
 * Wrap your app with this provider to enable theming.
 *
 * @example
 * <ThemeProvider defaultTheme="system">
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [colorTheme, setColorThemeState] = useState<AppThemeId>(DEFAULT_COLOR_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // On mount, load saved theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
    const storedColorTheme = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (isAppThemeId(storedColorTheme)) setColorThemeState(storedColorTheme);
    setMounted(true);
  }, []);

  // Apply theme to document and resolve system theme
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Determine the actual theme to apply
    let actualTheme: 'light' | 'dark';
    if (theme === 'system') {
      actualTheme = getSystemTheme();
    } else {
      actualTheme = theme;
    }

    // Apply or remove dark class
    if (actualTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    setResolvedTheme(actualTheme);
    applyAppTheme(colorTheme, actualTheme);
  }, [theme, colorTheme, mounted]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);
      applyAppTheme(colorTheme, newTheme);

      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, colorTheme, mounted]);

  // Update theme and persist to localStorage
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const setColorTheme = (newTheme: AppThemeId) => {
    setColorThemeState(newTheme);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, newTheme);
  };

  // Apply seasonal theme CSS variables globally
  useSeasonalTheme();
  // Apply performance-mode class on <html> from localStorage preference
  usePerformanceMode();

  // Prevent flash of wrong theme during SSR
  // Return null or a loading state until mounted
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: defaultTheme, resolvedTheme: 'light', setTheme, colorTheme, setColorTheme }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * USE THEME HOOK
 * Access the current theme and setTheme function from any component.
 *
 * @example
 * const { theme, setTheme, resolvedTheme } = useTheme();
 * setTheme('dark'); // Switch to dark mode
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
