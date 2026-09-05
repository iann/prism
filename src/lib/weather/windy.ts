const WINDY_EMBED_URL = '/api/weather/windy/embed2.html';
const WINDY_MAP_ZOOM = '10';

/** Build the Windy radar URL centered on the configured weather location. */
export function buildWindyEmbedUrl(lat: number, lon: number): string {
  const coordinate = (value: number) => Number(value.toFixed(4)).toString();
  const params = new URLSearchParams([
    ['type', 'map'],
    ['location', 'coordinates'],
    ['metricRain', 'default'],
    ['metricTemp', 'default'],
    ['metricWind', 'default'],
    ['zoom', WINDY_MAP_ZOOM],
    ['overlay', 'radar'],
    ['product', 'radar'],
    ['level', 'surface'],
    ['play', '1'],
    ['menu', ''],
    ['calendar', ''],
    ['lat', coordinate(lat)],
    ['lon', coordinate(lon)],
    ['marker', ''],
    ['message', ''],
  ]);

  return `${WINDY_EMBED_URL}?${params.toString()}`;
}
