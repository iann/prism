# Upstream sync — 2026-11-07

Preparation branch for merging `upstream/master` into the personal fork without
losing personal behavior. Use this as the review checklist before the merge is
promoted.

## What was merged

| | |
| --- | --- |
| Branch | `chore/upstream-master-sync-2026-11-07` |
| Base | `origin/personal` at `a3966414` (PR #202) |
| Upstream | `upstream/master` at `bdacb4c7` |
| Upstream commits | 94 |
| Files changed | 299 |
| Text conflicts resolved | 48 |
| Linux visual baselines kept | 32 (personal UI) |

The upstream range is the new-look work: Today/Calendar front pages, the dock,
one event sheet, photo stage and focal framing, per-calendar display rules, the
chores page, dependency review, and a large design-system pass.

## Verification

- `npm run type-check` — passed
- `npm run lint` — 0 errors (942 pre-existing warnings)
- `npm test` — 409 suites passed, 1 skipped; 4195 tests passed, 12 skipped
- `npm run build` — run as part of the sync PR; see the PR checks

The Linux visual baselines were intentionally resolved to **ours**. They depict
the personal UI, not upstream's new look, and must be recaptured only from the
anonymized seed database (`E2E_HAS_TEST_DB=1`) if a screenshot actually changed.

## How conflicts were resolved

### Kept personal, integrated the small upstream part

| File | Resolution |
| --- | --- |
| `src/app/api/layouts/*`, `src/lib/validations/index.ts`, `src/lib/db/schema.ts`, `src/lib/hooks/useLayouts.ts` | Kept personal `floatingCardSettings` **and** adopted upstream `view` (`grid`/`today`/`calendar`). |
| `src/lib/hooks/useHiddenPages.ts` | Kept personal `portraitNavPages` **and** adopted upstream `dockPages`. |
| `src/lib/hooks/useCalendarEvents.ts` | Kept the personal cache/ref stabilization **and** adopted upstream `mergeSharedEvents`. |
| `src/components/providers/Providers.tsx` | Kept personal `initialPalette`/`initialPaletteIsExplicit` and the personal optional keyboard UI; added upstream `trackLastPointer()`. |
| `src/app/layout.tsx` | Kept the personal locally bundled theme fonts. **Rejected** upstream `next/font/google` so production builds stay network-independent (#117). |
| `src/app/calendar/ViewOptionsMenu.tsx` | Kept the personal trigger comment and adopted upstream `footer` (Manage calendars entry). |
| `src/components/widgets/WidgetContainer.tsx` | Kept the personal `wall-widget-title` styling and adopted upstream's 44px touch target. |
| `src/components/layout/WallpaperBackground.tsx` | Kept the personal `?thumb=1` performance thumbnail and adopted upstream `PhotoStage`, focal framing, and pinned-photo zoom rules (#954–#958). |
| `src/components/layout/grid/CssGridEditor.tsx` | Kept the personal drag/resize editor and adopted upstream keyboard move/resize/delete (`editorKeys`). |
| `src/components/dashboard/MobileDashboard.tsx` | Kept the personal LCARS tile class and added upstream `data-mobile-cards`. |
| `src/app/settings/SettingsView.tsx` | Kept personal card/blur styling; adopted the safe-area top and scrollable settings rail. |
| `src/components/ui/dialog.tsx` | Kept the personal dialog and added upstream's `sheetSide()` helper used by its test. |
| `.github/workflows/ci.yml` | Adopted the upstream 35-minute E2E timeout. |
| `e2e/visual-regression.spec.ts` | Kept hiding the personal precipitation radar and adopted hiding the upstream new-look offer toast. |

### Kept personal, upstream addition intentionally not adopted

| Area | Why |
| --- | --- |
| `AppShell`, `SideNav`, `PortraitNav`, `MobileNav` | Upstream replaced them with `Dock`; the personal fork keeps its wall/portrait/LCARS navigation, portrait bottom-nav settings, and auto-hide behavior. Upstream deleted the three components; they are restored. |
| `Dashboard`, `DashboardGrid` | Personal floating cards (radar, media player), LCARS frame, layout-editor tabs, weather/calendar revisions, and screen jobs are retained. Upstream `TodayScene`/`PhoneToday` rendering is not wired into the personal dashboard. |
| Weather widget body and header | Personal outlook prose (4-attempt ladder, 165/180 budget), UV/visibility pairing, AirGradient/AQI, alerts, solar map, and current-conditions layout are retained. Upstream's one-line condition/display-face header is not adopted. |
| Calendar views (`AgendaView`, `WeekView`, `DayViewSideBySide`, `SpanningEventRows`, `CalendarWidget`) | Personal lane allocation, no-school tinting, four-week view, event colors, and widget controls are retained. Upstream `SlidingTitle` long-title sliding is not adopted. The upstream event sheet and calendar hydration are adopted; the personal All/group filter buttons keep their filled-pill styling. |
| `CreateDashboardDialog` / `LayoutEditorDashboardManager` | The fork keeps the grid front page; upstream's Simple **Today** / **Calendar** starts are not offered. The handler accepts those values only to satisfy the merged type and maps them to the default grid template. |
| `styles/globals.css` | Personal idle-clear, glass, water, and view-transition rules are retained; upstream's duplicate new-look sheet/water block is not added. |
| `FeaturesSection` | Personal portrait bottom-navigation settings are retained instead of the upstream dock picker. |
| `docs/CHANGELOG.md` | Personal changelog entries are retained; upstream new-look entries are not imported because those features are not user-visible here. |
| `tokens.test.ts`, `color.test.ts` | Personal token/color contracts are retained; upstream's new-look tests target helpers the fork does not use. |
| 32 Linux snapshot PNGs | They depict the personal UI. |

### Upstream work that was adopted and should now be exercised

- Shared-event deduplication (`mergeSharedEvents`) for one event on two people's
  calendars.
- The one event sheet opened from the calendar, plus calendar hydration and the
  phone page Add button.
- Per-calendar display rules (`displayRules`, migration `0045`).
- Photo stage crossfade, focal framing, and photo place/date settings
  (migrations `0042`, `0043`).
- Bus walk-to-stop minutes (migration `0044`).
- Layout `view` column (migration `0041`).
- Editor keyboard shortcuts.
- Dependency review and CI retry workflows.
- Chores user guide and upstream test suites.
- `sheetSide()` helper and the upstream `formatTemp`/`MoonGlyph`/`weatherSentence`
  exports required by the new Today modules.

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
   floating-card settings.

## Test suite adjustments

- The personal `e2e/screensaver-geometry.spec.ts` and `e2e/visual-regression.spec.ts`
  were kept instead of importing upstream's new-look expectations (display-face
  clock, corner-tile alignment, water cards, dock login).
- The upstream visual test for the redesigned Appearance controls was removed
  with its two snapshots; the functional upstream display contract still runs.
- `waitForDashboardWidgets` now waits for both Tasks and Shopping to finish
  their skeleton state before a dashboard screenshot, so a slow seed cannot
  produce a skeleton-vs-loaded flake.
- Linux baselines were regenerated through the CI `update_visual_baselines`
  path after the personal calendar filters and DisplaySection were restored.

## Known follow-ups

- The `view` column and upstream Today/Calendar components exist but are not
  rendered by the personal dashboard. A future pass can adopt the Today scene
  deliberately; until then a `view='today'` layout renders as its widget grid.
- The `dockPages` setting is stored but the personal navigation uses
  `portraitNavPages`. Do not switch the Features UI to the dock picker without
  adopting `Dock`.
- Refresh Linux visual baselines only after reviewing real screenshot diffs;
  do not replace personal baselines with upstream's.
