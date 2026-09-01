const WINDY_EMBED_URL = '/api/weather/windy/embed2.html';
const WINDY_MAP_ZOOM = '10';
const WINDY_MAP_SOUTHWARD_OFFSET = 0.16;

/** Build the Windy radar URL with Boston centered in the local radar view. */
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
    ['lat', coordinate(lat - WINDY_MAP_SOUTHWARD_OFFSET)],
    ['lon', coordinate(lon)],
    ['marker', ''],
    ['message', ''],
  ]);

  return `${WINDY_EMBED_URL}?${params.toString()}`;
}
