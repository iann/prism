/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { WeatherData } from '../WeatherWidget';

import { WeatherRadarWidget } from '../WeatherRadarWidget';

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
    expect(iframe.getAttribute('src')).toContain('/api/weather/windy/embed2.html');
    expect(iframe.getAttribute('src')).toContain('lat=41.7181');
    expect(iframe.getAttribute('src')).toContain('lon=-87.6298');
    expect(iframe.getAttribute('src')).toContain('marker=');
    expect(iframe.getAttribute('src')).not.toContain('detailLat=');
  });

  it('stays hidden when the weather is dry', () => {
    render(
      <WeatherRadarWidget
        data={makeWeather({
          current: { ...makeWeather().current, condition: 'sunny' },
        })}
      />
    );

    expect(screen.queryByTestId('weather-radar-widget')).toBeNull();
  });

  it('stays hidden when the weather location has no coordinates', () => {
    render(<WeatherRadarWidget data={makeWeather({ lat: undefined, lon: undefined })} />);

    expect(screen.queryByTestId('weather-radar-widget')).toBeNull();
  });
});
