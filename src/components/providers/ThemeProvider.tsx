/**
 *
 * Manages dark/light mode and the selected colour palette throughout the
 * application. Brightness is a per-display preference; the palette is a
 * household setting shared by every display.
 *
 * The provider keeps the original named-theme system (including its extended
 * widget and weather tokens) alongside the gallery theme contract. Gallery
 * themes are deliberately applied through the allowlisted token writer, while
 * trusted personal themes continue to use their complete token sets.
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { useWeather } from '@/lib/hooks/useWeather';
import {
  appThemes,
  applyAppTheme,
  isAppThemeId,
  type AppThemeId,
} from '@/lib/themes/appThemes';
import {
  applySunsetOffset,
  getNextSolarTransition,
  normalizeSunsetOffsetMinutes,
  resolveSunsetTheme,
} from '@/lib/themes/sunsetTheme';
import { isInstallableTheme, type Theme } from '@/lib/themes/tokens';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from '@/lib/themes/appThemes';
import { applyThemeVars, themeTokens } from '@/lib/themes/applyTheme';

/** Theme modes supported by the display brightness control. */
export type ThemeMode = 'light' | 'dark' | 'system' | 'sunset';

interface ThemeContextValue {
  /** Current brightness setting. */
  theme: ThemeMode;
  /** Resolved brightness currently shown. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  /** Minutes to shift sunset mode's transition. Positive values delay dark mode. */
  sunsetOffsetMinutes: number;
  setSunsetOffsetMinutes: (minutes: number) => void;
  /** Legacy/trusted named palette identifier, retained for personal UI code. */
  colorTheme: string;
  setColorTheme: (theme: string) => void;
  /** The currently selected gallery-compatible palette. */
  palette: Theme;
  /** Every built-in and installed palette available to the picker. */
  palettes: Theme[];
  setPalette: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'prism-theme';
const SUNSET_OFFSET_STORAGE_KEY = 'prism-sunset-offset';
const COLOR_THEME_STORAGE_KEY = 'prism-color-theme';
const DEFAULT_COLOR_THEME: AppThemeId = 'daybook';
const THEME_SETTING_KEY = 'theme';

// Personal themes own more than the gallery's core token set. Remove those
// properties before applying a gallery palette so values from a previous
// personal theme cannot leak into a gallery selection.
const PERSONAL_THEME_PROPERTIES = [
  ...new Set(
    Object.values(appThemes).flatMap((theme) => [
      ...Object.keys(theme.light),
      ...Object.keys(theme.dark),
    ]),
  ),
];

function clearPersonalThemeVars(root: HTMLElement) {
  for (const property of PERSONAL_THEME_PROPERTIES) root.style.removeProperty(property);
}

function applySelectedPalette(
  root: HTMLElement,
  colorTheme: string,
  palette: Theme,
  mode: 'light' | 'dark',
) {
  clearPersonalThemeVars(root);

  if (isAppThemeId(colorTheme)) {
    applyAppTheme(colorTheme, mode);
    return;
  }

  root.dataset.colorTheme = colorTheme;
  applyThemeVars(root, themeTokens(palette, mode));
}

function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> | null {
  if (typeof fetch !== 'function') return null;
  try {
    return fetch(input, init);
  } catch {
    // Relative URLs throw in a few non-browser test environments. The local
    // setting has already been applied, so persistence can safely be retried
    // on the next real browser load.
    return null;
  }
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  /** Palette selected by the server, used to keep hydration and first paint aligned. */
  initialPalette?: Theme;
  /** Legacy local palette preferences are safe to use only without a stored server palette. */
  initialPaletteIsExplicit?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  initialPalette,
  initialPaletteIsExplicit = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [sunsetOffsetMinutes, setSunsetOffsetState] = useState(0);
  const [colorTheme, setColorThemeState] = useState<string>(
    () => initialPalette?.id ?? DEFAULT_COLOR_THEME,
  );
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [solarTick, setSolarTick] = useState(0);
  const [installedThemes, setInstalledThemes] = useState<Theme[]>([]);
  const [palette, setPaletteState] = useState<Theme>(
    () => initialPalette ?? getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!,
  );
  const hasAppliedThemeRef = useRef(false);
  const previousAppliedThemeRef = useRef<{
    resolvedTheme: 'light' | 'dark';
    colorTheme: string;
  } | null>(null);

  // Sunset mode only needs weather data when selected. The weather response
  // carries the resolved location coordinates used for solar timing.
  const { data: sunsetWeather } = useWeather({
    enabled: mounted && theme === 'sunset',
    refreshInterval: 60 * 1000,
  });

  // Load display-local brightness and legacy named-palette preferences first.
  // An explicit server palette is already in the initial state and is the
  // household source of truth, so a stale local preference must not flash over
  // it while the settings request is in flight. If no palette has ever been
  // persisted, retain the pre-gallery local preference for backwards
  // compatibility and let the settings request reconcile it if available.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'system', 'sunset'].includes(stored)) {
      setThemeState(stored);
    }

    const storedSunsetOffset = Number(localStorage.getItem(SUNSET_OFFSET_STORAGE_KEY));
    if (Number.isFinite(storedSunsetOffset)) {
      setSunsetOffsetState(normalizeSunsetOffsetMinutes(storedSunsetOffset));
    }

    if (!initialPaletteIsExplicit) {
      const storedColorTheme = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
      const storedPalette = storedColorTheme ? getBuiltinTheme(storedColorTheme) : undefined;
      if (storedColorTheme && (isAppThemeId(storedColorTheme) || storedPalette)) {
        setColorThemeState(storedColorTheme);
        if (storedPalette) setPaletteState(storedPalette);
      }
    }

    setMounted(true);
  }, [initialPaletteIsExplicit]);

  // Read installed themes and the household palette once. Stored themes are
  // validated again immediately before they can reach the CSS writer.
  useEffect(() => {
    let cancelled = false;
    const request = safeFetch('/api/settings');
    if (!request) return () => { cancelled = true; };

    request
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const stored = data.settings?.[THEME_SETTING_KEY];
        const installed = Array.isArray(stored?.installed)
          ? (stored.installed as unknown[]).filter(isInstallableTheme)
          : [];

        if (installed.length > 0) setInstalledThemes(installed);

        const id = typeof stored?.paletteId === 'string' ? stored.paletteId : null;
        const found = id
          ? getBuiltinTheme(id) ?? installed.find((candidate) => candidate.id === id)
          : undefined;
        if (found) {
          setPaletteState(found);
          setColorThemeState(found.id);
        }
      })
      .catch(() => {
        // The server-rendered palette remains usable when settings are offline.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Apply the selected brightness and palette to the document.
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    let actualTheme: 'light' | 'dark';

    if (colorTheme === 'lcars') {
      actualTheme = 'dark';
    } else if (theme === 'system') {
      actualTheme = getSystemTheme();
    } else if (theme === 'sunset') {
      actualTheme =
        resolveSunsetTheme(
          new Date(),
          sunsetWeather?.lat !== undefined && sunsetWeather?.lon !== undefined
            ? { lat: sunsetWeather.lat, lon: sunsetWeather.lon }
            : undefined,
          sunsetWeather?.sunset,
          sunsetOffsetMinutes,
        ) ?? getSystemTheme();
    } else {
      actualTheme = theme;
    }

    const applyTheme = () => {
      if (actualTheme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');

      applySelectedPalette(root, colorTheme, palette, actualTheme);
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
        // The theme update itself must never be blocked by a partial API.
        applyTheme();
      }
    }

    hasAppliedThemeRef.current = true;
    previousAppliedThemeRef.current = { resolvedTheme: actualTheme, colorTheme };
  }, [theme, colorTheme, palette, mounted, sunsetWeather, sunsetOffsetMinutes, solarTick]);

  // Schedule the exact next sunrise/sunset transition. Weather polling remains
  // a fallback when a provider does not return coordinates.
  useEffect(() => {
    if (!mounted || theme !== 'sunset') return;

    const now = new Date();
    const coordinates =
      sunsetWeather?.lat !== undefined && sunsetWeather?.lon !== undefined
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

  // Listen for system brightness changes when in system mode.
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const nextTheme = colorTheme === 'lcars' || event.matches ? 'dark' : 'light';
      const root = document.documentElement;
      if (nextTheme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
      applySelectedPalette(root, colorTheme, palette, nextTheme);
      setResolvedTheme(nextTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, colorTheme, palette, mounted]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const setSunsetOffsetMinutes = (minutes: number) => {
    const normalizedMinutes = normalizeSunsetOffsetMinutes(minutes);
    setSunsetOffsetState(normalizedMinutes);
    localStorage.setItem(SUNSET_OFFSET_STORAGE_KEY, String(normalizedMinutes));
  };

  // Persist the palette to the shared settings row while applying it locally
  // immediately so a slow or unavailable API never blocks the display.
  const setPalette = (id: string) => {
    const next = getBuiltinTheme(id) ?? installedThemes.find((candidate) => candidate.id === id);
    if (!next) return;

    setPaletteState(next);
    setColorThemeState(id);
    if (isAppThemeId(id)) localStorage.setItem(COLOR_THEME_STORAGE_KEY, id);
    else localStorage.removeItem(COLOR_THEME_STORAGE_KEY);

    safeFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: THEME_SETTING_KEY, value: { mode: theme, paletteId: id } }),
    })?.catch(() => {
      // Applied locally; a later load can retry the household setting.
    });
  };

  // Compatibility for personal components and older settings controls.
  const setColorTheme = (newTheme: string) => setPalette(newTheme);

  // Escape hatch for a kiosk that cannot reach Settings: ?theme=default resets
  // the palette and persists it.
  useEffect(() => {
    if (!mounted) return;
    if (new URLSearchParams(window.location.search).get('theme') !== 'default') return;

    const fallback = getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!;
    setPaletteState(fallback);
    setColorThemeState(fallback.id);
    if (isAppThemeId(fallback.id)) localStorage.setItem(COLOR_THEME_STORAGE_KEY, fallback.id);
    safeFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: THEME_SETTING_KEY,
        value: { mode: theme, paletteId: fallback.id },
      }),
    })?.catch(() => {
      // Reset locally at least; the display is usable again.
    });
    // The escape hatch is intentionally processed once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Apply seasonal theme CSS variables globally. Passing the resolved mode
  // avoids a second MutationObserver on a display that runs for weeks.
  useSeasonalTheme(resolvedTheme);
  usePerformanceMode();

  const palettes = [
    ...BUILTIN_THEMES,
    ...installedThemes.filter((candidate) => !BUILTIN_THEMES.some((builtin) => builtin.id === candidate.id)),
  ];

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
          palette,
          palettes,
          setPalette,
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
        palette,
        palettes,
        setPalette,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
