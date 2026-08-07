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
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { useWeather } from '@/lib/hooks/useWeather';
import { applyAppTheme, isAppThemeId, type AppThemeId } from '@/lib/themes/appThemes';
import {
  applySunsetOffset,
  getNextSolarTransition,
  normalizeSunsetOffsetMinutes,
  resolveSunsetTheme,
} from '@/lib/themes/sunsetTheme';

/**
 * Theme modes
 */
export type ThemeMode = 'light' | 'dark' | 'system' | 'sunset';

/**
 * Theme context value
 */
interface ThemeContextValue {
  /** Current theme setting (light, dark, system, or sunset) */
  theme: ThemeMode;
  /** Resolved theme (light or dark - what's actually shown) */
  resolvedTheme: 'light' | 'dark';
  /** Update the theme */
  setTheme: (theme: ThemeMode) => void;
  /** Minutes to shift sunset mode's transition. Positive values delay dark mode. */
  sunsetOffsetMinutes: number;
  /** Update the sunset mode transition offset. */
  setSunsetOffsetMinutes: (minutes: number) => void;
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
const SUNSET_OFFSET_STORAGE_KEY = 'prism-sunset-offset';
const COLOR_THEME_STORAGE_KEY = 'prism-color-theme';
const DEFAULT_COLOR_THEME: AppThemeId = 'kitchen-calm';

/**
 * Get the system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

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
export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [sunsetOffsetMinutes, setSunsetOffsetState] = useState(0);
  const [colorTheme, setColorThemeState] = useState<AppThemeId>(DEFAULT_COLOR_THEME);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [solarTick, setSolarTick] = useState(0);
  const hasAppliedThemeRef = useRef(false);
  const previousAppliedThemeRef = useRef<{
    resolvedTheme: 'light' | 'dark';
    colorTheme: AppThemeId;
  } | null>(null);

  // Sunset mode only needs weather data when it is selected. The weather
  // response carries the resolved location coordinates used for solar timing.
  const { data: sunsetWeather } = useWeather({
    enabled: mounted && theme === 'sunset',
    refreshInterval: 60 * 1000,
  });

  // On mount, load saved theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'system', 'sunset'].includes(stored)) {
      setThemeState(stored);
    }
    const storedSunsetOffset = Number(localStorage.getItem(SUNSET_OFFSET_STORAGE_KEY));
    if (Number.isFinite(storedSunsetOffset)) {
      setSunsetOffsetState(normalizeSunsetOffsetMinutes(storedSunsetOffset));
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
    if (colorTheme === 'lcars') {
      actualTheme = 'dark';
    } else if (theme === 'system') {
      actualTheme = getSystemTheme();
    } else if (theme === 'sunset') {
      actualTheme =
        resolveSunsetTheme(
          new Date(),
          sunsetWeather?.lat !== undefined && sunsetWeather.lon !== undefined
            ? { lat: sunsetWeather.lat, lon: sunsetWeather.lon }
            : undefined,
          sunsetWeather?.sunset,
          sunsetOffsetMinutes
        ) ?? getSystemTheme();
    } else {
      actualTheme = theme;
    }

    const applyTheme = () => {
      // Apply or remove dark class
      if (actualTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      applyAppTheme(colorTheme, actualTheme);
      setResolvedTheme(actualTheme);
    };

    const previousTheme = previousAppliedThemeRef.current;
    const themeChanged =
      previousTheme !== null &&
      (previousTheme.resolvedTheme !== actualTheme || previousTheme.colorTheme !== colorTheme);
    const transitionDocument = document as ViewTransitionDocument;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (
      !hasAppliedThemeRef.current ||
      !themeChanged ||
      prefersReducedMotion ||
      typeof transitionDocument.startViewTransition !== 'function'
    ) {
      applyTheme();
    } else {
      try {
        transitionDocument.startViewTransition(applyTheme);
      } catch {
        // Older or partially implemented browsers can expose the API but
        // still reject it; the theme update itself must never be blocked.
        applyTheme();
      }
    }

    hasAppliedThemeRef.current = true;
    previousAppliedThemeRef.current = { resolvedTheme: actualTheme, colorTheme };
  }, [theme, colorTheme, mounted, sunsetWeather, sunsetOffsetMinutes, solarTick]);

  // Schedule the exact next sunrise/sunset transition. Weather polling is
  // still useful as a fallback when a provider does not return coordinates.
  useEffect(() => {
    if (!mounted || theme !== 'sunset') return;

    const now = new Date();
    const coordinates =
      sunsetWeather?.lat !== undefined && sunsetWeather.lon !== undefined
        ? { lat: sunsetWeather.lat, lon: sunsetWeather.lon }
        : undefined;
    const fallbackSunset = sunsetWeather?.sunset
      ? applySunsetOffset(sunsetWeather.sunset, sunsetOffsetMinutes)
      : null;
    const nextTransition =
      getNextSolarTransition(now, coordinates, sunsetOffsetMinutes) ??
      (fallbackSunset && fallbackSunset.getTime() > now.getTime() ? fallbackSunset : null);

    if (!nextTransition) return;

    const delay = Math.max(0, nextTransition.getTime() - now.getTime()) + 50;
    const timer = window.setTimeout(() => setSolarTick((tick) => tick + 1), delay);
    return () => window.clearTimeout(timer);
  }, [mounted, theme, sunsetOffsetMinutes, sunsetWeather, solarTick]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = colorTheme === 'lcars' || e.matches ? 'dark' : 'light';
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

  const setSunsetOffsetMinutes = (minutes: number) => {
    const normalizedMinutes = normalizeSunsetOffsetMinutes(minutes);
    setSunsetOffsetState(normalizedMinutes);
    localStorage.setItem(SUNSET_OFFSET_STORAGE_KEY, String(normalizedMinutes));
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
      <ThemeContext.Provider
        value={{
          theme: defaultTheme,
          resolvedTheme: 'light',
          setTheme,
          sunsetOffsetMinutes,
          setSunsetOffsetMinutes,
          colorTheme,
          setColorTheme,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        sunsetOffsetMinutes,
        setSunsetOffsetMinutes,
        colorTheme,
        setColorTheme,
      }}
    >
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
