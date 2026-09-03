/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import type { WeatherData } from '../WeatherWidget';

import { WeatherRadarWidget } from '../WeatherRadarWidget';

const RADAR_DISMISSED_UNTIL_KEY = 'prism:weather-radar-dismissed-until';

function makeWeather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    location: 'Chicago, IL',
    lat: 41.8781,
    lon: -87.6298,
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'mm' },
    current: {
      temperature: 65,
      feelsLike: 64,
      condition: 'rainy',
      humidity: 80,
      windSpeed: 8,
      description: 'Rain',
    },
    forecast: [],
    hourly: [],
    lastUpdated: new Date(),
    ...overrides,
  };
}

describe('WeatherRadarWidget', () => {
  beforeEach(() => {
    localStorage.removeItem(RADAR_DISMISSED_UNTIL_KEY);
  });

  it('renders the Windy iframe when precipitation is active', () => {
    render(<WeatherRadarWidget data={makeWeather()} bottomOffset={96} />);

    const iframe = screen.getByTitle('Windy precipitation map');
    const radar = screen.getByTestId('weather-radar-widget');
    expect(radar).toBeTruthy();
    expect(radar.style.width).toBe(radar.style.height);
    expect(radar.className).toContain('z-[10000]');
    expect(radar.className).toContain('overflow-hidden');
    expect(radar.className).toContain('rounded-xl');
    expect(screen.queryByTestId('widget-container')).toBeNull();
    expect(screen.getByTestId('weather-radar-map').className).toContain('overflow-clip');
    expect(iframe.className).toContain('h-full');
    expect(iframe.className).not.toContain('h-[calc(100%+8rem)]');
    expect(iframe.getAttribute('src')).toContain('/api/weather/windy/embed2.html');
    expect(iframe.getAttribute('src')).toContain('lat=41.7181');
    expect(iframe.getAttribute('src')).toContain('lon=-87.6298');
    expect(iframe.getAttribute('src')).toContain('marker=');
    expect(iframe.getAttribute('src')).not.toContain('detailLat=');
  });

  it('hides the radar for two hours when the close icon is clicked', () => {
    render(<WeatherRadarWidget data={makeWeather()} />);

    const closeButton = screen.getByRole('button', { name: 'Close weather radar' });
    expect(closeButton.className).toContain('h-12');
    expect(closeButton.className).toContain('w-12');

    fireEvent.click(closeButton);

    expect(screen.queryByTestId('weather-radar-widget')).toBeNull();
    expect(Number(localStorage.getItem(RADAR_DISMISSED_UNTIL_KEY))).toBeGreaterThan(
      Date.now() + 2 * 60 * 60 * 1000 - 1000,
    );
  });

  it('honors an active radar dismissal after a remount', () => {
    localStorage.setItem(RADAR_DISMISSED_UNTIL_KEY, String(Date.now() + 60 * 60 * 1000));

    render(<WeatherRadarWidget data={makeWeather()} />);

    expect(screen.queryByTestId('weather-radar-widget')).toBeNull();
  });

  it('stays hidden when the weather is dry', () => {
    render(
      <WeatherRadarWidget
        data={makeWeather({
          current: { ...makeWeather().current, condition: 'sunny' },
        })}
      />,
    );

    expect(screen.queryByTestId('weather-radar-widget')).toBeNull();
  });

  it('stays hidden when the weather location has no coordinates', () => {
    render(<WeatherRadarWidget data={makeWeather({ lat: undefined, lon: undefined })} />);

    expect(screen.queryByTestId('weather-radar-widget')).toBeNull();
  });
});
