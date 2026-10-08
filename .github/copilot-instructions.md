# Copilot instructions

See `CLAUDE.md` in the repo root for architecture and conventions. The E2E rules below apply to
all AI-assisted changes.

## E2E tests (Playwright)

Tests live in `e2e/`: a startup smoke test and canvas snapshot tests that load fixtures from
`e2e/fixtures/` and compare to baseline PNGs in `e2e/__snapshots__/`.

- Run `npm run e2e` after any change affecting rendering, startup, or project load/save.
- A failing snapshot means either a regression or an intended visual change. If intended, run
  `npm run e2e:update`, review the changed PNGs, and mention them in the PR description. If not
  intended, fix the code. **Never re-baseline just to make a failure pass.**
- A smoke-test failure is a real bug (startup error, 404, exception). Fix the cause; don't filter
  the error out of the test.
- When adding a component type or visible feature, add it to an existing fixture in
  `e2e/fixtures/` (or add a fixture) and re-baseline, instead of writing click-by-click tests.
- Keep the suite small and snapshot-driven.
