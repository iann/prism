import * as React from 'react';
import { SolarWorldMap, type SolarMotionMode } from '@/components/widgets/SolarWorldMap';
import type { Coordinates } from '@/lib/solar/solar';

type HarnessTheme = 'system' | 'light' | 'dark';

type HarnessState = {
  location: Coordinates;
  locationName: string;
  motionMode: SolarMotionMode;
  live: boolean;
  time: number;
  showArc: boolean;
  theme: HarnessTheme;
};

type LocationPreset = Coordinates & { name: string };

const BOSTON: LocationPreset = { name: 'Boston, MA', lat: 42.3601, lon: -71.0589 };
const LOCATION_PRESETS: LocationPreset[] = [
  BOSTON,
  { name: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Sydney, AU', lat: -33.8688, lon: 151.2093 },
  { name: 'Tromsø, NO', lat: 69.6492, lon: 18.9553 },
  { name: 'Equator / Greenwich', lat: 0, lon: 0 },
];

const DEFAULT_THEME: HarnessTheme = 'system';

function isMotionMode(value: string | null): value is SolarMotionMode {
  return value === 'map' || value === 'shadow';
}

function isTheme(value: string | null): value is HarnessTheme {
  return value === 'system' || value === 'light' || value === 'dark';
}

function parseFiniteNumber(value: string | null): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validLocation(lat: number | null, lon: number | null): boolean {
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function parseHarnessState(search: string, now = Date.now()): HarnessState {
  const params = new URLSearchParams(search);
  const lat = parseFiniteNumber(params.get('lat'));
  const lon = parseFiniteNumber(params.get('lon'));
  const location = validLocation(lat, lon)
    ? { lat: lat!, lon: lon! }
    : { lat: BOSTON.lat, lon: BOSTON.lon };
  const parsedTime = params.get('time') ? Date.parse(params.get('time')!) : NaN;
  const isBoston = location.lat === BOSTON.lat && location.lon === BOSTON.lon;
  const motion = params.get('motion');
  const selectedTheme = params.get('theme');

  return {
    location,
    locationName: params.get('name')?.trim() || (isBoston ? BOSTON.name : 'Custom location'),
    motionMode: isMotionMode(motion) ? motion : 'map',
    live: params.get('live') !== '0',
    time: Number.isFinite(parsedTime) ? parsedTime : now,
    showArc: params.get('arc') !== '0',
    theme: isTheme(selectedTheme) ? selectedTheme : DEFAULT_THEME,
  };
}

function formatDateTimeLocal(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

function matchingPreset(location: Coordinates): LocationPreset | undefined {
  return LOCATION_PRESETS.find(
    (preset) =>
      Math.abs(preset.lat - location.lat) < 0.00001 && Math.abs(preset.lon - location.lon) < 0.00001
  );
}

function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setPrefersDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return prefersDark;
}

export function SolarHarness() {
  const initial = React.useMemo(() => parseHarnessState(window.location.search), []);
  const [location, setLocation] = React.useState(initial.location);
  const [locationName, setLocationName] = React.useState(initial.locationName);
  const [motionMode, setMotionMode] = React.useState<SolarMotionMode>(initial.motionMode);
  const [live, setLive] = React.useState(initial.live);
  const [time, setTime] = React.useState(initial.time);
  const [showArc, setShowArc] = React.useState(initial.showArc);
  const [theme, setTheme] = React.useState<HarnessTheme>(initial.theme);
  const [copied, setCopied] = React.useState(false);
  const prefersDark = usePrefersDark();
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  const preset = matchingPreset(location);

  React.useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => setTime(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [live]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set('lat', formatCoordinate(location.lat));
    params.set('lon', formatCoordinate(location.lon));
    params.set('name', locationName);
    params.set('motion', motionMode);
    params.set('live', live ? '1' : '0');
    params.set('arc', showArc ? '1' : '0');
    params.set('theme', theme);
    if (!live) params.set('time', new Date(time).toISOString());
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [live, location, locationName, motionMode, showArc, theme, time]);

  const selectLocation = (value: string) => {
    if (value === 'custom') return;
    const selected = LOCATION_PRESETS[Number(value)];
    if (!selected) return;
    setLocation({ lat: selected.lat, lon: selected.lon });
    setLocationName(selected.name);
  };

  const updateCoordinate = (key: keyof Coordinates, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const limit = key === 'lat' ? 90 : 180;
    setLocation((current) => ({ ...current, [key]: Math.max(-limit, Math.min(limit, parsed)) }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const rootClassName = `solar-harness ${isDark ? 'dark' : 'light'} ${theme}`;

  return (
    <main className={rootClassName}>
      <div className="solar-harness__shell">
        <header className="solar-harness__header">
          <div>
            <p className="solar-harness__eyebrow">Browser-only solar renderer</p>
            <h1>Sunlight map harness</h1>
            <p className="solar-harness__intro">
              Explore the global illumination model and the local solar-altitude arc without the
              dashboard or weather services.
            </p>
          </div>
          <button type="button" onClick={() => void copyLink()}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </header>

        <div className="solar-harness__layout">
          <section className="solar-harness__visual" aria-label="Solar visualization">
            <SolarWorldMap
              lat={location.lat}
              lon={location.lon}
              locationName={locationName}
              time={time}
              motionMode={motionMode}
              showArc={showArc}
            />
            <div className="solar-harness__readout">
              <span>{locationName}</span>
              <span>{new Date(time).toLocaleString()}</span>
              <span>{motionMode === 'map' ? 'Map moves' : 'Shadow moves'}</span>
            </div>
          </section>

          <aside className="solar-harness__controls" aria-label="Solar harness controls">
            <fieldset>
              <legend>Global motion</legend>
              <label className="solar-harness__radio">
                <input
                  type="radio"
                  name="motion-mode"
                  value="map"
                  checked={motionMode === 'map'}
                  onChange={() => setMotionMode('map')}
                />
                <span>
                  <strong>Map moves</strong>
                  <small>Land scrolls beneath a centered shadow.</small>
                </span>
              </label>
              <label className="solar-harness__radio">
                <input
                  type="radio"
                  name="motion-mode"
                  value="shadow"
                  checked={motionMode === 'shadow'}
                  onChange={() => setMotionMode('shadow')}
                />
                <span>
                  <strong>Shadow moves</strong>
                  <small>Land stays fixed while illumination travels.</small>
                </span>
              </label>
            </fieldset>

            <fieldset>
              <legend>Time</legend>
              <label className="solar-harness__check">
                <input
                  type="checkbox"
                  checked={live}
                  onChange={(event) => {
                    const nextLive = event.currentTarget.checked;
                    setTime(Date.now());
                    setLive(nextLive);
                  }}
                />
                Follow live clock
              </label>
              <label className="solar-harness__field">
                <span>Date and time</span>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocal(time)}
                  disabled={live}
                  onChange={(event) => {
                    const parsed = new Date(event.currentTarget.value).getTime();
                    if (Number.isFinite(parsed)) setTime(parsed);
                  }}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Solar arc</legend>
              <label className="solar-harness__check">
                <input
                  type="checkbox"
                  checked={showArc}
                  onChange={(event) => setShowArc(event.currentTarget.checked)}
                />
                Show local altitude arc
              </label>
            </fieldset>

            <fieldset>
              <legend>Location</legend>
              <label className="solar-harness__field">
                <span>Preset</span>
                <select
                  value={preset ? String(LOCATION_PRESETS.indexOf(preset)) : 'custom'}
                  onChange={(event) => selectLocation(event.currentTarget.value)}
                >
                  {LOCATION_PRESETS.map((option, index) => (
                    <option key={option.name} value={index}>
                      {option.name}
                    </option>
                  ))}
                  <option value="custom">Custom location</option>
                </select>
              </label>
              <label className="solar-harness__field">
                <span>Name</span>
                <input
                  type="text"
                  value={locationName}
                  onChange={(event) => setLocationName(event.currentTarget.value)}
                />
              </label>
              <div className="solar-harness__coordinate-grid">
                <label className="solar-harness__field">
                  <span>Latitude</span>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="0.0001"
                    value={location.lat}
                    onChange={(event) => updateCoordinate('lat', event.currentTarget.value)}
                  />
                </label>
                <label className="solar-harness__field">
                  <span>Longitude</span>
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="0.0001"
                    value={location.lon}
                    onChange={(event) => updateCoordinate('lon', event.currentTarget.value)}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Theme</legend>
              <label className="solar-harness__field">
                <span>Color scheme</span>
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.currentTarget.value as HarnessTheme)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </fieldset>
          </aside>
        </div>
      </div>
    </main>
  );
}
