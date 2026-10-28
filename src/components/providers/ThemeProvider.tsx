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
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useNow } from '@/lib/hooks/useNow';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { useWeather } from '@/lib/hooks/useWeather';
import { useHydrated, useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import {
  appThemes,
  applyAppTheme,
  isAppThemeId,
  type AppThemeId,
} from '@/lib/themes/appThemes';
import {
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

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Whether the system is in dark mode, following it as it changes. */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    subscribeSystemTheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' || value === 'sunset';
}

/** A palette id this display can actually resolve: a builtin or a personal theme. */
function isKnownColorTheme(value: string | null): value is string {
  return value !== null && (isAppThemeId(value) || getBuiltinTheme(value) !== undefined);
}

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
  // The brightness mode and the sunset offset are per display, in localStorage.
  // Read through the shared store so every instance agrees, and so no mount
  // effect has to copy them into state (which would paint a frame of the
  // default first). Both are the server's defaults while hydrating.
  const storedMode = useStoredString(STORAGE_KEY);
  const theme: ThemeMode = isThemeMode(storedMode) ? storedMode : defaultTheme;
  const systemDark = useSystemDark();
  const mounted = useHydrated();

  const storedSunsetOffset = useStoredString(SUNSET_OFFSET_STORAGE_KEY);
  const sunsetOffsetMinutes = normalizeSunsetOffsetMinutes(
    storedSunsetOffset === null ? 0 : Number(storedSunsetOffset),
  );

  // The palette is a household setting held by the server; the local key is
  // the pre-gallery preference, kept for an install that has never persisted
  // one. Server value first, so a stale local choice cannot flash over it.
  const [serverColorTheme, setColorThemeState] = useState<string>(
    () => initialPalette?.id ?? DEFAULT_COLOR_THEME,
  );
  const legacyColorTheme = useStoredString(COLOR_THEME_STORAGE_KEY);
  const colorTheme =
    !initialPaletteIsExplicit && isKnownColorTheme(legacyColorTheme)
      ? legacyColorTheme
      : serverColorTheme;

  const [installedThemes, setInstalledThemes] = useState<Theme[]>([]);
  const palette = useMemo(
    () =>
      getBuiltinTheme(colorTheme) ??
      installedThemes.find((candidate) => candidate.id === colorTheme) ??
      initialPalette ??
      getBuiltinTheme(DEFAULT_COLOR_THEME) ??
      BUILTIN_THEMES[0]!,
    [colorTheme, installedThemes, initialPalette],
  );

  // A ref rather than an effect event: persistTheme is called from event
  // handlers as well as the load effect. The settings row is replaced
  // wholesale, so every palette write carries the complete installed-theme
  // list and the mode this display is on.
  const themeRef = useLatestRef(theme);

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

  // Sunset mode is worked out from the clock, so it needs a tick to cross the
  // horizon. Half a minute is fine for a wall display: the flip lands within
  // half a minute of the sun going down, rather than at the next weather poll.
  const now = useNow(30_000);
  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (colorTheme === 'lcars') return 'dark';
    if (theme === 'sunset') {
      return (
        resolveSunsetTheme(
          now,
          sunsetWeather?.lat !== undefined && sunsetWeather?.lon !== undefined
            ? { lat: sunsetWeather.lat, lon: sunsetWeather.lon }
            : undefined,
          sunsetWeather?.sunset,
          sunsetOffsetMinutes,
        ) ?? (systemDark ? 'dark' : 'light')
      );
    }
    if (theme === 'system') return systemDark ? 'dark' : 'light';
    return theme;
  }, [colorTheme, theme, now, sunsetWeather, sunsetOffsetMinutes, systemDark]);

  const hasAppliedThemeRef = useRef(false);
  const previousAppliedThemeRef = useRef<{
    resolvedTheme: 'light' | 'dark';
    colorTheme: string;
  } | null>(null);

  // Apply the selected brightness and palette to the document. Not while
  // hydrating: the inline script in app/layout.tsx already set the class from
  // the same stored value before the first paint.
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const applyTheme = () => {
      if (resolvedTheme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');

      applySelectedPalette(root, colorTheme, palette, resolvedTheme);
    };

    const previousTheme = previousAppliedThemeRef.current;
    const themeChanged =
      previousTheme !== null &&
      (previousTheme.resolvedTheme !== resolvedTheme || previousTheme.colorTheme !== colorTheme);
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
    previousAppliedThemeRef.current = { resolvedTheme, colorTheme };
  }, [resolvedTheme, colorTheme, palette, mounted]);

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

  // Read installed themes and the household palette once. Stored themes are
  // validated again immediately before they can reach the CSS writer.
  const persistOnLoad = useEffectEvent((id: string, installed: Theme[]) =>
    persistTheme(id, installed),
  );
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

        // Escape hatch for a kiosk that cannot reach Settings, handled inside
        // this read rather than in an effect of its own: the row is replaced
        // wholesale, so the reset has to carry the installed themes it has
        // just learned about.
        if (new URLSearchParams(window.location.search).get('theme') === 'default') {
          const fallback = getRecoveryTheme();
          setColorThemeState(fallback.id);
          if (isAppThemeId(fallback.id)) writeStored(COLOR_THEME_STORAGE_KEY, fallback.id);
          void persistOnLoad(fallback.id, installed);
          return;
        }

        const id = typeof stored?.paletteId === 'string' ? stored.paletteId : null;
        const found = id
          ? getBuiltinTheme(id) ?? installed.find((candidate) => candidate.id === id)
          : undefined;
        if (found) setColorThemeState(found.id);
      })
      .catch(() => {
        // The server-rendered palette remains usable when settings are offline.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = (newTheme: ThemeMode) => writeStored(STORAGE_KEY, newTheme);

  const setSunsetOffsetMinutes = (minutes: number) => {
    writeStored(SUNSET_OFFSET_STORAGE_KEY, String(normalizeSunsetOffsetMinutes(minutes)));
  };

  const setPalette = (id: string) => {
    const next = getBuiltinTheme(id) ?? installedThemes.find((candidate) => candidate.id === id);
    if (!next) return;

    setColorThemeState(id);
    if (isAppThemeId(id)) writeStored(COLOR_THEME_STORAGE_KEY, id);
    else writeStored(COLOR_THEME_STORAGE_KEY, null);

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
    setColorThemeState(incoming.id);
    writeStored(COLOR_THEME_STORAGE_KEY, null);
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
      setColorThemeState(fallback.id);
      if (isAppThemeId(fallback.id)) writeStored(COLOR_THEME_STORAGE_KEY, fallback.id);
    }
    return true;
  };

  // Compatibility for personal components and older settings controls.
  const setColorTheme = (newTheme: string) => setPalette(newTheme);

  // Apply seasonal theme CSS variables globally. Passing the resolved mode
  // avoids a second MutationObserver on a display that runs for weeks.
  useSeasonalTheme(resolvedTheme);
  usePerformanceMode();

  const palettes = [
    ...BUILTIN_THEMES,
    ...installedThemes.filter((candidate) => !BUILTIN_THEMES.some((builtin) => builtin.id === candidate.id)),
  ];

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
