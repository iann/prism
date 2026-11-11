# Upstream sync — 2026-11-10

Preparation branch for merging `upstream/master` into the personal fork without
losing personal behavior. Use this as the review checklist before the merge is
promoted.

## What was merged

| | |
| --- | --- |
| Branch | `chore/upstream-master-sync-2026-11-10` |
| Base | `origin/personal` at `7772821f` (PR #204) |
| Upstream | `upstream/master` at `53f0d982` |
| Upstream commits | 37 |
| Files changed | 257 |
| Text conflicts resolved | 34 |

The upstream range is the phone screen-editing work (#1153), the Through the
day / editing-bar redesign (#1151, #1152, #1157, #1158), the Simplified docs
voice pass (#1136–#1149), the shopping Manage rework (#1053), shared in-flight
GETs (#1081), and smaller fixes. The scheduled workflow could not merge it, so
this branch resolves the conflicts by hand.

## Verification

- `npm run type-check` — passed
- `npm run lint` — 0 errors (946 pre-existing warnings)
- `npm test` — 421 suites passed, 1 skipped; 4340 tests passed, 12 skipped
- `npm run build` — passed

## How conflicts were resolved

### Kept personal, integrated the small upstream part

| File | Resolution |
| --- | --- |
| `src/lib/hooks/useWeekStartsOn.ts`, `src/lib/hooks/useCalendarEvents.ts` | Replaced the personal per-hook in-flight caches with upstream `sharedGet`, which does the same job for every caller. |
| `src/lib/validations/index.ts` | Kept the personal formatting and adopted upstream `timesPerDay`, `kind` and `petId` chore fields. |
| `src/lib/utils/securityHeaders.js` + test | Kept the Windy `frame-src` allowance **and** adopted upstream Prism-self-framing (#1153); the test now allows only Windy as an external frame. |
| `src/components/layout/grid/CssGridDisplay.tsx` | Kept the personal memoized `WidgetCell`/`DeferredWidget`, and adopted upstream staged fill-in (#1083), `tileAlign` and `data-fill`. Alignment is passed as primitive props so an unchanged widget still skips re-render. |
| `src/components/ui/dialog.tsx` | Kept the personal dialog surface and close target, and adopted upstream `sheetSide()`, pointer-side tracking and the remote portal root. |
| `src/components/screensaver/Screensaver.tsx` | Kept the personal performance thumbnails and sky handling, and adopted upstream `noPhotos` plus the one night rule. |
| `src/components/layout/useLayoutEditorState.ts` | Kept the personal editor state and adopted upstream's copy-or-download export (#1147), so Export still works over plain HTTP. |
| `src/styles/globals.css` | Kept the personal calm-idle/water wallpaper rules, and adopted upstream's fuller idle-clear block in place of the older duplicate. |
| `src/app/page.tsx` | Kept the personal font-scale wrapper and adopted the `?screen=` phone-editing entry point. |
| `e2e/calendar-geometry.spec.ts` | Kept the personal deterministic fixtures and adopted the quiet-day helper, the rate-limit-aware `postEvent()` and `networkidle` waits. |
| `src/app/shopping/ShoppingView.tsx` | Adopted upstream's `ShoppingManage` callbacks and removed the superseded category-card grid. |
| `src/components/__tests__/surfaceClassContracts.test.tsx` | Added the two upstream alpha surfaces to the documented allowlist and dropped the removed category-card boundaries. |

### Kept personal, upstream addition intentionally not adopted

| Area | Why |
| --- | --- |
| `Dashboard`, `AppShell`, `LayoutEditor`, `LayoutEditorDashboardManager` | The fork keeps the grid front page, its own editor toolbar, LCARS frame, floating cards and personal navigation. Upstream's editing bar, Today/Calendar scene and sheet-based editor are not wired in. |
| `CreateDashboardDialog` + test | Still offers the grid starts only; Today/Calendar map to the default grid template. |
| `src/app/layout.tsx` | Kept the locally bundled theme fonts; upstream `next/font/google` is rejected so production builds stay network-independent. |
| `DisplaySection`, `DisplaysSection` | Kept the personal appearance controls and per-dashboard display settings. Upstream's Screens/editing-bar copy is not adopted. |
| `ThemeProvider` | Kept the personal palette loader and seasonal hook; upstream's duplicate palette-read effect is not added. |
| `screensaver-geometry.spec.ts` | Kept the personal new-look expectations; upstream's editing-bar helpers do not apply. |
| `docs/CHANGELOG.md`, `docs/HELP.md`, feature pages, `home-assistant.md` | Kept the personal content and voice. Upstream's new-look entries are not imported because those features are not user-visible here. |
| 47 Linux snapshot PNGs and demo screenshots | Kept the personal UI baselines; only the six README hero images were restored from upstream because the test asserts that every referenced file exists. |

### Upstream work that was adopted and should now be exercised

- `sharedGet` joins duplicate in-flight settings and calendar-source reads.
- Layout Export copies, or saves a file when the page may not use the clipboard.
- The shopping Manage view's category callbacks.
- The calendar quiet-day fixture helper and rate-limit-aware event creation in E2E.
- The fuller wallpaper/water readability rules in `globals.css`.
- The phone `?screen=` dashboard entry point.

## Personal behavior that must not regress

Use this as the smoke checklist. Every item maps to the inventory in
[`../PERSONAL.md`](../PERSONAL.md).

1. **Weather** — current conditions, AQI badge, UV/visibility line, timed
   summary, alerts, outlook prose (Tonight-first, 165/180 budget, 4-attempt
   ladder, red failure dot), hourly timeline, solar map, precipitation wave,
   radar and its home marker.
2. **Calendar** — event lanes across days, four-week widget view, no-school
   weekend tinting, event colors, widget resize hint (only in resize mode),
   auto-hiding chrome.
3. **Navigation / shell** — side nav in landscape, portrait bottom bar and its
   Features settings, mobile nav/FAB, LCARS shell and nav, auto-hide with
   floating cards, dashboard edit mode.
4. **Theme / display** — all personal palettes (Daybook, Claude, Kitchen Calm,
   LCARS), locally bundled fonts, first-paint palette, Sunset offset, font
   scale, performance mode, calm idle.
5. **Floating cards** — media player playback/turn-off confirmation, radar
   dismissal and placement, auto-hide while interacting.
6. **Data/integrations** — AirGradient-first readings, NWS alerts, NWS outlook
   and OpenCode Go prose, iCal/Google/CalDAV sync, birthdays/party mode,
   Home Assistant media.
7. **Layouts** — multiple widget instances, per-widget styling, screensaver
   layouts, idle backgrounds, dashboard create/copy/rename/delete, per-dashboard
   floating-card settings, layout export over HTTP.
