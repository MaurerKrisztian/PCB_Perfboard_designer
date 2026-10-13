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
coordinate mapping), `GridConfig` (grid constants like dot spacing/radius), `DotState` /
`LineState` (the grid and wires, plus hover), `PartState` (every placed part, see below),
`BoardState` (perfboard or stripboard, see below), `HistoryState` (undo/redo stack). Two
discriminated unions keep "only one at a time" true by
construction: `SelectionState.current` (one selected pad, wire *or* part) and `ToolState.active`
(what a click on the board does: a toolbar mode — select/eraser/note/cut — or a placement tool —
wire, IC, standard or advanced component — with its pending first click). Switch tools through
`setActiveTool()` (`src/features/active-tool.ts`); `resetInteraction()` clears the selection and
drops a placement tool back to Select. Toolbar/catalog highlights are derived from this state in
`updateSelectionStatus()`.

**Tools** (`src/features/tools/`): each `ActiveTool` kind has a `ToolBehavior` —
`onPointerDown`, `drawPreview`, `statusText`, optional `stepBack` (Escape) — registered in
`tools/index.ts` and looked up with `behaviorOf(tool)`. Tools only change state; the caller
(`select.ts`, the board's input router, which also owns panning, the context menu and Escape)
redraws and refreshes the status badge. Keep tool modules free of imports that lead back to
`draw-canvas.ts` (it imports the registry to draw previews), which is why the note prompt lives in
`dot-notes.ts` rather than `description.ts`.

**Features** (`src/features/`): self-registering modules, each owning one concern (drawing,
hover, selection, color picker, context menu, shortcuts, project save/load, etc.). They read/
mutate the state classes and call `redrawCanvas()` (`src/features/draw-canvas.ts`) after any
change that affects what's on screen. `redrawCanvas` redraws everything from scratch each call
(immediate-mode style) in a fixed layer order: bare board → IC bodies → grid dots → wires →
standard components → advanced components → part labels → IC labels → in-progress placement
previews.

**Board types**: a board is a perfboard (a separate pad per hole) or a stripboard (copper strips
along every row or column, which the user can cut at a hole). `BoardState.setup` holds the type
and strip direction; change it through `setBoardSetup()` (`src/features/board-type.ts`, which
also owns the sidebar switch and shows the Cut tool only on a stripboard). Strip cuts live on the
dots (`IDot.cut`), so they survive a resize and are kept, hidden, while the board is a
perfboard. How each type is drawn is its *look*, one file each in `src/features/board-looks/`
(`perfboard-look.ts`, `stripboard-look.ts`) behind the `BoardLook` interface (`paintBoard` for
the bare board and strips, `drawHole` per hole); `activeBoardLook()` picks one. Strip and cut
sizes live in `src/project-file/stripboard-geometry.ts`, shared with the 3D viewer so both draw
cuts the same way. A new board type
means a new look there plus a `BoardType` in the project file.

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
  `Ic` is both the catalog entry and the placed chip; `Ic.id` identifies the catalog entry, and
  catalog entries are saved through `Ic.customIcEntries()`, which picks its fields.

All three placed-part classes implement `PlacedPart` (`src/interfaces/placed-part.interface.ts`):
hit-testing, drawing, pin/occupied positions, anchor dots, `serialize()` and `ref`, the part's
reference designator (R1, U2…), unique on the board ignoring case. `placePart` gives a new part
the lowest free ref for its kind; the letters come from each definition's `refPrefix` (ICs are
"U"), via `src/project-file/part-refs.ts`. Board-level code
(drag, delete, undo, save, resize) goes through that interface — narrow on `part.kind` only for
kind-specific behavior. They live in one list, `PartState.parts`, kept grouped by kind (ICs →
standard → advanced) so stacking and the per-kind arrays in the save file stay stable; add/remove
via `src/features/placed-parts.ts` (`placePart`/`removePart` record history, `addToBoard`/
`takeOffBoard` don't).

**Undo/redo** (`src/features/project/undo-redo.ts` + `src/state/HistoryState.ts`): every mutation
that should be undoable calls `HistoryState.record(change)` with an `IChange`
(`src/interfaces/change.interface.ts`): `add`/`remove`/`merge` of a line, `add`/`remove`/`move`
of a part, or `set` of a strip cut or of the board setup. `undo`/`redo` replay these and call `redrawCanvas()`. History is cleared whenever the
board is replaced (load, reset, resize) via `resetForNewBoard()`.

**Persistence**: the project file format lives in `src/project-file/` — pure code (no DOM, no
editor state) shared by the editor and the 3D viewer. `project-file.ts` defines the current format
(version 3: grid `[col, row]` positions, the board type with a stripboard's strip direction and
cuts, only marked pads, per-kind part arrays with each part's `ref`, the user's custom ICs). It's
written to be read by people and programs (e.g. a future MCP server) as well as the editor: facts
only, nothing derivable (no nets, strip segments or resolved pin positions), every field
documented there. `read-project-file.ts` reads any version (v2: no board type or refs; files
without `version` are v1: pixel coordinates, every hole, the whole IC catalog) into that shape,
validating everything and throwing `ProjectFileError` for non-projects before the board is
touched; bad entries are skipped and counted, and parts without a usable ref are numbered. `save-project.ts`'s `getSaveJson()` always writes the current version (each part's
`serialize()` returns its entry); `load-project.ts`'s `loadProject(raw)` reads and then rebuilds
the board, pinning wires and parts to the shared dot objects, and merges (never replaces) custom
ICs into the catalog. `save-progress.ts` / `load-from-local-storage.ts` do the same against
`localStorage`. A format change means a new version number plus an upgrade path in the reader —
old files must keep opening. `examples/*.json` are v1 files and double as compatibility fixtures.

**3D viewer** (`src/viewer-3d/`): a read-only three.js view of the board, kept separate from the
editor on purpose. It only consumes project-file JSON, read by the shared `src/project-file/`
reader and laid out in pixels by its own `project-data.ts`, and never imports editor state classes
— only pure data modules (the project-file reader, component definitions, value parsing/color
codes, `rotateOffset`). The editor side is just
`src/features/open-3d-view.ts`, which snapshots `getSaveJson()` and lazy-imports the viewer, so
three.js stays out of the main bundle. Scene units are mm (50px grid = 2.54mm pitch).

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
