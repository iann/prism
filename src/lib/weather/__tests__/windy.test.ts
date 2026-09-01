import { buildWindyEmbedUrl } from '../windy';

describe('buildWindyEmbedUrl', () => {
  it('places the weather location in the upper portion of the radar map', () => {
    const url = new URL(buildWindyEmbedUrl(42.46, -71.06), 'http://localhost:3005');

    expect(url.pathname).toBe('/api/weather/windy/embed2.html');
    expect(url.searchParams.get('type')).toBe('map');
    expect(url.searchParams.get('location')).toBe('coordinates');
    expect(url.searchParams.get('zoom')).toBe('10');
    expect(url.searchParams.get('overlay')).toBe('radar');
    expect(url.searchParams.get('product')).toBe('radar');
    expect(url.searchParams.get('level')).toBe('surface');
    expect(url.searchParams.get('menu')).toBe('');
    expect(url.searchParams.get('calendar')).toBe('');
    expect(url.searchParams.get('lat')).toBe('42.3');
    expect(url.searchParams.get('lon')).toBe('-71.06');
    expect(url.searchParams.get('detailLat')).toBeNull();
    expect(url.searchParams.get('detailLon')).toBeNull();
    expect(url.searchParams.get('marker')).toBe('');
    expect(url.searchParams.get('message')).toBe('');
  });
});
