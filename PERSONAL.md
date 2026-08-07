# Personal Fork Feature and Fix Inventory

This is the tracked changelog for behavior added on top of upstream/master.
It belongs to the personal fork and is not intended for upstream Prism.

Last audited: 2026-08-01
Baseline: upstream/master at 0c12060
Audited through: 81f74f3, the current origin/personal tip after PR #32
(the feature/calendar-event-deletion-behavior branch is fast-forwarded to it)

Entries are grouped by user-facing outcome. The commit references are the
contributing personal commits; merge commits, traffic-stat commits, and
upstream-sync-only commits are omitted unless they changed behavior.

## Active inventory

1. **Weather widget overhaul and hourly forecast**

   Expanded the weather widget with provider-backed hourly data, a seven-day
   forecast, precipitation probability, local location display, responsive
   forecast rows, and a readable next-nine-hours timeline with condition bands,
   sampled temperatures, precipitation details, and a "Now" marker.

   Commits: 0d61d7d, 10ef157, 17f3068, f9c3521, 8edc991,
   cd94137, 30a1d8e, 29e264f, d11e30a

2. **Weather date, timezone, and stale-data correctness**

   Fixed forecast grouping and day labels across provider timezones, filtered
   past-day entries before rendering, kept the visible day count accurate,
   handled stale OpenWeatherMap and Pirate Weather entries, and prevented the
   celestial chart from becoming stale across local midnight.

   Commits: ff50403, 4a5590f, 991d620, a1dd592, e71beb6,
   3cd0d5d, 93f7e8c, 4f1e776

3. **Weather celestial chart and moon-phase presentation**

   Added the sunrise/sunset arc, true SunCalc-based solar and lunar altitude
   paths, a fixed absolute altitude scale, elapsed-versus-future styling,
   moon-phase glyphs, and responsive SVG sizing. Subsequent fixes close gaps at
   horizon and current-time crossings, align ticks, keep line styles consistent,
   mask the moon path at the glyph, and size the below-horizon moon marker
   appropriately.

   Commits: 4242329, f19dd72, 3107b15, 8270bb3, 60fbf4a,
   42b7f15, 5b25bca, f998d61, af2c404, 533fd48, d3720c9,
   f101303, cb0582d, 9fd26e3, 4f1e776

4. **Weather precipitation visualization and timing messages**

   Added a responsive minutely precipitation chart, a meaningful-rain
   threshold, and plain-language timing messages such as rain starting,
   stopping, continuing through the hour, or returning after a pause. The
   precipitation visualization evolved from the original line/area treatment
   to the current compact bar chart.

   Commits: 61eb308, e65419c, ad0c53f, 12cebb0

5. **Weather forecast temperature scale and theme integration**

   Added an absolute Fahrenheit-based temperature color scale independent of
   display units, proportional low/high range bars, and semantic temperature
   ramps that adapt to each light/dark color theme while preserving contrast.

   Commits: 1ac4b64, acfbb8c, 9c0d094, 08894d4

6. **Time-of-day clock greetings**

   Added morning, afternoon, evening, and bedtime greeting buckets with a
   stable per-day djb2-hashed selection, then extracted the greeting into its
   own size-aware component.

   Commits: 7f94b3e, 9f1d5fc, f92ddb6, 38d5370, a8acab7

7. **Low-power display performance mode**

   Optimized wall displays by deferring data domains until their widgets are
   visible, staggering refresh work, reducing unnecessary widget remounts,
   polling only when visible, stabilizing hook data, and tuning PWA caching and
   display-mode overlays for low-power hardware.

   Commits: 6389b9f, 6e6e281 (PR #31)

8. **Accessible themes and wall-display readability**

   Added the app-wide theme token system, Kitchen Calm and related color
   presets, light/dark theme selection, stronger light-mode surfaces and
   text contrast, and contract tests for the revised surface classes. The same
   readability pass improved calendar event density based on measured row
   height and made bus route labels/status colors responsive and legible on
   wall displays.

   Commits: 1ea0d29, d11e30a, 2455bc9 (PR #30)

9. **LCARS console layout**

   Added the LCARS theme with its own shell, navigation rail, status bars,
   primitives, panel styling, widget accents, and auto-hidden chrome behavior,
   while retaining the existing Prism content and navigation model.

   Commit: 7c998e6

10. **Multiple widget instances**

    Added support for placing multiple instances of the same widget in a
    dashboard, including unique instance IDs, legacy-layout normalization,
    per-instance calendar preferences, isolated data props, and layout-editor,
    preview, import/export, and sharing support.

    Commits: 01e3053, 495551f

11. **Calendar chrome auto-hide**

    Added idle-time hiding of calendar controls and surrounding chrome so the
    calendar uses more of the wall display, with interaction-based restoration
    and a safe fallback when pathname state is unavailable.

    Commits: 6c0cd6e, bb28080

12. **Configurable handling for removed calendar events**

    Added a Calendar Preferences setting that defaults to safe review mode.
    Removed Google, iCal, and CalDAV events are flagged for review by default,
    or can be automatically deleted on the next sync when the family-wide
    preference is enabled. Reappearing events clear their pending-deletion
    state, and sync responses now report added, updated, removed, and
    auto-deleted counts.

    Commit: dc133ff (PR #32)

13. **Local development service workflow**

    Added a backing-services-only Compose file and services:up,
    services:down, and services:logs scripts for host-side development;
    moved the dev server to port 3005 to coexist with the container stack; and
    made the nginx/HTTPS layer optional through a Compose profile.

    Commits: 6ca30ba, 715cde3, a5bc6dd

14. **Fork synchronization and personal-branch CI**

    Added scheduled and manually triggerable upstream synchronization that
    maintains upstream, resets the mirror master, merges into personal, and
    opens a conflict issue when automation cannot merge. CI and install
    workflows were updated to exercise pull requests targeting personal, use
    the personal branch as the integration target, and avoid running personal
    traffic automation in the upstream repository.

    Commits: cb23f55, 4c879e4, f83894b, b8a07b5, c0a2046,
    276d0df, 513f0a0, fb4ba59, 9c68596, b67d44b, a6170c3,
    2cfe326,
    bf3a284, 13114b0, fd6b0a7, c7f76cc, 2fbc4c2, 4227a8b,
    b278622, 62d1151, 3beeefc

15. **Runtime, build, and test compatibility fixes**

    Upgraded the personal runtime/toolchain to Node 24, aligned CI and
    Playwright with port 3005, fixed the package-version import warning,
    addressed merry-timeline webpack/RSC compatibility while it was in use,
    added ResizeObserver and current-widget test support, repaired stale iCal
    fixtures and duplicate photo-sync test keys, and refreshed the Browserslist
    database.

    Commits: 95cb6b3, c2baf32, abdf0de, b3650c0, f84024c,
    5c8b189, a05cd1c, 8b13d96, ae06430, aeefabb, 4c3a709

16. **Theme-aware widget colors and borders**

   Fixed light-mode calendar and widget contrast across preset and custom
   surfaces, added readable event tints, standardized widget shell borders,
   and audited the six app themes for consistent light/dark presentation.

   Commit: 3c60369

17. **Theme-safe text overrides and calendar surface consistency**

   Prevented stale text-only widget overrides from forcing white text and dark
   scrims onto light themes, then standardized calendar surfaces, today states,
   popovers, event cards, notes, and borders across the calendar views.

   Commit: 3c8f15a

18. **Claude-inspired warm dashboard palette**

   Added a selectable Claude-inspired light/dark palette with parchment and
   charcoal surfaces, restrained terracotta accents, softened widget surfaces,
   and mode-aware weather colors. Follow-up tuning keeps light info widgets
   warm and neutral while dark info widgets use warm charcoal instead of cool
   green-gray.

   Commit: 6b37df1

19. **Automatic client updates after server releases**

    Added a cache-proof server build endpoint and a global client checker that
    compares immutable build identities, refreshes the PWA service worker, and
    reloads the current page when the running server build changes. CI uses the
    commit SHA; local and source builds use a deterministic content hash.

    Commits: d276d02, 9e6ad24

20. **Sunset dark-mode offset**

    Added a persisted Appearance setting that starts dark mode before or after
    sunset by a configurable number of minutes, while keeping the sunrise
    transition unchanged.

    Commit: 7df2fda

21. **Readable inline agenda event colors**

    Fixed inline agenda event titles inheriting the calendar color's
    contrast-aware text instead of forcing white text onto light event colors
    such as orange.

    Commit: afd2f33

22. **Calibrated animated rain chart**

    Calibrated the precipitation scale against the Melrose rain reading,
    normalized Pirate Weather's imperial precipitation values, and replaced
    the compact bars with a smooth Dark Sky-inspired animated wave.

    Commit: 45635c6

23. **Dark Sky-style precipitation chart presentation**

    Refined the rain chart around the supplied reference with a next-hour
    header, location and temperature context, upper intensity guides,
    turquoise fill, and a stronger wavy outline.

    Commit: cf33b96

24. **Nonlinear precipitation intensity scale**

    Added a square-root rain-rate mapping with a 7.62 mm/hr heavy-rain
    ceiling, preserving headroom for moderate showers while keeping light
    rain visible.

    Commit: b4a5636

25. **Theme-native precipitation chart header**

    Kept the Dark Sky-inspired chart treatment while returning its header to
    the widget’s compact theme hierarchy and removing redundant location and
    temperature details.

    Commit: 315ed86

26. **Theme-aware precipitation wave colors**

    Audited the rain chart across every light and dark preset, then tied its
    wave, fill, and highlight colors to the active theme tokens for better
    integration with Prism, Claude, Kitchen Calm, Herb Garden, Warm Clay,
    Soft Slate, and LCARS.

    Commit: bb689f6

27. **Blue forecast variation for precipitation**

    Added a softly animated companion trace to communicate forecast
    uncertainty, and introduced theme-specific blue precipitation tokens for
    the wave, fill, and timing message across all light and dark presets.

    Commit: 2dd6b11

28. **Evenly spaced precipitation intensity guides**

    Kept the nonlinear rain-rate scale while giving the heavy, medium, and
    light visual guides equal spacing for a more predictable chart grid.

    Commit: 37e8626

29. **Smoothed animated precipitation waves**

    Smoothed short-lived forecast spikes before plotting the spline and added
    synchronized low-amplitude wave motion to the area edge and highlight.

    Commit: b52d998

30. **Locally morphing precipitation wave**

    Added deterministic local jitter and smooth SVG path morphing so the rain
    wave moves up and down across its shape instead of only translating as a
    single block.

    Commit: f6b6b3c

31. **Symmetric five-percent precipitation variation**

    Tuned the forecast-uncertainty trace to vary smoothly on both sides of the
    primary signal by approximately ±5% of the chart height.

    Commit: 6afa2d1

32. **Softer rain-wave undulation**

    Replaced the dense local wobble with a few broad, low-amplitude rises and
    falls so the main precipitation edge reads as a smooth undulating line.

    Commit: 621f9db

33. **Visible but restrained wave motion**

    Kept the lower-frequency contour while increasing its controlled amplitude
    enough for the smooth up-and-down movement to remain legible on the chart.

    Commit: b7b95ae

34. **Removed precipitation ripple sweep**

    Removed the right-to-left moving highlight and dash sweep, leaving the
    chart’s smooth undulation and static forecast-variation trace unobstructed.

    Commit: 37bbd20

35. **Removed remaining rain dash motion**

    Removed the primary line’s initial dash-offset draw and the uncertainty
    trace’s dashed styling so no precipitation layer sweeps horizontally.

    Commit: 8a60b62

36. **More frequent bounded rain undulations**

    Increased the number of smooth rises and falls while clamping both sample
    and Bézier control points to the chart band so the wave cannot cross below
    the precipitation baseline.

    Commit: a64f801

37. **Faster rain-wave cycle**

    Shortened the synchronized undulation, fill breathing, and forecast-
    variation cycle from 4.8 seconds to 3.2 seconds.

    Commit: 56bd9e3

38. **Rain animation retained in performance mode**

    Keeps the precipitation wave visibly undulating in performance mode while
    continuing to respect the operating system’s reduced-motion preference.

    Commit: 89fc295

39. **More visible wall-distance rain variation**

    Increased the smooth wave amplitude and strengthened the companion
    forecast trace so precipitation movement registers more clearly on the
    wall-mounted dashboard without changing the ±5% uncertainty model.

    Commit: ceb3995

40. **Faster precipitation refresh cadence**

    Polls weather data on the client every 2.5 minutes, including Performance
    Mode, while refreshing Pirate Weather’s provider cache every 5 minutes.

    Commit: 24381bb

41. **Readable synced form and travel labels**

    Kept Microsoft credential help text and travel park/photo labels at the
    shared 12px minimum so meaningful small text remains legible on wall
    displays and satisfies the surface readability contract.

    Commit: 01c9389

42. **Cleaner weather location and celestial details**

    Shows weather locations as a city and state abbreviation without postal
    codes, carries saved location labels through coordinate-based providers,
    and removes duplicate sunrise, sunset, and moon-phase details from the
    current-conditions stats.

    Commit: bfa6f2b

43. **Larger, cleaner weather current conditions**

    Removed the weather location label, enlarged the actual and feels-like
    temperatures, stacked them together, and moved the current condition into
    the right-side stats column.

    Commit: 4a95bd1

44. **Weather location in the stats footer**

    Restored the ZIP-free city/state location label at the bottom of the
    weather widget’s right-side stats column.

    Commit: c81f69f

45. **Simplified weather temperature labels**

    Drops the Fahrenheit suffix from imperial widget temperatures while
    retaining the degree symbol and preserving explicit Celsius labels.

    Commit: 5fe3427

46. **AirGradient-first local weather readings**

    Uses the AirGradient monitor at 10.0.1.55 for current temperature,
    humidity, and PM2.5 readings, recalculates feels-like from local
    conditions, and falls back to Pirate Weather with a red source indicator
    when the monitor cannot be reached.

    Commit: c4ba702

47. **Minute-by-minute local weather polling**

    Refreshes weather data every minute so the dashboard picks up new
    AirGradient readings without waiting for the provider cache to expire.

    Commit: f5a1642

48. **Readable PM2.5 air-quality status**

    Adds an EPA/AirNow-style, color-coded air-quality badge beside the local
    PM2.5 value, with familiar Good, Moderate, and unhealthy-level labels.

    Commit: 475060b

49. **Air-quality badge placement refinement**

    Moves the PM2.5 status badge directly beneath the feels-like temperature
    so the current conditions read as one cohesive local-weather stack.

    Commit: c0283b6

50. **Self-labeled air-quality badge**

    Labels the status pill “Air quality: [category]” so its meaning is clear
    without relying on the surrounding PM2.5 number.

    Commit: 73dde0d

51. **Compact air-quality label**

    Shortens the status pill to “Air: [category]” while retaining the full
    accessible label and tooltip.

    Commit: a1ca278

52. **Theme-aware air-quality colors**

    Gives every air-quality category contrast-tuned light and dark badge
    colors so the status remains legible across the dashboard themes.

    Commit: de74194

53. **Vibrant air-quality badges**

    Increases the badge fills, outlines, and status-dot intensity so current
    air-quality categories pop more clearly at a glance.

    Commit: 236d19c

54. **Aggressive air-quality colors**

    Uses saturated solid badge fills, high-contrast text, and category-colored
    shadows for an unmistakable air-quality signal.

    Commit: 4702a92

55. **Balanced vibrant air-quality colors**

    Softens the aggressive treatment back to vivid translucent fills with
    strong outlines and bright status dots.

    Commit: 6eac14a

56. **Synchronized current timeline temperature**

    Forces the timeline's “Now” temperature to match the main reading from
    either AirGradient or the Pirate Weather fallback, including cached data.

    Commit: 18b4658

57. **Readable compact weather labels**

    Raises compact weather headings, air-quality badges, and PM2.5 metadata
    to the readable `text-xs` size and updates the surface contract.

    Commit: 19bb010

58. **Simplified hourly timeline tiles**

    Removes repeated condition text from each timeline tile so the condition
    ribbon above is the single visual summary.

    Commit: 51d7658

59. **Expanded weather header metrics**

    Removes the redundant current-condition label and adds wind gusts, UV
    index, dew point, and visibility to the weather header.

    Commit: 3ba976c

60. **Aligned humidity and dew point**

    Places humidity and dew point on the same compact weather-header row.

    Commit: 2289699

61. **Expanded hourly weather tiles**

    Adds each timeline tile's feels-like temperature and precipitation chance,
    with provider data kept in sync for the current hour.

    Commit: f538ea6

## Superseded personal iterations

These are retained for historical context but should not be described as the
current UI behavior:

- The hourly weather view moved through the original merry-timeline strip
  (0d61d7d, f9c3521, cd94137), including width, screensaver, tracker-line,
  and red-current-indicator fixes (30a1d8e, 29e264f, d5a5bc9, 91538c9),
  a homegrown 12-hour strip (d202deb), and the current theme-aware nine-hour
  card timeline (d11e30a). The remove/revert commits were fae3480, 2c01b10,
  aa5491c, and e115bd0.
- The precipitation view moved through line, SVG-area, and bar-chart forms;
  the current form is the bar chart described in item 4.
- The Podman-specific local-services notes were retired after the development
  environment moved to OrbStack.

## Maintenance rules

When adding a personal feature or fix, append the next numbered entry to
**Active inventory** with:

- the user-facing outcome;
- the date if it helps explain sequencing;
- the commit hash or hashes; and
- any important compatibility or upstream-merge note.

If a personal change is replaced, keep the old entry in **Superseded personal
iterations** and update the active entry to describe the resulting behavior.
Do not add merge-only, traffic-stat-only, or upstream-sync-only commits as
features.

## Audit commands

~~~
git log --oneline --reverse upstream/master..HEAD --no-merges
git diff --stat upstream/master...HEAD
~~~
