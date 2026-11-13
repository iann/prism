# Upstream sync — 2026-11-13

Preparation branch for merging `upstream/master` into the personal fork without
losing personal behavior. Use this as the review checklist before the merge is
promoted.

## What was merged

| | |
| --- | --- |
| Branch | `chore/upstream-master-sync-2026-11-13` |
| Base | `origin/personal` at `e8abfc28` (PR #207) |
| Upstream | `upstream/master` at `0d4fa848` |
| Upstream commits | 33 |
| Files changed | 169 |

The upstream range includes two-way recipe and meal plan sync with Tandoor and Mealie (#1205, #1206, #1207, #1215), Google Tasks and Microsoft To Do subtask hierarchies (#1200, #1201, #1202), member passcode authentication (#1197), dock feature toggle sync across components (#1172, #1173), touchscreen wake tap swallowing (#1112), named screen idle resumption in PWA (#1156), global E2E test database teardown isolation (#1212), and documentation updates.

## Verification

- `git diff --check` — clean
- `npx jest src/lib/community/__tests__/validateLayout.test.ts --runInBand` — passed (44 tests)
- `npm run type-check` — passed
- `npm run lint` — passed (0 errors, 959 pre-existing warnings)
- `npm test` — 436 test suites passed, 1 skipped; 4499 tests passed, 12 skipped
- `npm run build` — passed (178 static and dynamic routes compiled successfully)

## Post-merge CI fixes

- **Migration replay Scenario H tag requirement (`scripts/test-migration-replay.sh`)**: Scenario H tests upgrading from v1.30.1 and checks out `refs/tags/v1.30.1`. Added fallback fetch to upstream and the canonical repository if the tag is not already present in `origin`, and pushed `v1.30.1` to `origin`.
- **Screensaver geometry E2E tests (`e2e/screensaver-geometry.spec.ts`)**:
  - Restored upstream `test.beforeEach` setting `prism-screensaver-carried: '1'` so seeded tests do not inadvertently trigger legacy migration logic on the default dashboard.
  - Re-applied test-specific `prism-screensaver-layout` inside `page.evaluate()` prior to dispatching `prism:screensaver`, preventing `useDashboardLayout` mount logic from clobbering the test layout.
- **Outline None utilities (`src/styles/globals.css`)**: Expanded `.prism-outline-none` utility selectors to include `.prism-outline-none .border-border` alongside `.prism-outline-none.border-border` and `.prism-outline-none [class*="bg-card"].border-border`.
- **SSRF safeFetch DNS resolution in Jest tests (`src/lib/utils/safeFetch.ts`)**: In unit tests (such as `immich.test.ts`) that force `NODE_ENV='production'`, live DNS lookups via `node:dns/promises` attempted to resolve fake domains (e.g. `immich.example.com`), causing network timeouts under multi-worker timezone matrix runs. Added `!process.env.JEST_WORKER_ID` check so live DNS resolution is only enabled in real production processes unless a resolver is explicitly passed.

## How conflicts were resolved

### Kept personal, integrated the upstream part

| File | Resolution |
| --- | --- |
| `src/lib/hooks/useIdleDetection.ts` | Kept personal screen-cleaning synchronization and abort guards while integrating upstream's waking tap swallowing (`swallowRestOfTap`), named screen idle timeout in PWAs (`isNamedScreen`), and household-wide Away mode auto-activation (`resolveAwayAutoAfter`). |
| `src/lib/hooks/useHiddenPages.ts` | Kept personal portrait navigation hooks and cache keys while adopting upstream's dock page cache and cross-component change announcement event (`announce({ hiddenPages, dockPages })`). |
| `src/app/settings/sections/FeaturesSection.tsx` | Kept personal portrait bottom navigation settings card while adopting upstream's "On the dock" checkbox controls and dock page capacity tracking. |
| `src/app/calendar/CalendarView.tsx` | Kept personal Manage calendars and No School toolbar buttons while adopting upstream's `h-9` height and `data-calendar-add-pill` attribute on Add Event. |
| `e2e/visual-regression.spec.ts` | Kept personal functional widget masks (tasks, shopping, chores) while adopting upstream's `[data-dock-menu]` mask. |
| `docs/CHANGELOG.md` | Preserved personal Clean screen and Remove widget release notes while incorporating upstream recipe sync, subtasks, and passcode entries. |
| `src/lib/__tests__/docsVoice.test.ts` | Added personal integration files (AirGradient, Home Assistant, NWS Forecast, OpenCode Go, Weather Alerts) to the allowed integrations helper set. |

### Kept personal, upstream addition intentionally not adopted

| Area | Why |
| --- | --- |
| `Dashboard`, `LayoutEditor`, `LayoutEditorDashboardManager` | The fork retains the CSS grid front page, personal editor toolbars, LCARS frame, and floating cards. Upstream's Today/Calendar scenes, editing bar, and sheet editor are not wired in. |
| `DisplaySection`, `ScreenSchedulePanel` | Retained personal Displays appearance settings, orientation controls, and schedule panels. Upstream's Screens rewrite and editing-bar moves are not adopted. |
| `e2e/display-registry.spec.ts`, `e2e/screensaver-geometry.spec.ts` | Retained personal tests reflecting the personal Displays UI and tabbed layout editor. |
| `docs/demos/*`, `docs/screenshots.md` | Retained existing fork screenshots; dropped upstream binary demos (`wall-*.png`) to keep repo size minimal and satisfy `repo-hygiene.yml` checks. |
| `e2e/visual-regression.spec.ts-snapshots` | Retained personal Linux baseline snapshots. |

### Upstream work that was adopted and should now be exercised

- Two-way recipe editing and meal-plan sync with Tandoor and Mealie.
- Subtask hierarchy and bidirectional completion sync with Google Tasks and Microsoft To Do.
- Member passcode login option (alphanumeric passcodes alongside PINs).
- Waking touch swallowing preventing accidental widget interaction on wall displays.
- Safe global E2E database teardown restricted to test database URLs.
- Dynamic dock item selection and cross-component broadcast.

## Personal behavior that must not regress

1. **Weather** — conditions, AQI badge, UV/visibility, outlook prose, solar map, precipitation wave, radar.
2. **Calendar** — multi-day event lanes, four-week widget view, no-school shading, toolbar controls.
3. **Navigation / shell** — LCARS frame, portrait bottom bar, mobile nav, floating cards.
4. **Theme / display** — personal palettes, bundled local fonts, screen cleaning mode.
5. **Layouts** — multiple widget instances, grid editor, idle screensaver tabs.
