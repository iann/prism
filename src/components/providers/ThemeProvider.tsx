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
import { isInstallableTheme, MAX_INSTALLED_THEMES, type Theme } from '@/lib/themes/tokens';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from '@/lib/themes/appThemes';
import { applyThemeVars, applyThemeChrome, themeTokens } from '@/lib/themes/applyTheme';

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
  /** The subset of `palettes` that came from the gallery rather than the box. */
  installedThemes: Theme[];
  /**
   * Add a gallery theme and switch to it.
   *
   * Installing and applying are one operation because the API validates them
   * as one: `paletteId` has to name a builtin or a theme present in the same
   * write, so there is no request that installs without choosing.
   *
   * Resolves false when the write was refused, so the caller can say so rather
   * than showing an install that vanishes on the next load.
   */
  installTheme: (theme: Theme) => Promise<boolean>;
  /** Remove a gallery theme, falling back to the default if it was in use. */
  uninstallTheme: (id: string) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'prism-theme';
const SUNSET_OFFSET_STORAGE_KEY = 'prism-sunset-offset';
const COLOR_THEME_STORAGE_KEY = 'prism-color-theme';
const DEFAULT_COLOR_THEME: AppThemeId = 'daybook';
const THEME_SETTING_KEY = 'theme';
// Keep the upstream Prism palette as the recovery surface even though the
// personal fork's normal default remains Daybook.
const RECOVERY_THEME_ID = 'prism';

function getRecoveryTheme(): Theme {
  return getBuiltinTheme(RECOVERY_THEME_ID) ?? getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!;
}

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
  const themeRef = React.useRef(theme);
  themeRef.current = theme;

  // The settings row is replaced wholesale, so every palette write carries
  // the complete installed-theme list. Read the current brightness through a
  // ref because the initial settings request may resolve before mount state has
  // settled.
  const persistTheme = async (paletteId: string, installed: Theme[]): Promise<boolean> => {
    try {
      const request = safeFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: THEME_SETTING_KEY,
          value: { mode: themeRef.current, paletteId, installed },
        }),
      });
      if (!request) return false;
      const response = await request;
      return response.ok;
    } catch {
      return false;
    }
  };

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
          ? (stored.installed as unknown[])
              .filter(isInstallableTheme)
              .filter((candidate) => !getBuiltinTheme(candidate.id))
          : [];

        setInstalledThemes(installed);

        if (new URLSearchParams(window.location.search).get('theme') === 'default') {
          const fallback = getRecoveryTheme();
          setPaletteState(fallback);
          setColorThemeState(fallback.id);
          if (isAppThemeId(fallback.id)) localStorage.setItem(COLOR_THEME_STORAGE_KEY, fallback.id);
          void persistTheme(fallback.id, installed);
          return;
        }

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

  const setPalette = (id: string) => {
    const next = getBuiltinTheme(id) ?? installedThemes.find((candidate) => candidate.id === id);
    if (!next) return;

    setPaletteState(next);
    setColorThemeState(id);
    if (isAppThemeId(id)) localStorage.setItem(COLOR_THEME_STORAGE_KEY, id);
    else localStorage.removeItem(COLOR_THEME_STORAGE_KEY);

    void persistTheme(id, installedThemes);
  };

  const installTheme = async (incoming: Theme): Promise<boolean> => {
    // Re-validated here even though the gallery validated on fetch: this is the
    // last point before the value is handed to a row that gets rendered into a
    // <style> element on the server.
    if (!isInstallableTheme(incoming)) return false;
    // A builtin id would shadow a palette everyone already has, and the
    // resolver checks builtins first, so the installed copy would be dead data.
    if (getBuiltinTheme(incoming.id)) return false;

    const next = [...installedThemes.filter((t) => t.id !== incoming.id), incoming];
    // The API refuses more than 40. Refusing here too means the caller gets a
    // reason rather than a 400 it has to interpret.
    if (next.length > MAX_INSTALLED_THEMES) return false;

    const ok = await persistTheme(incoming.id, next);
    if (!ok) return false;
    setInstalledThemes(next);
    setPaletteState(incoming);
    setColorThemeState(incoming.id);
    localStorage.removeItem(COLOR_THEME_STORAGE_KEY);
    return true;
  };

  const uninstallTheme = async (id: string): Promise<boolean> => {
    const next = installedThemes.filter((t) => t.id !== id);
    if (next.length === installedThemes.length) return false;

    // Removing the palette in use would leave `paletteId` naming a theme that
    // is no longer in the write, which the API rejects. Fall back first.
    const fallback = getRecoveryTheme();
    const nextPaletteId = palette.id === id ? fallback.id : palette.id;

    const ok = await persistTheme(nextPaletteId, next);
    if (!ok) return false;
    setInstalledThemes(next);
    if (palette.id === id) {
      setPaletteState(fallback);
      setColorThemeState(fallback.id);
      if (isAppThemeId(fallback.id)) localStorage.setItem(COLOR_THEME_STORAGE_KEY, fallback.id);
    }
    return true;
  };

  // Compatibility for personal components and older settings controls.
  const setColorTheme = (newTheme: string) => setPalette(newTheme);

  // Apply the palette's variables whenever it or the light/dark mode changes.
  //
  // Runs after mount only. The first paint is handled by a stylesheet rendered
  // on the server, so this effect is for changes rather than for load — which
  // is why there is no flash when someone picks a palette.
  useEffect(() => {
    if (!mounted) return;
    applyThemeVars(document.documentElement, themeTokens(palette, resolvedTheme));
    applyThemeChrome(document.documentElement, palette);
  }, [palette, resolvedTheme, mounted]);

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
          installedThemes, installTheme, uninstallTheme,
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
        installedThemes, installTheme, uninstallTheme,
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
