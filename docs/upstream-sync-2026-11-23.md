# Upstream sync — 2026-11-23

Preparation branch for merging `upstream/master` into the personal fork without
losing personal behavior. Use this as the review checklist before the merge is
promoted.

## What was merged

| | |
| --- | --- |
| Branch | `chore/upstream-master-sync-2026-11-23` |
| Base | `origin/personal` at `c36365cc` (PR #215) |
| Upstream | `upstream/master` at `c61174bb` |
| Upstream commits | 74 since the last merged tip (`848f6c7e`) |
| Files changed | 336 |

The range includes the contributor batch: calendar display rules and past-event
handling, recipe and meal-plan write-back with credential checks, home-network
Immich servers, OAuth placeholder credentials, sign-in hardening and named-screen
ticks, settings deep links, the Feedback question beside Help, shopping mode, bus
line fixes, the Next 16.4.5 update, and the upstream new-look editor, Glance
front page, dock and screen switches.

## Verification

- `git diff --cached --check` — clean
- `npm run type-check` — passed
- `npm run lint` — passed (0 errors, 957 pre-existing warnings)
- `npm test` — 470 test suites passed, 1 skipped; 4900 tests passed, 12 skipped
- `npm run build` — passed

## How conflicts were resolved

### Adopted upstream, kept personal behavior

| Area | Resolution |
| --- | --- |
| Past events in the agenda | Kept personal no-school tinting and day headers while adopting `withoutEndedEvents`, the dim/hide mode and the `Past Events` settings card. |
| Chores | Adopted the household-timezone due/late calculations (#1227). |
| Settings | Adopted URL-synced section deep links (#1252). |
| Displays | Adopted API-level screen switches and plan sync while keeping the personal Displays settings, schedule and notices panels. |
| Weather/settings cards | Kept the personal appearance layout; added the `Past Events` card beside the personal calendar deletion behavior card. |
| Docs | Added the Feedback and Past Events changelog entries, and the passcode/pet notes to Help. |

### Kept personal, upstream rewrite intentionally not adopted

| Area | Why |
| --- | --- |
| `Dashboard`, `LayoutEditor`, `LayoutGridEditor`, `CssGridEditor` | The fork keeps the CSS grid front page, personal editor toolbars, LCARS frame and floating cards. Upstream's Glance scene, canvas editor and editing panels are not wired in. |
| `AppShell`, `DashboardGrid`, `DisplaysSection`, `DisplaySection` | Retained the personal side/portrait/mobile navigation, Displays settings and per-dashboard text size. Upstream's dock navigation and Screens rewrite are not adopted. |
| Upstream editor files | Removed the orphaned upstream editor pieces and their tests (`CanvasEditor`, `EditorSheets`, `ScreenSheet`, `WidgetStylePanel`, canvas e2e specs, etc.) so the personal editor remains the only one built and tested. |
| `useScreenSchedule`, `app/page.tsx` | Kept the personal time-of-day schedule; upstream's screen switches are not used to choose the dashboard. |
| `docs/features/DASHBOARD.md`, `e2e/display-registry.spec.ts`, `e2e/screensaver-geometry.spec.ts` | Retained the personal editor and Displays documentation/tests. |
| `e2e/visual-regression.spec.ts-snapshots` | Retained personal Linux baselines. |

### Not adopted upstream changes

- Traffic statistics removal was adopted (the workflow and pages are gone).
- The new look (Glance, dock, canvas editor, screen switches UI) is not adopted,
  so its docs pages remain explanatory only and its editor tests were removed.

## Personal behavior that must not regress

1. **Weather** — conditions, AQI badge, UV/visibility, outlook prose, solar map,
   precipitation wave, radar.
2. **Calendar** — multi-day event lanes, four-week widget view, no-school
   shading, toolbar controls, past events.
3. **Navigation / shell** — LCARS frame, portrait bottom bar, mobile nav,
   floating cards.
4. **Theme / display** — personal palettes, bundled local fonts, screen cleaning
   mode.
5. **Layouts** — multiple widget instances, grid editor, idle screensaver tabs,
   per-dashboard text size.
6. **Screens** — personal Displays settings, time-of-day schedule and notices.
