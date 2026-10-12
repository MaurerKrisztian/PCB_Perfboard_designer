# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PCB Perfboard Designer — a browser-based CAD tool (HTML5 Canvas + TypeScript, no framework) for
laying out components and wires on a virtual perfboard grid. Built with Vite.

## Commands

```bash
npm install          # install deps
npm run start        # dev server (vite) — http://localhost:3000 (landing), /app/ is the editor
npm run build         # production build to dist/
npm run serve         # preview the production build
npm run lint          # eslint ./src --ext .ts
npm run format         # prettier --write "./**"
npm run format:check   # prettier --check "./**"
npm run deploy         # build + publish dist/ to GitHub Pages (gh-pages)
```

```bash
npm run e2e          # Playwright E2E tests (starts the dev server itself)
npm run e2e:update   # re-baseline snapshot images — see rules below
```

## E2E tests (Playwright)

Small suite in `e2e/`: a smoke test (fails on any console/page error at startup) and canvas
snapshot tests that load a saved project from `e2e/fixtures/` through the real Load input and
compare against baseline PNGs in `e2e/__snapshots__/`. First-time setup: `npx playwright install chromium`. The tests open the editor at `/app/` (the root is the landing page).

- Run `npm run e2e` after any change that affects rendering, startup, or project load/save.
- **A failing snapshot is not automatically a test problem.** Decide whether the visual change
  was intended. If it was, run `npm run e2e:update`, look at the changed PNGs, and mention them
  in the PR/summary. If it wasn't, fix the code. **Never re-baseline just to make a failure go
  away** — that hides regressions.
- A smoke-test failure is a real bug (e.g. a 404 or thrown error at startup); fix the cause
  rather than filtering the error out of the test.
- New component type or visible feature: add it to an existing fixture in `e2e/fixtures/` (or
  add a fixture) rather than writing a new interaction test, then re-baseline. Fixtures are
  project save files — if the save format changes, re-save them from the app.
- Keep the suite small and snapshot-driven; avoid pixel-coordinate assertions and per-feature
  click scripts.

## Architecture

**Pages** (Vite multi-page build, inputs listed in `vite.config.ts`). Served at
https://perfboarddesigner.com (GitHub Pages custom domain, kept across deploys by `assets/CNAME`).
Keep all in-site URLs relative — never `/...` — so it also works under the github.io subfolder
`/perfboard-designer/`. Absolute URLs belong only in SEO tags (canonical, og:*, sitemap).
- `index.html` — static, JS-free SEO landing page (styles in `src/landing/`).
- `app/index.html` — the editor itself (everything below). Static assets in `assets/` (the Vite
  publicDir) are served from the site root, so from the editor they're `../icons/...` etc.
- `contributors/index.html` — standalone page (`src/contributors/`) listing contributors live from
  the GitHub API; imports nothing from the editor.
- `assets/404.html` — GitHub Pages' not-found page, copied as-is (not a Vite input). It's served at
  whatever missing URL was requested, so it's fully self-contained (inline CSS/SVG) and is the one
  page that uses root-based links (`/app/`, `/`).

Vanilla TS, no framework, no state-management library. `src/index.ts` is the editor's entrypoint: it imports
every feature module for side effects (each attaches its own DOM event listeners), then calls
`createDotGrid`, `resetCanvas`, and `redrawCanvas` once at startup. Adding a new feature means
creating a module under `src/features/` and importing it in `index.ts`.

**State** (`src/state/`): plain classes used as static/global singletons (no instances are ever
created — `ClassName.staticField` is the "store"). E.g. `Canvas` (canvas element + 2D context +
coordinate mapping), `GridConfig` (grid constants like dot spacing/radius), `ToolState` (active
tool mode, armed wire, selected color/width), `DotState`, `LineState`, `IcState`,
`StandardComponentState`, `AdvancedComponentState`, `HistoryState` (undo/redo stack).

**Features** (`src/features/`): self-registering modules, each owning one concern (drawing,
hover, selection, color picker, context menu, shortcuts, project save/load, etc.). They read/
mutate the state classes and call `redrawCanvas()` (`src/features/draw-canvas.ts`) after any
change that affects what's on screen. `redrawCanvas` redraws everything from scratch each call
(immediate-mode style) in a fixed layer order: IC bodies → grid dots → wires → standard
components → advanced components → IC labels → in-progress placement previews.

**Two parallel component systems** — don't conflate them:
- `src/features/standard-components/` — flexible-lead parts (resistor, capacitor, LED, diode…)
  defined by `ComponentDefinition` in `component-definitions.ts`. Placed by picking a start and
  end dot; body is drawn between them. Values (e.g. resistance) use SI-prefix parsing/formatting
  in `component-value.ts` / `component-value-codes.ts`.
- `src/features/advanced-components/` — fixed-pin-geometry parts (ICs-adjacent, pots, etc.)
  defined by `AdvancedComponentDefinition` in `advanced-component-definitions.ts`. Placed via a
  single anchor dot + rotation; pin/shaded-hole/body-outline offsets (in grid units, relative to
  the anchor) are rotated at render/placement time (`rotate-offset.ts`).
- IC chips (`src/features/ic.ts`, `ic-editor-modal.ts`) are a third, older placement concept
  (multi-pin chip with a user-editable pin-label catalog), separate from both of the above.

**Undo/redo** (`src/features/project/undo-redo.ts` + `src/state/HistoryState.ts`): every mutation
that should be undoable pushes an `IChange` (`src/interfaces/change.interface.ts` — tagged union
over `line` / `ic` / `standard-component` / `advanced-component`, each with `type: "add" |
"remove"`) onto `HistoryState.changes`, truncating any redo tail first. `undo`/`redo` just replay
these adds/removes against the relevant state array and call `redrawCanvas()`.

**Persistence**: `src/features/project/save-project.ts` / `load-project.ts` serialize/deserialize
the full board (dots, lines, placed ICs/standard/advanced components, canvas size — shape in
`src/interfaces/project-save.interface.ts`) to/from JSON project files. `save-progress.ts` /
`load-from-local-storage.ts` do the same against `localStorage` for auto-persisted in-browser
state. Coordinates in saved data are canvas pixel coordinates, not grid indices.

**Canvas coordinates**: mouse events are mapped to canvas drawing-space coordinates via
`Canvas.toDrawingCoordinates(e)`, which accounts for CSS scaling of the canvas element (its
rendered size vs. its `width`/`height` attributes) — always go through this helper rather than
using `clientX`/`clientY` directly.

**Shortcuts**: keyboard shortcuts are registered via `ShortcutRegistry.add({key, ctrl?, event,
description})` in `src/features/shortcut-keys.ts` rather than ad hoc `keydown` listeners; the
registry also renders the on-page shortcuts legend from this list.

**DOM coupling**: `Utils.getSafeHtmlElement<T>(id)` (`src/utils/utils.ts`) is the standard way to
grab a required element by id and throws if it's missing — feature modules assume the relevant
elements already exist in `index.html` at import time (many call it at module load, not inside a
handler).
