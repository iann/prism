// Rebuild the bundled 5:2 Lambert cylindrical equal-area land path (about a
// 27° standard parallel). Natural Earth is public domain.
// No map service or runtime network request is required by the solar display.
import { writeFile } from 'node:fs/promises';

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 400;
const RAD = Math.PI / 180;

const source =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson';
const response = await fetch(source);
if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
const data = await response.json();
const paths = [];
for (const { geometry } of data.features) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    paths.push(
      polygon
        .map(
          (ring) =>
            ring
              .map(
                ([lon, lat], index) =>
                  `${index ? 'L' : 'M'}${(((lon + 180) / 360) * MAP_WIDTH).toFixed(2)},${(((1 - Math.sin(lat * RAD)) / 2) * MAP_HEIGHT).toFixed(2)}`
              )
              .join('') + 'Z'
        )
        .join('')
    );
  }
}
await writeFile(
  new URL('../src/lib/solar/world-land.json', import.meta.url),
  JSON.stringify({ source, path: paths.join('') }) + '\n'
);
