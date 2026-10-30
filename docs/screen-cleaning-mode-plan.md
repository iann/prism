# Screen-cleaning mode implementation plan

Status: implementation complete. Automated checks pass except the repository
type check/full suite, which cannot load the locally missing
`astronomy-engine` dependency. Playwright browser execution and wall-display
hardware review remain pending because the isolated test database and display
are unavailable in this environment.

Branch: `codex/screen-cleaning-mode`, based on updated `personal` at
`1911580774045bd4c458e3feb33cb8a393e44a5f`.

## Build and verification status

- Focused Jest: 4 suites and 37 tests pass, including existing idle/Away tests.
- Full ESLint: passes with existing repository warnings. The changed files have
  no lint errors.
- `git diff --check`: passes.
- Type check and the full Jest run are blocked by the checkout's missing
  `astronomy-engine` package, which is declared in `package.json` but absent
  from `node_modules`.
- The five-test Chromium spec is present and Playwright lists it successfully.
  Browser execution was not attempted because `E2E_HAS_TEST_DB=1` is not set;
  the spec is explicitly gated to avoid household data.
- The physical wall display was not available for manual touch review.

## Intended experience

- Add a **Clean screen** action beside the existing dashboard mode controls.
  One press immediately covers the display and starts a **60-second** countdown
  (duration confirmed by the user).
- Show an opaque black background with a small centered message: **Screen
  cleaning**, **Touches are paused**, and **Returns in 1:00**. Count down through
  **0:59**, **0:58**, etc. Keep the rest of the display dark so
  fingerprints remain visible. Use a static interface without effects.
- Wiping, tapping, dragging, multi-touch, scrolling, and keyboard input cannot
  operate the covered application. There is no touch target that ends cleaning.
- Automatically uncover the previous screen at the deadline. If a wipe is still
  touching the screen, show **Lift your hand or cloth to finish** and retain the
  shield through release and its trailing click. This prevents the final wipe
  from pressing a dashboard control.
- Stop speech recognition and hide Prism's on-screen keyboard on entry; keep
  both stopped and hidden after cleaning. The previous route and deliberate
  mode return when the shield closes, while these temporary input tools stay
  closed. Auto-Away checks pause; a mutation already sent before entry may
  still settle and update under the shield.
- **Escape** ends the countdown early, using the same safe release behavior.
  Display a short Escape hint; capture that key so it cannot also close a dialog
  underneath.
- Keep the current route, dashboard layout, and deliberate Away/Babysitter mode
  intact. An awake dashboard resumes with a fresh screensaver idle countdown;
  an already idle view stays idle. Independent changes from another client can
  still arrive normally.
- This is temporary state for this tab. Refreshing clears it. Starting cleaning
  does not require a PIN or change another display.

Initial scope: desktop and tablet wall-dashboard header, including portrait wall
displays. Mobile-specific controls, settings for duration/background, remote
activation, and new controls inside Away/Babysitter/Screensaver are deferred.
The shield covers the application viewport; browser and operating-system UI are
outside its control.

## Phase 0 — Documentation discovery (completed)

Two discovery agents inspected control/overlay architecture and input/timer/test
patterns. The sources below were checked against the branch's actual code.

| Source | Verified pattern / implication |
| --- | --- |
| `src/components/layout/DashboardGrid.tsx:194–256` | `DashboardHeader` contains Refresh, Performance, Babysitter, Away, and Start screensaver actions. Add the trigger here. |
| `src/components/dashboard/Dashboard.tsx:528–583` | Mobile uses a separate dashboard; the wall header is in the non-mobile branch. |
| `src/components/layout/LazyOverlays.tsx:28–58`; `src/app/layout.tsx:302–308` | Global overlays persist outside route content, inside the providers. Mount the cleaning host here. |
| `src/components/screensaver/ScreensaverQuickSettings.tsx:72–79` | Copy the body-portal pattern; a fixed overlay inside the blurred toolbar was previously constrained to the toolbar. |
| `src/components/auth/QuickPinModal.tsx:219–230` | A body portal needs explicit `pointer-events-auto` even when a Radix dialog sets body pointer events to none. PIN and network surfaces reach layer 10001. |
| `src/lib/hooks/useDisplayIdle.ts:18–49` | Copy the small module-level external-store subscription pattern. Screensaver owns `setDisplayIdle`; cleaning must use its own state. |
| `src/lib/hooks/useIdleDetection.ts:35–208` | `useIdleDetection(initialTimeout?: number)` returns `{ isIdle, forceIdle }`. It owns screensaver timers, input listeners, and auto-away checks. |
| `src/components/screensaver/Screensaver.tsx:68–91` | A second idle hook exists here; `idleOverride` carries the root state. Changes must work for both instances. |
| `src/lib/hooks/usePullToRefresh.ts:8–52` | Document-level touch listeners can reload after a downward wipe of 72 px. Visual coverage alone does not block this. |
| `src/lib/hooks/useGlobalInput.tsx:29–57,352–488` | `useGlobalInput()` exposes `setKeyboardVisible(visible)` and `stopListening()`. Document listeners handle focus, pointer input, and barcode-like keystrokes. |
| `src/lib/hooks/useLocalDateKey.ts:75–103` | Copy clock-derived state plus visibility-change reconciliation rather than counting timer ticks. |
| `src/lib/hooks/useAutoHideUI.ts`; `useInactivityRedirect.ts`; `useIdleLogout.ts` | Cosmetic chrome, route inactivity, and authentication each have independent timers. Do not confuse their responsibilities. |
| `src/lib/hooks/__tests__/useVisibilityPolling.test.ts:1–43` | Copy jsdom hook setup, fake timers, wake simulation, and cleanup. |
| `e2e/screensaver-geometry.spec.ts:72–78,408–420`; `e2e/mobile-pwa-settings.spec.ts:22–37` | Viewport/touch and browser clock examples; seeded cases require an isolated test database. |
| `CONTRIBUTING.md`; `package.json`; `jest.config.js`; `playwright.config.ts` | Tests must demonstrate the regression. Actual commands/config take precedence over stale setup prose: ESLint script, Node-default Jest, Chromium on port 3005. |
| `docs/features/DISPLAY-MODES.md:174–186,332`; `PERSONAL.md:1130–1143` | Existing mode behavior/lazy-loading guidance and personal feature inventory requirements. |

### Allowed existing APIs and patterns

- React external-store subscription, copied from `useDisplayIdle.ts`; server
  snapshot must be inactive and stable. Cleaning state stays in memory, rather
  than copying the persistent preference behavior of `useStoredValue.ts`.
- `createPortal(children, document.body)`, copied from
  `ScreensaverQuickSettings.tsx`; fixed viewport coverage with an explicit
  stacking level above 10001.
- Native capture listeners via `addEventListener` / `removeEventListener`;
  use non-passive listeners when calling `preventDefault`, test cancelability,
  and retain matching cleanup references/options.
- `useGlobalInput().setKeyboardVisible(false)` and `.stopListening()` on entry.
  Focus must move to the cleaning surface rather than an input underneath it.
- Clock arithmetic using `Date.now()`, `setTimeout`, and wake reconciliation.
  Existing Playwright clock use is documented locally in the geometry spec.

Do not reuse `useModeToggle`, `/api/away-mode`, or `/api/babysitter-mode` for
cleaning. Do not call `setDisplayIdle` from the new controller. Do not copy the
Away overlay's tap-to-exit behavior or the default Dialog's close/outside-dismiss
behavior. No database migration, new endpoint, or additional dependency is needed.

## Phase 1 — Local state and deadline lifecycle (completed)

**Implement**

1. Read `useDisplayIdle.ts` and `useLocalDateKey.ts` before writing code. Copy
   their subscription and clock-reconciliation patterns into a small new
   `src/lib/hooks/useScreenCleaning.ts` module. Keep a single controller shared
   by the header and root host, without creating another idle-detection hook.
2. Define the new cleaning API explicitly: a subscribed snapshot, an idempotent
   start action, an exit request, and a synchronous active-state read for input
   and timer guards. These are new APIs to implement, not existing Prism APIs.
   Model inactive, cleaning, and finishing states; finishing remains protected.
3. Set a deadline of `Date.now() + 60_000` once protection is ready. Compute
   remaining seconds as `max(0, ceil((deadline - now) / 1000))`; additional starts
   while active do not extend the deadline. Reconcile on timer ticks, visible-tab
   return, window focus, and `pageshow` after browser restoration.
4. Make teardown idempotent and safe under React development remounts. Clear
   timers and contact tracking, and restore installed state exactly. A fresh
   document starts inactive even when it shares an origin with a cleaning tab.

**Verify**: fake-clock tests prove 60-second expiry, no extension from repeated
starts, correct expiry after skipped ticks/sleep, and clean restart after exit.
Use the fake-timer/cleanup setup at `useVisibilityPolling.test.ts:18–43`.

**Guards**: do not decrement a counter to measure elapsed time; do not persist or
broadcast the lock; do not depend on polling the server.

## Phase 2 — Viewport shield and input isolation (completed)

**Implement**

1. Copy the body-portal surface pattern from
   `ScreensaverQuickSettings.tsx:72–79` into a new
   `src/components/screen-cleaning/ScreenCleaningOverlay.tsx`. Mount a small
   persistent host in `LazyOverlays`, so activation never waits on a lazy chunk.
   The guard must be ready before the trigger can start a session; install
   protection before exposing the active countdown.
2. Use an opaque, fixed `inset-0` surface at reserved layer `z-[10002]` with
   explicit pointer events, touch-action suppression, and overscroll suppression.
   Match light/dark theme contrast while keeping the cleaning surface black.
   Keep the visual component under the repository's 250-line guideline by
   extracting the input lifecycle when needed.
3. Provide named modal semantics and focus on the shield. Temporarily make
   background content/portals inert while preserving their previous inert
   values; include siblings mounted during cleaning. Restore focus to the
   trigger or previous connected element after cleanup. Avoid per-second live
   announcements: announce entry and completion, with a readable visual timer.
4. Copy the explicit portal interactivity rule from `QuickPinModal.tsx:219–230`.
   At window capture phase, consume pointer, mouse, touch, click/double-click,
   wheel, context-menu, and application keyboard events before document/global
   handlers see them. Suppress browser defaults for cancellable wipe gestures.
   Stop speech input and hide Prism's keyboard using the verified input API.
5. Capture Escape as an exit request and swallow its propagation/terminal key
   events. Ordinary wiping cannot dismiss or extend the session.
6. Track all active contacts. At expiry/early exit, retain protection through
   pointer/touch release and any compatibility click before restoring input.
   Handle cancellation, lost capture, blur, and hidden/resumed pages so stale
  contacts cannot strand the display. Contacts that remain after focus returns
  stop blocking the countdown after a one-second recovery window, then stay
  quarantined so a late release and trailing click cannot reach the app. Keep
  the finishing message visible while a tracked contact remains.

**Verify**: DOM integration tests prove underlying buttons, document touch
listeners, keyboard/barcode handlers, and Escape listeners remain untouched.
Test multiple contacts, pointer cancellation, finishing across the deadline,
focus/inert restoration, repeated sessions, and unmount cleanup. Browser tests
must check hit coverage over existing portals and Radix focus behavior, because
jsdom cannot prove stacking, browser gesture defaults, or real focus trapping.

**Guards**: a high z-index alone is insufficient; do not place the shield inside
the header; do not allow a touch-dismiss button or release/click to fall through.
If a Radix focus scope conflicts with the body portal, resolve that integration
explicitly before marking this phase complete.

## Phase 3 — Dashboard entry and mode coordination (completed)

**Implement**

1. Copy the named action markup at `DashboardGrid.tsx:232–252` for **Clean
   screen**, or extract a small reusable trigger. Use a suitable existing icon,
   an accessible name, visible keyboard focus, and a minimum 44 px target.
   Place it with the mode actions without introducing a new menu. Check the
   existing auto-hidden header can still be revealed normally before entry.
2. Update the existing idle hook using its own timers and the shared cleaning
   snapshot: pause automatic screensaver/auto-away transitions while protected,
   and ignore cleaning gestures. Preserve its pre-entry `isIdle` state. On exit,
   resume an awake view with a fresh idle timeout. Keep both existing hook
   instances consistent and preserve `idleOverride` ownership.
3. Stop auto-away checks and cancel their state GET while cleaning is active;
   recheck immediately before sending the mutation. A POST already sent is
   allowed to settle, then triggers a shared state refresh under the shield.
   Cleaning itself does not toggle deliberate Away/Babysitter mode.
4. Count deliberate entry/exit as activity using the existing last-activity
   mechanism, with graceful handling if storage is unavailable. The independent
   idle-logout/authentication policy remains active. Do not mark wiping as user
   edits or dispatch fake global mouse/keyboard events to reset timers.
5. Keep route state mounted behind the shield. The current v1 trigger is only
   on dashboard routes, so avoid expanding inactivity redirect/mobile controls
   unless a test reveals an integration dependency.

**Verify**: cover `/` and `/d/<slug>`, auto-hidden chrome, portrait wall layout,
the shortest screensaver timeout, timeout set to Never, and repeated activation.
Integration tests should mount existing idle behavior with the cleaning store,
prove no auto-away mutation is caused by cleaning, and prove the prior idle or
deliberate mode survives. Verify an Escape exit cannot also close an underlying
dialog. Keep independent authentication tests passing.

**Guards**: no third `useIdleDetection()` instance, no authentication bypass, no
new server mode setting, and no cosmetic transition that reveals an unintended
screensaver immediately after cleaning.

## Phase 4 — Regression proof, documentation, and final verification

**Implement and verify**

1. Add focused tests beside the new hook/component and an
   `e2e/screen-cleaning.spec.ts` using the existing auth/isolated-DB helpers.
   Copy viewport and browser-clock patterns from the Phase 0 sources. Use browser
   clock control supported by the installed Playwright package; avoid a real
   minute-long wait in every test.
2. In Chromium, measure full viewport coverage and sample corner/center hit
   targets in landscape and portrait. Exercise a downward touch wipe with the
   existing refresh handler mounted in a test harness, and verify no reload,
   scroll, navigation, or mutation. Touch input can be covered without adding a
   mobile production entry point. Real browser touch validation must accompany
   DOM event tests.
3. Hold a contact across expiry, release over a covered interactive control, and
   prove no click-through. Repeat with cancellation and tab suspension/resume.
   Verify real keyboard Escape, Tab focus isolation, two consecutive sessions,
   and independent tabs. Review once on the physical wall display for multi-touch
   wiping and screen-edge behavior.
4. Demonstrate at least one behavior test fails when the feature is absent or
   its input guard is removed, per `CONTRIBUTING.md`. Do not substitute source
   string assertions for interaction tests.
5. Focused Jest tests, full ESLint, Playwright test discovery, and
   `git diff --check` pass. Type check and full Jest execution are blocked by
   the missing local `astronomy-engine` dependency. The browser spec is gated
   and was not executed without an isolated seeded test database. The physical
   wall display was unavailable for touch review.
6. Document the user flow in `docs/features/DISPLAY-MODES.md`, add the appropriate
   changelog entry, and append the next numbered personal-feature entry to
   `PERSONAL.md` once the implementation commit exists. Do not claim this plan
   itself is a shipped feature. Review the final diff for unintended persistent
   settings, endpoints, idle-state writers, and household-mode mutations.

**Implementation completion criteria**: a single header action starts the confirmed 60-second
cleaning session immediately; wipes cannot operate the application; timer and
Escape exits safely restore the prior view; meaningful regression checks pass;
and user documentation describes the implemented behavior. Browser and hardware
validation above remains to be completed in the appropriate environment.

**Guards**: do not update visual baselines merely to accept a coverage or layout
regression; do not mark real touch behavior verified using only synthetic jsdom
events; do not push, open a PR, or deploy as part of this planning task.
