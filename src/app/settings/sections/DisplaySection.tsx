'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Monitor, Share2, Store, Sunset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers';
import { useAppLocale, APP_LOCALES } from '@/components/providers/LocaleProvider';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { MONTH_NAMES, seasonalPalettes } from '@/lib/themes/seasonalThemes';
import {
  useWallpaperSettings,
  useAutoOrientationSetting,
  useScreensaverInterval,
} from '@/components/layout/WallpaperBackground';
import { ThemeShareDialog } from '@/components/settings/ThemeShareDialog';
import { CommunityThemeGallery } from '@/components/settings/CommunityThemeGallery';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useOrientationOverride } from '../SettingsView';
import { useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useScreensaverMotion, type ScreensaverMotion, type ScreensaverDrift } from '@/components/screensaver/useScreensaverMotion';
import { useIdleLogoutSetting, IDLE_LOGOUT_OPTIONS } from '@/lib/hooks/useIdleLogout';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { useAwayModeTimeout } from '@/lib/hooks/useAwayModeTimeout';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { appThemes, isAppThemeId } from '@/lib/themes/appThemes';
import {
  MAX_SUNSET_OFFSET_MINUTES,
  MIN_SUNSET_OFFSET_MINUTES,
  normalizeSunsetOffsetMinutes,
} from '@/lib/themes/sunsetTheme';

function getCurrentMonthNum(): number {
  return new Date().getMonth() + 1;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function DisplaySection() {
  const {
    theme,
    setTheme,
    sunsetOffsetMinutes,
    setSunsetOffsetMinutes,
    colorTheme,
    resolvedTheme,
    palette: activePalette,
    palettes,
    setPalette,
    installedThemes,
  } = useTheme();
  const { seasonalTheme, setSeasonalTheme, palette } = useSeasonalTheme();
  const [sunsetOffsetInput, setSunsetOffsetInput] = useState(String(sunsetOffsetMinutes));
  const [sharing, setSharing] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    setSunsetOffsetInput(String(sunsetOffsetMinutes));
  }, [sunsetOffsetMinutes]);

  const mode: 'auto' | 'manual' | 'off' =
    seasonalTheme === 'none' ? 'off' : seasonalTheme === 'auto' ? 'auto' : 'manual';

  const setMode = (m: 'auto' | 'manual' | 'off') => {
    if (m === 'off') setSeasonalTheme('none');
    else if (m === 'auto') setSeasonalTheme('auto');
    else setSeasonalTheme(getCurrentMonthNum());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Appearance</h2>
        <p className="text-muted-foreground">Customize how the dashboard looks and behaves</p>
      </div>

      <SectionDivider label="Theme" />
      {/* A section spreads across the width rather than running down it:
          Seasonal Theme sits beside Color Scheme instead of below it. The
          divider stays full width so the grouping still reads as one thing. */}
      <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">

      <Card>
        <CardHeader>
          <CardTitle>Palette</CardTitle>
          <CardDescription>
            Sets the background, widget surfaces, calendars, controls, borders, and accent colors
            throughout Prism.
          </CardDescription>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setBrowsing(true)}>
              <Store className="mr-1 h-4 w-4" />
              Browse community themes
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
              <Share2 className="mr-1 h-4 w-4" />
              Share palette
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {palettes.map((preset) => {
            const colors = preset[resolvedTheme];
            const personalColors = isAppThemeId(preset.id) ? appThemes[preset.id][resolvedTheme] : null;
            const previewColor = (token: string) =>
              personalColors?.[`--${token}`] ?? colors[token as keyof typeof colors] ?? '0 0% 50%';
            const swatches = personalColors
              ? ['widget-calendar', 'widget-planning', 'widget-family', 'widget-info']
              : ['background', 'card', 'primary', 'accent'];
            const selected = activePalette.id === preset.id || colorTheme === preset.id;
            return (
              <button
                type="button"
                key={preset.id}
                aria-pressed={selected}
                onClick={() => setPalette(preset.id)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-all',
                  selected
                    ? 'border-primary ring-2 ring-primary/25'
                    : 'border-border hover:border-primary dark:hover:border-primary/50'
                )}
              >
                <div
                  className="mb-3 flex h-14 items-end gap-1.5 rounded-lg border p-2"
                  style={{
                    backgroundColor: `hsl(${previewColor('background')})`,
                    borderColor: `hsl(${previewColor('border')})`,
                  }}
                >
                  {swatches.map((token) => (
                    <span
                      key={token}
                      className="h-8 flex-1 rounded-sm"
                      style={{ backgroundColor: `hsl(${previewColor(token)})` }}
                    />
                  ))}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="block text-sm font-semibold">{preset.name}</span>
                  {installedThemes.some((theme) => theme.id === preset.id) && (
                    <span className="text-[10px] text-muted-foreground">Community</span>
                  )}
                </div>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brightness</CardTitle>
          <CardDescription>
            Use a light or dark version of the selected palette, or let Prism follow the sun at your
            weather location.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
              className="flex-1"
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
              className="flex-1"
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => setTheme('system')}
              className="flex-1"
            >
              <Monitor className="mr-2 h-4 w-4" />
              System
            </Button>
            <Button
              variant={theme === 'sunset' ? 'default' : 'outline'}
              onClick={() => setTheme('sunset')}
              className="flex-1"
            >
              <Sunset className="mr-2 h-4 w-4" />
              Sunset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sunset mode stays light during the day and switches to dark after sunset, returning to
            light at sunrise. It uses the location configured under General settings.
          </p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
            <div>
              <Label htmlFor="sunset-offset">Dark mode offset</Label>
              <p id="sunset-offset-help" className="mt-1 text-xs text-muted-foreground">
                Positive values start dark mode after sunset; negative values start it before
                sunset.
              </p>
            </div>
            <div className="relative">
              <Input
                id="sunset-offset"
                type="number"
                min={MIN_SUNSET_OFFSET_MINUTES}
                max={MAX_SUNSET_OFFSET_MINUTES}
                step={1}
                value={sunsetOffsetInput}
                aria-describedby="sunset-offset-help"
                onChange={(event) => {
                  setSunsetOffsetInput(event.target.value);
                }}
                onBlur={() => {
                  const value = Number(sunsetOffsetInput);
                  if (sunsetOffsetInput.trim() === '' || !Number.isFinite(value)) {
                    setSunsetOffsetInput(String(sunsetOffsetMinutes));
                    return;
                  }

                  const normalizedValue = normalizeSunsetOffsetMinutes(value);
                  setSunsetOffsetInput(String(normalizedValue));
                  setSunsetOffsetMinutes(normalizedValue);
                }}
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                min
              </span>
            </div>
          </div>

        </CardContent>
      </Card>

      {sharing && (
        <ThemeShareDialog palette={activePalette} onClose={() => setSharing(false)} />
      )}

      {browsing && <CommunityThemeGallery onClose={() => setBrowsing(false)} />}

      <Card>
        <CardHeader>
          <CardTitle>Seasonal Theme</CardTitle>
          <CardDescription>Add seasonal color accents to the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {(['auto', 'manual', 'off'] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'outline'}
                onClick={() => setMode(m)}
                className="flex-1 capitalize"
              >
                {m === 'auto' ? 'Auto' : m === 'manual' ? 'Manual' : 'Off'}
              </Button>
            ))}
          </div>

          {palette && (
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <div className="flex gap-1.5">
                <div
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: `hsl(${palette.light.accent})` }}
                  title="Accent"
                />
                <div
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: `hsl(${palette.light.highlight})` }}
                  title="Highlight"
                />
                <div
                  className="h-6 w-6 rounded-full border border-border"
                  style={{ backgroundColor: `hsl(${palette.light.subtle})` }}
                  title="Subtle"
                />
              </div>
              <span className="text-sm font-medium">
                {palette.label} — {palette.name}
              </span>
            </div>
          )}

          {mode === 'manual' && (
            <div className="grid grid-cols-4 gap-2">
              {MONTH_NAMES.map((name, i) => {
                const month = i + 1;
                const p = seasonalPalettes[month]!;
                const selected = seasonalTheme === month;
                return (
                  <button
                    key={month}
                    onClick={() => setSeasonalTheme(month)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      selected
                        ? 'border-foreground bg-accent text-accent-foreground'
                        : 'border-border hover:bg-accent/50'
                    )}
                  >
                    <div
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: `hsl(${p.light.accent})` }}
                    />
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      </div>
      <SectionDivider label="Wallpaper & Display" />
      {/* A section spreads across the width rather than running down it:
          Seasonal Theme sits beside Color Scheme instead of below it. The
          divider stays full width so the grouping still reads as one thing. */}
      <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">

      <PerformanceModeCard />

      <OrientationCard />

      <WallpaperSettingsCard />

      </div>
      <SectionDivider label="Behavior" />
      {/* A section spreads across the width rather than running down it:
          Seasonal Theme sits beside Color Scheme instead of below it. The
          divider stays full width so the grouping still reads as one thing. */}
      <div className="grid xl:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">

      <ScreensaverCard />
      <TimersCard />

      <WeatherUnitsCard />

      <LanguageCard />

      </div>
    </div>
  );
}

function LanguageCard() {
  const { locale, setLocale } = useAppLocale();
  const [saving, setSaving] = useState(false);

  const pick = useCallback(
    async (next: (typeof APP_LOCALES)[number]['value']) => {
      setSaving(true);
      try {
        await setLocale(next);
      } catch {
        /* provider reverts on failure */
      }
      setSaving(false);
    },
    [setLocale],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language <span className="text-xs font-normal text-muted-foreground">(early preview)</span></CardTitle>
        <CardDescription>
          The dashboard&apos;s display language. English is the default; other languages fall back to English
          for anything not yet translated. Only part of the UI is translated so far — this is an early preview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex rounded-md border border-input p-0.5" role="radiogroup" aria-label="Language">
          {APP_LOCALES.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={locale === l.value}
              disabled={saving}
              onClick={() => pick(l.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-sm transition-colors',
                locale === l.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherUnitsCard() {
  const [units, setUnits] = useState<'imperial' | 'metric' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const value = data?.settings?.weather as { units?: 'imperial' | 'metric' } | undefined;
        setUnits(value?.units === 'metric' ? 'metric' : 'imperial');
      })
      .catch(() => setUnits('imperial'));
  }, []);

  const save = useCallback(async (next: 'imperial' | 'metric') => {
    setUnits(next);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'weather', value: { units: next } }),
      });
    } catch {
      /* ignore — UI already updated optimistically */
    }
    setSaving(false);
  }, []);

  if (units === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weather units</CardTitle>
        <CardDescription>
          Imperial shows °F, mph, and inches. Metric shows °C, km/h, and mm. Applies to every place
          weather is rendered (widget, mobile cards, away mode, babysitter mode).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="inline-flex rounded-md border border-input p-0.5"
          role="radiogroup"
          aria-label="Weather units"
        >
          <button
            type="button"
            role="radio"
            aria-checked={units === 'imperial'}
            disabled={saving}
            onClick={() => save('imperial')}
            className={cn(
              'rounded-sm px-3 py-1.5 text-sm transition-colors',
              units === 'imperial' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
          >
            Imperial (°F, mph)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={units === 'metric'}
            disabled={saving}
            onClick={() => save('metric')}
            className={cn(
              'rounded-sm px-3 py-1.5 text-sm transition-colors',
              units === 'metric' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
          >
            Metric (°C, km/h)
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function TimersCard() {
  const { autoHideEnabled, setAutoHideEnabled } = useAutoHideUI();
  const { timeout: awayTimeout, setTimeout: setAwayTimeout } = useAwayModeTimeout();
  const [idleLogout, setIdleLogout] = useIdleLogoutSetting();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timers &amp; Auto-Activation</CardTitle>
        <CardDescription>
          Auto-hide, away mode, and how long a signed-in session lasts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sign out */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Signed-in session</h4>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Sign out after</span>
            <select
              value={idleLogout}
              onChange={(e) => setIdleLogout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              {IDLE_LOGOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground pl-2">
            After this long untouched, the display stops being signed in as
            whoever last used it. The dashboard stays readable; adding or
            changing anything asks for a PIN. This screen only.
          </p>
        </div>

        <div className="border-t border-border" />

        {/* Auto-Hide Navigation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Auto-Hide Navigation</h4>
              <p className="text-xs text-muted-foreground">
                Hide nav and toolbar after 10s of inactivity
              </p>
            </div>
            <Switch
              checked={autoHideEnabled}
              onCheckedChange={(checked) => {
                setAutoHideEnabled(checked);
                window.dispatchEvent(new Event('prism:auto-hide-change'));
              }}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Away Mode */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Away Mode Auto-Activation</h4>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Activate after</span>
            <select
              value={awayTimeout}
              onChange={(e) => setAwayTimeout(Number(e.target.value))}
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            >
              <option value={0}>Never (manual only)</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>1 day</option>
              <option value={48}>2 days</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
            <span className="text-sm text-muted-foreground">of no interaction</span>
          </div>
          <p className="pl-2 text-xs text-muted-foreground">
            After the specified idle time, Away Mode activates automatically for privacy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The screensaver's own card.
 *
 * These controls used to be an <h4> inside "Timers & Auto-Activation", between
 * the sign-out timer and the away-mode timer. Everything worked, but nobody
 * could find it: "screensaver" is not a timer, and the one place people look
 * for it — the screensaver editor — didn't mention it either. Giving it a card
 * with its own name is the whole fix.
 */
function ScreensaverCard() {
  const { timeout: ssTimeout, setTimeout: setSsTimeout } = useScreensaverTimeout();
  const { interval: photoInterval, setInterval: setPhotoInterval } = useScreensaverInterval();
  const {
    motion, setMotion,
    interval: motionInterval, setInterval: setMotionInterval,
    floor, setFloor, ceiling, setCeiling, outlines, setOutlines,
    shortcut, setShortcut, drift, setDrift,
    carbonation, setCarbonation, waterClear, setWaterClear, wobble, setWobble, speed, setSpeed,
  } = useScreensaverMotion();

  return (
    <Card id="screensaver-settings">
      <CardHeader>
        <CardTitle>Screensaver</CardTitle>
        <CardDescription>
          When it starts, how the widgets come and go, and how often the photo changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Activate after</span>
            <select
              value={ssTimeout}
              onChange={(e) => setSsTimeout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={0}>Never</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Widget transition effect</span>
            <select
              value={motion}
              onChange={(e) => setMotion(e.target.value as ScreensaverMotion)}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value="off">None</option>
              <option value="fade">Fade</option>
              <option value="smoke">Smoke</option>
              <option value="liquid">Fill and drain</option>
              <option value="fireworks">Fireworks</option>
            </select>
          </div>
          {motion !== 'off' && (
            <div className="flex items-center gap-3 pl-2">
              <span className="text-sm text-muted-foreground">Change every</span>
              <select
                value={motionInterval}
                onChange={(e) => setMotionInterval(Number(e.target.value))}
                className="border border-border rounded px-2 py-1 text-sm bg-background"
              >
                <option value={10}>10 seconds</option>
                <option value={20}>20 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={90}>1.5 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>
          )}
          {motion !== 'off' && (
            <div className="flex items-center gap-3 pl-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Show at least</span>
              <select
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="border border-border rounded px-2 py-1 text-sm bg-background"
              >
                {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>{n} widget{n === 1 ? '' : 's'}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">and at most</span>
              <select
                value={ceiling}
                onChange={(e) => setCeiling(Number(e.target.value))}
                className="border border-border rounded px-2 py-1 text-sm bg-background"
              >
                <option value={0}>no limit</option>
                {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n} widgets</option>
                ))}
              </select>
            </div>
          )}
          {motion !== 'off' && (
            <label className="flex items-center gap-3 pl-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!outlines}
                onChange={(e) => setOutlines(!e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-muted-foreground">Hide widget outlines</span>
            </label>
          )}
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Transition length</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={0.5}>Brisk</option>
              <option value={1}>Normal</option>
              <option value={1.6}>Slow</option>
              <option value={2.4}>Very slow</option>
            </select>
          </div>
          {motion === 'liquid' && (
            <>
              <label className="flex items-center gap-3 pl-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carbonation}
                  onChange={(e) => setCarbonation(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">Carbonation</span>
              </label>
              <label className="flex items-center gap-3 pl-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waterClear}
                  onChange={(e) => setWaterClear(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">Keep text clear of the waterline</span>
              </label>
              <p className="text-xs text-muted-foreground pl-2">
                Adds space above the content in each widget so the surface sits over empty
                room rather than across the first line of text. Off, the water covers
                the top of what the widget is showing — which is either the effect or a
                fault, depending on taste.
              </p>
              <div className="flex items-center gap-3 pl-2">
                <span className="text-sm text-muted-foreground">Surface wobble</span>
                <select
                  value={wobble}
                  onChange={(e) => setWobble(Number(e.target.value))}
                  className="border border-border rounded px-2 py-1 text-sm bg-background"
                >
                  <option value={0}>None</option>
                  <option value={0.5}>Slight</option>
                  <option value={1}>Normal</option>
                  <option value={1.8}>Choppy</option>
                </select>
              </div>
            </>
          )}
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Drift</span>
            <select
              value={drift}
              onChange={(e) => setDrift(e.target.value as ScreensaverDrift)}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value="off">Still</option>
              <option value="breathe">Breathe</option>
              <option value="ripple">Ripple</option>
              <option value="figure8">Figure eight</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground pl-2">
            Moves each widget slowly and out of step with the others, so no edge sits on
            the same pixels for months. Periods are minutes long and the movement is a
            few pixels — enough to spare the panel, not enough to notice.
          </p>
          <label className="flex items-center gap-3 pl-2 cursor-pointer">
            <input
              type="checkbox"
              checked={shortcut}
              onChange={(e) => setShortcut(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">
              Show a settings shortcut on the screensaver
            </span>
          </label>
          <p className="text-xs text-muted-foreground pl-2">
            Puts a faint Prism mark in the top-left of the screensaver. Tapping it opens
            these effect settings without leaving the display — useful while you are
            deciding which one you like.
          </p>
          <p className="text-xs text-muted-foreground pl-2">
            Showing some widgets at a time and swapping them gives the screensaver slow
            movement, and keeps a static image off the panel. About two thirds are shown
            at once, within the limits above.
          </p>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Rotate photos every</span>
            <select
              value={photoInterval}
              onChange={(e) => setPhotoInterval(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={0}>Never (static)</option>
            </select>
          </div>
      </CardContent>
    </Card>
  );
}

function PerformanceModeCard() {
  const { enabled, setEnabled } = usePerformanceMode();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Mode</CardTitle>
        <CardDescription>
          A lighter preset for low-end hardware (thin clients, older mini PCs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium">Enable performance mode</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Disables backdrop blur, stretches polling intervals, and shows a single static photo
              instead of a slideshow. Auto-enabled on devices reporting ≤2 GB RAM or ≤4 CPU cores;
              you can override it here at any time.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardContent>
    </Card>
  );
}

function WallpaperSettingsCard() {
  const { enabled, setEnabled, interval, setInterval } = useWallpaperSettings();
  const { enabled: autoOrientation, setEnabled: setAutoOrientation } = useAutoOrientationSetting();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background Wallpaper</CardTitle>
        <CardDescription>Show a rotating photo behind the dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable wallpaper</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {enabled && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Rotate every</span>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="rounded border border-border bg-background px-2 py-1 text-sm"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={0}>Never (static)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Auto-match photos to screen orientation</span>
                <p className="text-xs text-muted-foreground">
                  Only show landscape photos on landscape screens and portrait on portrait screens
                </p>
              </div>
              <Switch checked={autoOrientation} onCheckedChange={setAutoOrientation} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrientationCard() {
  const detectedOrientation = useScreenOrientation();
  const { override: orientationOverride, setOverride: setOrientationOverride } =
    useOrientationOverride();
  const effectiveOrientation =
    orientationOverride === 'auto' ? detectedOrientation : orientationOverride;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen Orientation</CardTitle>
        <CardDescription>
          Detected orientation is used for photo filtering and wallpaper matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Current:</span>
          <span className="text-sm font-medium capitalize">{effectiveOrientation}</span>
          {orientationOverride === 'auto' && (
            <span className="text-xs text-muted-foreground">(detected)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Override:</span>
          {(['auto', 'landscape', 'portrait'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setOrientationOverride(opt)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs capitalize transition-colors',
                orientationOverride === opt
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
