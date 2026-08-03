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
