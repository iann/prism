# Solar harness

The solar harness is a standalone, browser-only page for exercising the sunlight map and local solar-altitude arc. It uses the existing React solar renderer, but does not require the Next.js server, dashboard, database, weather services, or map APIs at runtime.

## Local development

```sh
npm run dev:harness
```

The Vite dev server serves the page at `/` with Boston, MA as the default location.

Create the deployable static output with:

```sh
npm run build:harness
```

The generated site is written to `dist/solar-harness`.

## Cloudflare Pages

Use these project settings for a static Cloudflare Pages project:

- Build command: `npm run build:harness`
- Build output directory: `dist/solar-harness`
- Framework preset: none
- Runtime/API requirements: none

The output uses relative asset URLs, so it can also be hosted below a path prefix.

## Shareable state

The harness stores its state in the URL query string. Links can include:

| Parameter     | Values                            | Default                                  |
| ------------- | --------------------------------- | ---------------------------------------- |
| `lat` / `lon` | decimal coordinates               | Boston, MA                               |
| `name`        | display label                     | `Boston, MA` for the default coordinates |
| `motion`      | `map` or `shadow`                 | `map`                                    |
| `live`        | `1` or `0`                        | `1`                                      |
| `time`        | ISO timestamp, used when `live=0` | current time                             |
| `arc`         | `1` or `0`                        | `1`                                      |
| `style`       | `quiet`, `bold`, `filled`, `dots` | `quiet`                                  |
| `theme`       | `system`, `light`, or `dark`      | `system`                                 |

The motion modes are mutually exclusive: map mode keeps the shadow centered while the dotted land moves; shadow mode keeps the land fixed while illumination travels across it.

The arc treatments change how the local solar-altitude arc is drawn on the map:

- `quiet` is the default: the arc is drawn in its own twilight ramp and weight, and the continent dots step back so the arc reads first.
- `bold` draws the same arc with the continents at full strength.
- `filled` adds a filled dome between the arc and the horizon, so the arc reads as a daylight band.
- `dots` is the earlier treatment, kept for comparison.
