# Solar display

The weather widget embeds a quiet, live solar map: dotted continents, Earth's
illumination, and the selected weather location's local Sun arc. The map is a
static display with no timeline, map markers, or control chrome. It refreshes
with the current time every 15 seconds. Visit `/solar` for the same visualization
at wall-display size; optional `lat` and `lon` URL parameters configure its
location, for example `/solar?lat=51.5&lon=-0.12`. The weather widget uses its
configured weather coordinates, with Chicago as the fallback. Imminent rain
still takes priority over the map, and short weather tiles prioritize the
forecast. The display follows Prism's light/dark theme.

The map uses a 5:2 Lambert cylindrical equal-area projection and theme-colored
dots clipped to the bundled Natural Earth land shape, with no map tiles or large
image asset. The subsolar meridian stays centered while the land and its dot
pattern scroll horizontally underneath the fixed illumination, twilight,
terminator, equator, and local arc. The shadow tilt is sampled at solar noon and
held for that solar day; the map offset follows the live subsolar longitude.
Wrapped land copies and a periodic dot-pattern tile prevent gaps or texture jumps
at the date line. Twilight shading shows geometric solar elevation: daylight
above 0°, civil twilight to −6°, nautical to −12°, astronomical to −18°, then
night. The local altitude arc spans the full day, rises with the Sun's altitude,
and dips below the horizon at night. Its dots share the map's spacing and size
and use matching twilight colors. A single Sun marker travels along this
local-sky arc; the map itself has no point markers. The arc is a local sky path,
not a geographic route. Its noon-centered 24-hour scale puts sunrise and sunset
near the corresponding shadow edges, with a small visual offset from the arc's
inset and SunCalc's apparent rise/set refraction.

SunCalc v2 provides apparent local elevations and refraction-adjusted rise/set
times; a geometric terminator does not exactly coincide with apparent sunrise.
Terrain and local horizon obstructions are not modeled. The global solar
direction is derived from SunCalc's horizontal position at (0°, 0°) after
undoing refraction, so the map and local arc use the same ephemeris. Nested dark
caps wrap across the dateline and account for equinox and polar limits.

Bundled coastlines come from the public-domain
[Natural Earth 1:110m land dataset](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/),
pinned to v5.1.2. Rebuild the projected path with
`node scripts/generate-solar-map.mjs`. The generated JSON records its source URL.

Validation: `npx jest --runInBand src/lib/solar/__tests__/solar.test.ts src/components/widgets/__tests__/SolarWorldMap.test.tsx src/components/widgets/__tests__/WeatherWidget.test.tsx`.
