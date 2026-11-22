# Upstream sync — 2026-11-22

## Merge

- Branch: `chore/upstream-master-sync-2026-11-22`
- Personal base: `origin/personal` at `c36365cc` (PR #215)
- Prior reviewed sync: `b6d5e553` (upstream through `d4586acb`)
- Upstream tip: `1f32f913`
- New upstream commits: 6

The new upstream work adds dashboard timelines and screen switching at bus
times or set times, per-dashboard resting and night looks, and a canvas editor
for editing the current or another named screen. It adds migrations 0054–0056.

## Conflict resolutions

- Kept the personal clean-screen and widget-removal changelog entries alongside
  upstream's canvas-editor entry.
- Adopted upstream's screen registry, screen-switch editor, canvas editor, and
  matching end-to-end coverage. Screen settings and notices now live in the
  editor sheets.
- Kept the personal widget shell and background styling in `CssGridDisplay`,
  and retained the compact coordinate input styling while removing number
  spinner controls.
- Restored the personal LCARS frame, birthday celebration controls, and floating
  weather radar / media playback cards in `Dashboard` after integrating the
  upstream canvas editor.
- No merge-only entry was added to `PERSONAL.md`.

## Verification

- `git diff --check` and `git diff --cached --check` — passed.
- No unresolved merge paths remain.
- Type-check, lint, and Jest could not run with the available dependencies:
  this worktree has no `node_modules`; the shared install is missing project
  packages (`tsc` reported missing type dependencies, ESLint could not load
  `eslint-config-next`, and Jest could not find `ts-jest`).
