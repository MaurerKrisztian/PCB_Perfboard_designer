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

`ARCHITECTURE.md` (repo root) is the developer guide to all of this, for people: how each part
works and how to extend it. Keep it in step with this file: a change that makes a section of
either wrong fixes both.

**Layers** (enforced by ESLint, `.eslintrc.cjs`): each imports only the layers below it.
`src/parts/` (part definitions, catalog categories, value parsing and colour codes,
`rotate-offset.ts`, `ic-package.ts`, and `part-geometry.ts`) imports nothing outside itself →
`src/project-file/` imports it → `src/board-render/` imports both → the editor, `src/viewer-3d/`
and `mcp/` on top. Those three bottom layers are pure (no DOM, no editor state; browser globals
like `document`/`Path2D` fail lint there), outside code imports the renderer only through
`src/board-render/index.ts`, the 3D viewer never imports the editor, and the editor never imports
`mcp/`. When lint stops an import, move the code to the right layer rather than silencing it.

**Pages** (Vite multi-page build, inputs listed in `vite.config.ts`). Served at
https://perfboarddesigner.com (GitHub Pages custom domain, kept across deploys by `assets/CNAME`).
Keep all in-site URLs relative — never `/...` — so it also works under the github.io subfolder
`/perfboard-designer/`. Absolute URLs belong only in SEO tags (canonical, og:*, sitemap).
- `index.html` — static, JS-free SEO landing page (styles in `src/landing/`).
- `app/index.html` — the editor itself (everything below). Static assets in `assets/` (the Vite
  publicDir) are served from the site root, so from the editor they're `../icons/...` etc.
- `contributors/index.html` — standalone page (`src/contributors/`) listing contributors live from
  the GitHub API; imports nothing from the editor.
- `mcp-server/index.html` — how to connect AI agents (Claude Code, claude.ai, ChatGPT, Cursor…) to
  the hosted MCP server at `https://mcp.perfboarddesigner.com/mcp` (see MCP server below). Reuses
  the landing's styles plus `src/mcp-page/` (its own styles and copy buttons; imports nothing from
  the editor). Named `mcp-server/` because `mcp/` is the server's package. Keep its setup steps in
  step with `mcp/README.md`.
- `assets/404.html` — GitHub Pages' not-found page, copied as-is (not a Vite input). It's served at
  whatever missing URL was requested, so it's fully self-contained (inline CSS/SVG) and is the one
  page that uses root-based links (`/app/`, `/`).

Vanilla TS, no framework, no state-management library. `src/index.ts` is the editor's entrypoint: it imports
every feature module for side effects (each attaches its own DOM event listeners), then calls
`createDotGrid` and `redrawCanvas` once at startup. Adding a new feature means
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
`onPointerDown`, `drawPreview` (given the board's Painter), `statusText`, optional `stepBack` (Escape) — registered in
`tools/index.ts` and looked up with `behaviorOf(tool)`. Tools only change state; the caller
(`select.ts`, the board's input router, which also owns panning, the context menu and Escape)
redraws and refreshes the status badge. Keep tool modules free of imports that lead back to
`draw-canvas.ts` (it imports the registry to draw previews), which is why the note prompt lives in
`dot-notes.ts` rather than `description.ts`.

**Features** (`src/features/`): self-registering modules, each owning one concern (hover,
selection, color picker, context menu, shortcuts, project save/load, etc.). They read/
mutate the state classes and call `redrawCanvas()` (`src/features/draw-canvas.ts`) after any
change that affects what's on screen. `redrawCanvas` redraws everything from scratch each call
(immediate-mode style): it hands the board renderer a snapshot of the board (`getSaveJson()`) and
what the editor marks on it (`editorView()`), then draws the active tool's preview on top. See
Rendering below.

**Rendering** (`src/board-render/`): one renderer draws every 2D board — the editor's canvas, PNG
and SVG export, Projects-dialog thumbnails, the catalog's chip icons, the MCP server's pictures —
as `drawBoard(painter, project, view)`: a project file in, shapes out onto a `Painter`
(`painter/painter.ts`: circle/arc/rect/line/polygon/path/text/image/group/stamp, each call carrying
its whole style). Two painters: `CanvasPainter` (`src/features/board-canvas/canvas-painter.ts`,
browser only: Path2D, hole sprites cached per zoom, text snapped to device pixels) and
`SvgPainter` (`painter/svg-painter.ts`, a string, runs anywhere; lets only plain colour syntax
through, since colours come from files anyone can write). `BoardView` (`board-view.ts`) is what to
mark beyond the file — part labels, `selected`/`hovered` items (a part by ref, a wire by index, a
hole by position), a placement's `startHole`, a net `highlight`; `PLAIN_VIEW` is none of it; the
editor builds its own in `src/features/board-canvas/editor-view.ts`. `draw-board.ts` alone fixes
the layer order: board look → under-board parts (chips) → holes (not those under a chip's body) →
wires → over-wires parts → junction dots → part labels → part overlays (chip pin labels) → net
highlight. Parts are drawn by one `PartArtist` per kind (`artists/`, registered in `artists/index.ts`)
from their project-file entries; a standard part's special art (resistor bands, ceramic code, LED
colour) is a `Decoration` in `artists/standard-decorations.ts`. Placed parts don't draw themselves
but hit-test with the same geometry as the drawing (`standardPartSpan`, `advancedPartGeometry`,
the package extents), so clicking and drawing agree. Icons are asked for by file name
(`getIconFile(def)`): the canvas side loads them (`board-canvas/browser-icons.ts`, redrawing when
one arrives; one-off drawings `await browserIcons.ready(iconsUsedBy(project))`), the SVG side is
handed their text. **`src/board-render/` is pure** (it may import only `src/project-file/` and
`src/parts/`), and outside code imports only its `index.ts`.

**Components catalog** (`src/features/catalog/`): the sidebar's single Components section — a
search box over a category tree. It only decides where parts are *listed*; placing them is still
done by the three systems below. `src/parts/catalog-categories.ts` declares the tree (one line per
category, `parentId` for nesting, array order = display order; `CategoryId` is derived from it so a
bad id fails to compile). Every part definition names one `category: CategoryId` plus optional
search `keywords`. `catalog.ts` merges all three systems into `CatalogItem`s whose
`activate`/`isArmed`/`remove` closures hide which system backs them (they set/read
`ToolState.active`); `catalog-search.ts` ranks by
match quality (exact > prefix > word prefix > substring > fuzzy) with kind (component >
subcategory > category) only as a tiebreak; `components-panel.ts` renders it. **Only `index.ts`
may import `components-panel.ts`** — it imports every part source, so a module importing it back
forms a cycle that runs the panel before `Ic` exists and crashes startup. Everything else talks to
it through the import-free `catalog-events.ts`: `notifyArmedPartChanged()` after changing what's
armed (`updateSelectionStatus()` already does, so `setActiveTool()` covers it), `notifyCatalogChanged()`
after custom ICs change. To add a part:
add a definition to the relevant system's definitions file with a `category` — nothing else. To
add a category: one line in `catalog-categories.ts` (empty categories are hidden).

**Board types**: a board is a perfboard (a separate pad per hole) or a stripboard (copper strips
along every row or column, which the user can cut at a hole). `BoardState.setup` holds the type
and strip direction; change it through `setBoardSetup()` (`src/features/board-type.ts`, which
also owns the sidebar switch and shows the Cut tool only on a stripboard). Strip cuts live on the
dots (`IDot.cut`), so they survive a resize and are kept, hidden, while the board is a
perfboard. How each type is drawn is its *look*, one file each in `src/board-render/board-looks/`
(`perfboard-look.ts`, `stripboard-look.ts`) behind the `BoardLook` interface (`paintBoard` for
the bare board, strips and cuts, a `hole` stamp per plain hole); `boardLookFor(type)` picks one. Strip and cut
sizes live in `src/project-file/stripboard-geometry.ts`, shared with the 3D viewer so both draw
cuts the same way. A new board type
means a new look there plus a `BoardType` in the project file.

**Two parallel component systems** — don't conflate them. Their definitions are pure data in
`src/parts/`; the placed-part classes live with their editor behaviour in `src/features/`:
- Standard components (`src/features/standard-components/`) — flexible-lead parts (resistor,
  capacitor, LED, diode…) defined by `ComponentDefinition` in `src/parts/component-definitions.ts`.
  Placed by picking a start and end dot; body is drawn between them. Values (e.g. resistance) use
  SI-prefix parsing/formatting in `src/parts/component-value.ts` / `component-value-codes.ts`.
- Advanced components (`src/features/advanced-components/`) — fixed-pin-geometry parts
  (ICs-adjacent, pots, etc.) defined by `AdvancedComponentDefinition` in
  `src/parts/advanced-component-definitions.ts`. Placed via a single anchor dot + rotation;
  pin/shaded-hole/body-outline offsets (in grid units, relative to the anchor) are rotated
  (`rotate-offset.ts`) by the shared part geometry (below).
- IC chips (`src/features/ic.ts`, `ic-editor-modal.ts`) are a third, older placement concept
  (dual-row multi-pin part with labelled pins), separate from both of the above. It backs both
  DIP ICs and dual-row dev boards (Modules › Dev Boards); built-ins are data in
  `src/parts/ic-definitions.ts` (`dualRowPins()` builds DIP numbering from two top-to-bottom rows). Custom
  ones come from the editor modal (IC or Module type → ICs › Custom / Modules › Custom) and persist
  in localStorage `custom_ics`. `Ic` is both the catalog entry and the placed chip; `Ic.id`
  identifies the catalog entry, and catalog entries are saved through `Ic.customIcEntries()`,
  which picks its fields (including `category`). Loading *merges* custom ICs into the catalog —
  never replace `Ic.IC_CONTAINER` wholesale, or built-ins added later go missing.

**Part geometry** is worked out once, in grid units, in `src/parts/part-geometry.ts`:
`advancedPartShape()` (a fixed-pin part's pins, covered holes, outline, icon anchor, body box),
`advancedPinOffsets()` (its pins before rotation) and `icPins()` (a chip's pins in DIP order, with
their side). Everything uses it — `src/project-file/pin-positions.ts` (nets, MCP),
`src/board-render/artists/advanced-geometry.ts` (the same in drawing px, for the drawing and
`PlacedAdvancedComponent`'s pins and hit test), `Ic.getRealPinPositions` and the 3D viewer — so
never work out pin positions anywhere else.

All three placed-part classes implement `PlacedPart` (`src/interfaces/placed-part.interface.ts`):
hit-testing, pin/occupied positions, anchor dots, `serialize()` (its entry, which the renderer draws) and `ref`, the part's
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
written to be read by people and programs (e.g. the MCP server) as well as the editor: facts
only, nothing derivable (no nets, strip segments or resolved pin positions), every field
documented there. `read-project-file.ts` reads any version (v2: no board type or refs; files
without `version` are v1: pixel coordinates, every hole, the whole IC catalog) into that shape,
validating everything and throwing `ProjectFileError` for non-projects before the board is
touched; bad entries are skipped and counted, and parts without a usable ref are numbered. `save-project.ts`'s `getSaveJson()` always writes the current version (each part's
`serialize()` returns its entry); `load-project.ts`'s `loadProject(raw)` reads and then rebuilds
the board, pinning wires and parts to the shared dot objects, and merges (never replaces) custom
ICs into the catalog. Projects are also kept in the browser: `project-store.ts` is the
`localStorage` layout (two keys per project, its file and `{name, updatedAt}`, so tabs on
different projects never write the same key), `current-project.ts` tracks which one is open
(`ProjectState.current`), opens/creates/imports/deletes them, and autosaves the open one shortly
after any redraw that changed it (via `onRedraw()` in `draw-canvas.ts` — every board change ends
in a redraw) and when the tab is hidden or closed. `projects-modal.ts` is the UI (File menu
items, header name, Projects dialog). **Share links** carry a whole project in the editor URL's
fragment (`#name=…&z=…`, or `json=`/`src=` for links written by people and programs such as AI
agents): the format is the pure `src/project-file/share-link.ts`, documented for outside writers in
`docs/share-links.md` (keep the two in step). `share-project.ts` is the Share dialog and opens an
incoming link as a new stored project (after startup's reopen, via `afterStartup()`, and on
`hashchange`), then clears the fragment. **Short links** (`#name=…&p=<id>`) name a copy kept on
Perfboard Designer's project storage (`STORED_PROJECTS_URL` in `share-link.ts`,
`https://projects.perfboarddesigner.com`): the Share dialog makes one on request, beside the full
link it always makes, and a `p=` link is fetched without asking, both through
`src/features/project/project-storage.ts`. The editor knows only that storage's HTTP API
(documented in `docs/share-links.md`), never the MCP server behind it. `PERFBOARD_PROJECTS_URL` when
building or running the editor (`vite.config.ts`'s `define`, `__PERFBOARD_PROJECTS_URL__`) points it
at another copy, e.g. a local Worker, or `off` builds it without short links. **The project must
work without short links and without the Worker**: they're optional extras, contacted only when a
user makes or opens a short link, and the full link is always offered beside them. No feature may
need them. A format change means a new version number plus an upgrade path in the reader —
old files must keep opening. `examples/*.json` are mostly v1 files and double as compatibility
fixtures; the two `*-555-blinker.json` are v3 and are the MCP server's examples.

**MCP server** (`mcp/`): a separate npm package (`perfboard-designer-mcp`, own `package.json`, Node
22+, stdio) that lets AI agents design boards. **It depends on the editor, never the other way
round**: the editor must not import anything from `mcp/` (an ESLint `no-restricted-imports` rule
enforces it) nor know the server exists (only the project storage's documented HTTP API, which the
Worker serves), and inside `mcp/` only `mcp/src/editor.ts` imports the
editor's source — every other server file takes editor code from it, so the whole dependency is
listed in one place. Layout: `create-server.ts` only wires things up, for two entry points:
`server.ts` (stdio) and `worker.ts` (Cloudflare Workers, stateless Streamable HTTP at `/mcp`,
`mcp/wrangler.toml`; `npm run worker:dev` / `worker:deploy`), so tool code must not use Node
APIs; the tools live in `mcp/src/tools/`
by group (`catalog-tools.ts`: list/get parts; `project-tools.ts`: new/edit/get project;
`board-tools.ts`: validate, nets, pin positions, render; `share-link-tools.ts`), resources in
`resources.ts`; shared tool inputs (`projectId`/`project`, `expectNets`) in `project-source.ts`,
reply formatting in `reply.ts`, wording helpers (holes, plurals, lists) in `text.ts`.
It can: list parts, start a project (`new_project`, blank or
from an example), change it with small ops (`edit_project`, whose wire ends can be pins by name),
get pin positions, draw it as text (`render_board`, `mcp/src/render-board.ts`), list the board's
nets (`get_nets`), validate it, make and read share links. `make_share_link` also returns `image`:
the Worker's `GET /render.svg?<a share link's fragment>` (`mcp/src/image-requests.ts`, `z=`/`json=`
only, never fetching `src=`), an SVG picture drawn by the editor's own board renderer with the part
icons `build.mjs` bakes in (`mcp/src/board-image.ts`); `GET /render.png?…` serves it as a PNG.
The Worker keeps a copy of every picture and stored project file it serves in each data center's
Cache API (`edgeCached()` in `worker.ts`, only answers that worked, for as long as their
`Cache-Control` says), so a repeat request isn't drawn again. `render_board` with `format: "png"` returns that PNG for the
agent itself to look at (`mcp/src/board-png.ts`): rasterized by resvg-wasm with the Noto fonts in
`mcp/fonts/` baked in; `build.mjs` copies the wasm to `dist/resvg.wasm`, which `server.ts` reads and
the Worker is uploaded with (`wrangler.toml`'s rules), each handing it over via `setResvgWasm`.
Projects being worked on are kept under a
`projectId` (`mcp/src/project-handles.ts`, behind an async `ProjectStore`: in memory for stdio, a
Durable Object per project on the Worker, so a tool that changes a kept entry calls
`saveHeldProject`), only a cache of the project file:
`get_project` returns it, and every tool takes `projectId` or the whole file as `project`.
`edit_project`'s ops (schema in `mcp/src/edit-ops.ts`, one function per op in `edit-project.ts`) only change file entries, all or none, and refuse
a change the reader would drop (e.g. a part pushed off a shrunk board); its reply, like
`new_project`'s, checks the board as `validate_project` does and lists the nets once there are no
errors. `expectNets` given for a projectId is remembered for later checks. Link base URL defaults
to `PERFBOARD_EDITOR_URL` (set in the client's MCP config), else the public site. **Stored
projects** (`mcp/src/stored-projects.ts`) are optional and extra: `make_share_link` with `store`/
`storeAs` also freezes the project under a short id made from a name (a few characters of its
SHA-256 added when the id holds another board), served by the Worker at `projects.perfboarddesigner.com`
(`POST /projects`, `GET /<id>.json|.png|.svg`, `mcp/src/project-requests.ts`), one Durable Object
each (`StoredProjectHolder`, deleted after a year unopened); the stdio server stores through that
HTTP API (`PERFBOARD_PROJECTS_URL`). The stdio server works without the hosted Worker too: its
extras are settings, each the public one unless set, `off` for none (`PERFBOARD_PROJECTS_URL` for
storing, `PERFBOARD_IMAGE_URL` for `make_share_link`'s `image`), and agents are offered only the
ones it has. The self-contained `z=` link is always made too; the short
link is a `p=` share link (a `src=` link to the file when stored anywhere but the public storage).
This is the same project storage the editor's short links use. The server's
`INSTRUCTIONS` must stay under about 2 KB, since clients cut off the rest: keep them to the
workflow and the rules, and put detail in the guide (both in `mcp/src/guide.ts`; the guide is
served as `perfboard://docs/guide`), keeping the two in step. Example projects
(`examples/perfboard-555-blinker.json`, `examples/stripboard-555-blinker.json`) are baked in by
`mcp/build.mjs` (described in `mcp/src/examples.ts`) and served as `perfboard://examples/...`
resources; keep them valid with their `expectNets`. Through `editor.ts` it uses the editor's pure
code (`src/parts/`, `src/project-file/`, `src/board-render/`),
which esbuild bundles with the SDK into
`mcp/dist/server.js` and `mcp/dist/worker.js` (`cd mcp && npm run build`; `npm run typecheck` uses its own newer TypeScript).
So those modules must stay free of DOM and editor state, and anything they import too. Facts the
server tells agents belong in the definitions (e.g. `leadLabels`, which lead of a polarized part is
which), not in `mcp/`. Pin positions from a project file (`src/project-file/pin-positions.ts`, shared with the nets)
come from the shared part geometry (`src/parts/part-geometry.ts`), like the editor's and the
renderer's. What's connected comes only from the shared `computeNets()` and `layoutProjectWires()`
(Nets and Wire crossings below): never write connectivity or crossing logic in `mcp/`; add what's
missing to those modules without reshaping their output, which the Nets panel and canvas use.
`get_nets` (`mcp/src/nets-report.ts`) names pins as agents write them, via `pinName()` in `nets.ts`
("U1.8 VCC", "D1.K", "C1.+", "R1.1"). Beyond the format, `validate_project` (`mcp/src/validate.ts`, one function per check)
warns about a wire passing over a pin without ending there, duplicate wires, a two-lead part with both leads on one net, IC pins and two-lead parts' leads
connected to nothing (not dev boards' or NC pins), wires that connect no pins, supply rails shorted
together (a power net named like "GND/VCC"), and on a stripboard, pins of one part shorted by a
strip or sitting in a cut hole. Wires crossing are only listed in its `notes`, never warned about.
Its optional `expectNets` (`mcp/src/expected-nets.ts`: the netlist the agent meant, as lists of
"REF.pin") reports every missing or extra connection as an error, treating the list as complete.
Check server changes with a throwaway script outside the repo that drives the built
`dist/server.js`. `.mcp.json` runs that file as the `perfboard` server, so rebuild after a change; a
running Claude session keeps the old build until it reconnects.

**Nets** (`src/project-file/nets.ts`): which pins the board connects, computed from a project file
and nothing else (`computeNets(project)`), so the editor and any program reading the file (the MCP
server) always agree. A wire
joins only its two end holes; things in one hole are joined; on a stripboard a strip joins its
holes up to the next cut, and a cut hole joins nothing. Nets are derived — never saved in the file.
The editor shows them live in the right sidebar above the shortcuts (`src/features/nets-panel.ts`),
recomputed from `getSaveJson()` shortly after a redraw that changed the board. Unconnected pins
and wires connecting no pins are in folds above the nets (likely mistakes, kept in sight). Clicking a net, an unconnected pin or
such wires lights it up on the board until clicked again: `NetHighlightState` holds its holes and
wires, drawn by the renderer (`view.highlight`, `src/board-render/layers/net-highlight.ts`), and the panel moves it to whichever net holds most of its pins
after each change (most of its wires, for wires connecting no pins).

**Wire crossings** (`src/project-file/wire-crossings.ts`): wires are insulated jumpers, so where
one runs across another wire, or over a hole holding a pin, a lead or another wire's end, it goes
*over* it (of two crossing wires, the later one in the list), and where three or more things meet
at a hole they're joined. `layoutWires()` works this out from wire ends and pin holes, and
`layoutProjectWires()` from a project file: the 2D renderer draws it (`src/board-render/layers/wires.ts`:
a dark edge either side of a wire where it goes over something, and a solder dot at each junction), and the 3D viewer
arches the upper wire over each crossing.

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
