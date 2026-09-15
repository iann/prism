# Upstream regression testing

The upstream-sync PR runs a deterministic E2E layer against the synthetic seed. It covers the areas most likely to be affected by upstream merges:

- dashboard-scoped navigation and the scoped Travel/Weekend routes;
- calendar sync-health warnings and their recovery link;
- Sunset mode, palette shape variables, and responsive Settings navigation;
- screensaver launch plus its in-place motion controls.

Run the interaction suite with:

```bash
npm run test:e2e:upstream
```

The upstream visual additions can be run alone:

```bash
npm run test:visual:upstream
```

`npm run test:visual` runs both the established matrix and these upstream-focused snapshots.

Both suites skip unless `E2E_HAS_TEST_DB=1` is set. This is intentional: snapshots must only be captured from the anonymized database created by `npm run db:seed`, never from a live family deployment.

## Linux baselines

The CI workflow's `visual-regression` job can bootstrap Linux snapshots with a manual run using `update_visual_baselines=true`. Download the resulting `visual-regression-linux-baselines` artifact, place the files in their matching `e2e/*-snapshots/` directories, review the diffs, and commit them. Once at least one Linux baseline is present, regular CI runs the full visual suite as a gate.
