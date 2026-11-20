# Upstream sync — 2026-11-19

Preparation branch for merging `upstream/master` into the personal fork without
losing personal behavior. Use this as the review checklist before the merge is
promoted.

## What was merged

| | |
| --- | --- |
| Branch | `chore/upstream-master-sync-2026-11-19` |
| Base | `origin/personal` at `c36365cc` (PR #215) |
| Upstream | `upstream/master` at `d4586acb` |
| Upstream commits | 20 |
| Files changed | 108 |

The upstream range includes:
- Dev server on Turbopack with webpack preserved for production builds and Playwright browser tests (#1272)
- Performance optimization dropping card blur during widget move/drag in the editor (#1270, #1271)
- Nightly backup auto-healing missed dumps on the next run (#1268)
- Dependency upgrades for `next`, `eslint-config-next`, and `@next/bundle-analyzer` to 16.4.5 (#1269)
- Bus tracking improvements for curved streets and route tracing (#1262, #1263, #1264)
- Dock unification and tile styling with Edit layout accessibility (#1257, #1258, #1255)
- Screensaver scrollbar suppression on resting screens (#1259)
- CalDAV migration 0040 replay idempotency (#1228, #1241)
- Sign-in hardening, session termination on PIN/role changes, and daily lock (#1221, #1235)
- Privacy hardening for unauthenticated callers and wall display mode (#1222, #1224, #1234, #1236)
- Parent-only dashboard creation, modification, and deletion (#1223, #1230)

## Verification

- `git diff --check` — clean
- `npx jest src/lib/community/__tests__/validateLayout.test.ts --runInBand` — passed (44 tests)
- `npx jest src/lib/__tests__/devBundler.test.ts src/lib/__tests__/backupScript.test.ts` — passed
- `npm run type-check` — passed
- `npm run lint` — passed (0 errors, 961 pre-existing warnings)
- `npm test` — 451 test suites passed, 1 skipped; 4653 tests passed, 12 skipped
- `npm run build` — passed (178 static and dynamic routes compiled successfully)

## How conflicts were resolved

### Kept personal, integrated upstream additions

| File | Resolution |
| --- | --- |
| `package.json` | Kept personal scripts (`PORT:-3005`, harness, services, upstream tests) while adopting upstream's Turbopack dev server and `dev:webpack` / `predev:webpack` scripts. |
| `playwright.config.ts` | Configured `webServer.command` to `npm run dev:webpack` pointing to `baseURL` (retaining personal port configuration). |
| `scripts/backup.sh` | Retained POSIX `wc -c` check for dump size calculation (avoiding GNU-only `stat -c%s` failure on macOS) while adopting upstream's multi-dump off-site upload and portable date cutoff. |
| `src/styles/globals.css` | Retained personal View Transition API theme crossfade styles while integrating upstream's `html.editor-moving` blur suppression and sheet positioning. Deduplicated `html.performance-mode` tokens. |
| `src/components/layout/grid/CssGridEditor.tsx` | Retained personal `ResizePreview` while adopting upstream's `EDITOR_MOVING_CLASS` and blur suppression effect. |
| `src/components/dashboard/Dashboard.tsx` | Adopted upstream's `layout.isEditing` guard on the edit button while preserving personal role restrictions and LCARS integration. |
| `src/components/layout/AppShell.tsx` | Kept personal navigation components (`SideNav`, `PortraitNav`, LCARS status bar) while accepting upstream dock props on `AppShellProps` for API compatibility. |
| `src/components/layout/DashboardGrid.tsx` | Kept personal screen cleaning button and icon while importing upstream's `MORE_TILE` constant. |

### Kept personal, upstream addition intentionally not adopted

| Area | Why |
| --- | --- |
| `e2e/screensaver-geometry.spec.ts` | The fork retains the personal Displays UI and tabbed layout editor. Upstream's new sheet-based day/night time-axis tests are not applicable to the fork's layout editor. |

## Personal behavior that must not regress

1. **Weather** — conditions, AQI badge, UV/visibility, outlook prose, solar map, precipitation wave, radar.
2. **Calendar** — multi-day event lanes, four-week widget view, no-school shading, toolbar controls.
3. **Navigation / shell** — LCARS frame, portrait bottom bar, mobile nav, floating cards.
4. **Theme / display** — personal palettes, bundled local fonts, screen cleaning mode.
5. **Layouts** — multiple widget instances, grid editor, idle screensaver tabs.
