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

There is no test suite/framework in this repo (no test script, no test runner in
devDependencies). **Do not introduce Playwright or any other automated test tooling** — the user
tests changes manually in the browser.

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

**Components catalog** (`src/features/catalog/`): the sidebar's single Components section — a
search box over a category tree. It only decides where parts are *listed*; placing them is still
done by the three systems below. `catalog-categories.ts` declares the tree (one line per
category, `parentId` for nesting, array order = display order; `CategoryId` is derived from it so a
bad id fails to compile). Every part definition names one `category: CategoryId` plus optional
search `keywords`. `catalog.ts` merges all three systems into `CatalogItem`s whose
`activate`/`isArmed`/`remove` closures hide which system backs them; `catalog-search.ts` ranks by
match quality (exact > prefix > word prefix > substring > fuzzy) with kind (component >
subcategory > category) only as a tiebreak; `components-panel.ts` renders it. **Only `index.ts`
may import `components-panel.ts`** — it imports every part source, so a module importing it back
forms a cycle that runs the panel before `Ic` exists and crashes startup. Everything else talks to
it through the import-free `catalog-events.ts`: `notifyArmedPartChanged()` after changing what's
armed (refreshes the highlight), `notifyCatalogChanged()` after custom ICs change. To add a part:
add a definition to the relevant system's definitions file with a `category` — nothing else. To
add a category: one line in `catalog-categories.ts` (empty categories are hidden).

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
  (dual-row multi-pin part with labelled pins), separate from both of the above. It backs both
  DIP ICs and dual-row dev boards (Modules › Dev Boards); built-ins are data in
  `ic-definitions.ts` (`dualRowPins()` builds DIP numbering from two top-to-bottom rows). Custom
  ones come from the editor modal (IC or Module type → ICs › Custom / Modules › Custom) and persist
  in localStorage `custom_ics`. Project saves carry only custom ICs, and loading *merges* them into
  the catalog — never replace `Ic.IC_CONTAINER` wholesale, or built-ins added later go missing.

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
