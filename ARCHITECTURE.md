# Architecture

How Perfboard Designer is put together, and how to extend it. This is the guide for people working
on the code; `CLAUDE.md` is the shorter brief for AI agents and links here. When a change makes a
section wrong, fix the section in the same change.

Contents:

1. [Overview](#1-overview)
2. [Map of the code](#2-map-of-the-code)
3. [Editor runtime](#3-editor-runtime)
4. [Tools](#4-tools)
5. [Parts and the catalog](#5-parts-and-the-catalog)
6. [Board types](#6-board-types)
7. [Undo and redo](#7-undo-and-redo)
8. [Project file and persistence](#8-project-file-and-persistence)
9. [Connectivity: nets and wire crossings](#9-connectivity-nets-and-wire-crossings)
10. [Rendering](#10-rendering)
11. [3D viewer](#11-3d-viewer)
12. [MCP server](#12-mcp-server)
13. [Conventions](#13-conventions)

---

## 1. Overview

Perfboard Designer is a browser CAD tool for laying out parts and wires on a perfboard or
stripboard. It's vanilla TypeScript on an HTML5 canvas: no framework, no state library. It's built
with Vite as a multi-page site (inputs listed in `vite.config.ts`) and published to GitHub Pages
at https://perfboarddesigner.com.

| Page | Source | What it is |
| --- | --- | --- |
| `/` | `index.html`, `src/landing/` | Static, JS-free landing page (SEO). |
| `/app/` | `app/index.html`, `src/index.ts` | The editor: everything below. |
| `/guide/` | `guide/index.html`, `src/guide/` | Static, JS-free user guide (SEO): how to use the editor, feature by feature. Reuses the landing's styles. Keep it in step with the editor when a feature changes how it's used. Linked from the editor's Help menu. |
| `/contributors/` | `contributors/index.html`, `src/contributors/` | Contributors, live from the GitHub API. Imports nothing from the editor. |
| `/mcp-server/` | `mcp-server/index.html`, `src/mcp-page/` | How to connect AI agents to the hosted MCP server. Keep its steps in step with `mcp/README.md`. |
| 404 | `assets/404.html` | GitHub Pages' not-found page, fully self-contained. |

`assets/` is Vite's publicDir: served from the site root, so from the editor the part icons are
`../icons/components/…`. **Keep in-site URLs relative** (never `/…`), so the site also works under
the github.io subfolder `/perfboard-designer/`. Only SEO tags (canonical, og:*, sitemap) and the
404 page use absolute or root-based URLs.

```bash
npm install          # dependencies
npm run start        # dev server: http://localhost:3000 (landing), /app/ is the editor
npm run build        # production build to dist/
npm run lint         # eslint ./src
npm run format       # prettier
npm run deploy       # build + publish to GitHub Pages
```

There are no automated tests: changes are checked by hand in the browser (section 13).

## 2. Map of the code

```
src/
  index.ts             the editor's entrypoint: imports every feature, draws the first board
  state/               global state, as static fields on plain classes (the "stores")
  interfaces/          shared editor types: dots, lines, placed parts, undo changes
  features/            one concern per module: tools, parts, catalog, panels, project files…
    tools/             what a click on the board does, one behaviour per tool
    standard-components/, advanced-components/   the placed-part classes of the two part systems
    catalog/           the Components panel: category tree, search, items
    project/           save/load, local projects, share links, export, undo/redo
    board-canvas/      the editor's side of drawing: canvas painter, icons, what to mark
  parts/               PURE: part definitions, categories, values, and where a placed part's pins and body are
  project-file/        PURE: the project file format, its reader, pins, nets, crossings, share links
  board-render/        PURE: draws a board from a project file onto any Painter
  viewer-3d/           read-only three.js view of a project file (lazy-loaded)
  landing/, contributors/, mcp-page/   the other pages' own code
mcp/                   separate npm package: the MCP server (stdio and Cloudflare Worker)
docs/                  share-links.md (the link format for outside writers), component-footprints.md
examples/              project files; double as compatibility fixtures and MCP examples
assets/                static files served from the site root (icons, 404 page, CNAME…)
```

**Pure** means: no DOM, no editor state, nothing imported that has either. Pure code is shared by
the editor, the 3D viewer and the MCP server (which runs it on Node and Cloudflare Workers), which
is why the rule is strict.

The code is in layers, and each imports only the layers below it:

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  editor (src/features, src/state…)   src/viewer-3d/   mcp/ (via editor.ts)    │  apps
├───────────────────────────────────────────────────────────────────────────────┤
│  src/board-render/    draws a board from a project file                       │  pure
├───────────────────────────────────────────────────────────────────────────────┤
│  src/project-file/    the file: format, reader, pins, nets, crossings, links  │  pure
├───────────────────────────────────────────────────────────────────────────────┤
│  src/parts/           part definitions, categories, values, part geometry     │  pure
└───────────────────────────────────────────────────────────────────────────────┘
```

- **`src/parts/`** imports nothing outside itself: the definitions of every part
  (`component-definitions.ts`, `advanced-component-definitions.ts`, `ic-definitions.ts`), the
  catalog's categories, value parsing and colour codes, `rotate-offset.ts`, `ic-package.ts` (chip
  or dev board?), and **`part-geometry.ts`**: where a placed part's pins, covered holes and body
  are, in grid units. That one module is the only place this is worked out (section 5).
- **`src/project-file/`** imports `src/parts/`.
- **`src/board-render/`** imports both, and outside code uses it through its `index.ts` only.
- **The 3D viewer** reads project files and the pure layers, never the editor's state.
- **The editor never imports from `mcp/`**, and doesn't know it exists.

ESLint enforces all of this (`.eslintrc.cjs`). An import that crosses a layer the wrong way, or a
browser global (`document`, `Path2D`…) in a pure layer, fails `npm run lint` with a message saying
which rule it broke.

## 3. Editor runtime

**Startup.** `src/index.ts` imports every feature module for its side effects. Each one attaches
its own DOM listeners when it loads, usually grabbing its elements with
`Utils.getSafeHtmlElement<T>(id)` (`src/utils/utils.ts`), which throws if `app/index.html` lacks the
element. Then it calls `createDotGrid` and `redrawCanvas` once. A new feature is a new module
under `src/features/`, imported in `index.ts`.

**State** (`src/state/`) is plain classes used as singletons: `ClassName.staticField` *is* the
store, and no instances are made.

| Class | Holds |
| --- | --- |
| `Canvas` | the canvas element, its 2D context, `toDrawingCoordinates(e)` |
| `GridConfig` | grid constants (hole pitch 50 px, hit radii) |
| `DotState`, `LineState` | every hole (`IDot`) and wire (`ILine`), plus what's hovered |
| `PartState` | every placed part, in one list grouped by kind (section 5) |
| `BoardState` | perfboard or stripboard, and the strip direction |
| `SelectionState` | the one selected hole, wire *or* part (a discriminated union) |
| `ToolState` | the active tool: a toolbar mode or a placement tool (a discriminated union) |
| `ViewState`, `NetHighlightState`, `HistoryState`, `ProjectState`, `DragState` | labels on/off, the lit-up net, undo stack, open project, drag in progress |

The two unions make "only one at a time" true by construction: one selection, one tool.

**Redraw.** Any change that affects the screen ends with `redrawCanvas()`
(`src/features/draw-canvas.ts`), which redraws everything from scratch (section 10).
`onRedraw(listener)` runs after every redraw. That's how autosave and the Nets panel notice
changes without each edit having to report itself.

## 4. Tools

`ToolState.active` decides what a left click on the board does: a toolbar mode (`select`,
`eraser`, `note`, `cut`) or a placement tool (`wire`, `ic`, `standard-component`,
`advanced-component`) with its pending first click (`start`).

Each kind has a `ToolBehavior` (`src/features/tools/tool.ts`):

- `onPointerDown(tool, click)`: what a click does. Return `false` to fall back to plain selection.
- `drawPreview(tool, hoverDot, painter)`: optional; drawn over the board while the pointer is over a hole.
- `statusText(tool)`: the status badge.
- `stepBack(tool)`: optional; what Escape does inside the tool.

Behaviours are registered in `src/features/tools/index.ts` and found with `behaviorOf(tool)`.
**Tools only change state.** `src/features/select.ts` is the board's input router (it also owns
panning, the context menu and Escape). It calls the tool, then redraws and refreshes the status.
Switch tools with `setActiveTool()` (`src/features/active-tool.ts`). `resetInteraction()` clears
the selection and drops a placement tool back to Select.

Keep tool modules free of imports that lead back to `draw-canvas.ts`, which imports the registry
to draw previews. That's why the note prompt lives in `dot-notes.ts`.

> **Extend: add a tool.**
> 1. Add its variant to `ActiveTool` in `src/state/ToolState.ts`, plus `ToolMode` and
>    `isPlacementTool` if it's a toolbar mode.
> 2. Write its `ToolBehavior` in `src/features/tools/<name>-tool.ts`. Draw its preview with the
>    painter it's given (`drawStartMarker` and `drawPart` from `src/board-render` help).
> 3. Add it to `BEHAVIORS` in `src/features/tools/index.ts`. TypeScript insists on every kind.
> 4. Arm it from a button or shortcut with `setActiveTool({kind: …})`.

## 5. Parts and the catalog

There are **three placement systems**. Don't conflate them:

| System | Definitions | Placed by | Examples |
| --- | --- | --- | --- |
| Standard components | `ComponentDefinition` in `src/parts/component-definitions.ts` | two holes, start and end; the body sits between the leads | resistor, capacitor, LED, diode |
| Advanced components | `AdvancedComponentDefinition` in `src/parts/advanced-component-definitions.ts` | one anchor hole + rotation; pin offsets in grid units, rotated with `rotate-offset.ts` | pots, transistors, switches, header pins |
| ICs | `IC_DEFINITIONS` in `src/parts/ic-definitions.ts`; custom ones from `ic-editor-modal.ts` | top-left pin + rotation | DIP chips, dual-row dev boards |

The placed-part classes live with their editor behaviour: `PlacedStandardComponent` and
`PlacedAdvancedComponent` in `src/features/standard-components/` and `src/features/advanced-components/`,
and `Ic` (`src/features/ic.ts`), which is both a catalog entry and a placed chip. Custom ICs are kept in
`localStorage` (`custom_ics`), and loading a project **merges** its custom ICs into the catalog,
never replacing `Ic.IC_CONTAINER`.

**Part geometry** is worked out in one place, `src/parts/part-geometry.ts`, in grid units:

- `advancedPartShape(def, placement)`: a fixed-pin part's pins, covered holes, outline, icon
  anchor and body box;
- `advancedPinOffsets(def, rows, cols)`: its pins before rotation (a header block's lattice);
- `icPins(placement)`: a chip's pins in DIP order, with the side of the chip each is on.

Every consumer uses it:

- the nets and the MCP server, through `src/project-file/pin-positions.ts`;
- the renderer and the editor's hit tests, through `src/board-render/artists/advanced-geometry.ts`, which converts to drawing pixels;
- `Ic`, for its pin positions;
- the 3D viewer, for chip pins and solder joints.

Change a footprint rule there and everything follows.

All placed parts implement `PlacedPart` (`src/interfaces/placed-part.interface.ts`): hit-testing,
pin and occupied positions, anchor dots, `layer`, `ref` and `serialize()` (its project-file
entry). Drawing isn't on it: the renderer draws every part from its `serialize()` entry
(section 10). Board-level code (drag, delete, undo, save, resize) only uses this interface and
narrows on `part.kind` only for kind-specific behaviour.

- **Refs** (R1, U2…): unique ignoring case. `placePart` gives a new part the lowest free one, from
  its definition's `refPrefix` (ICs are U), via `src/project-file/part-refs.ts`.
- **`PartState.parts`** stays grouped by kind (ICs → standard → advanced), so stacking and the
  per-kind arrays in the file stay stable. Add and remove parts through
  `src/features/placed-parts.ts`: `placePart`/`removePart` record undo history,
  `addToBoard`/`takeOffBoard` don't.

**The catalog** (`src/features/catalog/`) is the sidebar's Components section: a search box over a
category tree. It only decides where parts are *listed*.

- `catalog-categories.ts` declares the tree: one line per category, `parentId` for nesting, array
  order is display order. `CategoryId` is derived from it, so a bad id fails to compile.
- `catalog.ts` merges the three systems into `CatalogItem`s.
- `catalog-search.ts` ranks matches: exact > prefix > word prefix > substring > fuzzy.
- `components-panel.ts` renders it. **Only `index.ts` may import it**: it imports every part
  source, so importing it from anywhere else forms a cycle that crashes startup. Talk to it through
  the import-free `catalog-events.ts` instead.

> **Extend: add a part.** Add a definition, with a `category` and optional search `keywords`, to
> the right system's definitions file, and its icon to `assets/icons/components/<id>.svg` (or set
> `iconFile`). That's all: the catalog, the board, exports, thumbnails and the MCP server pick it
> up. Optional extras:
> - a 3D model: a builder in `src/viewer-3d/parts/`, wired in `build-catalog-parts.ts`;
> - special 2D art for a standard part: a decoration (section 10);
> - `leadLabels` / `pinLabels`, so the MCP server can name pins.
>
> **Extend: add a category.** One line in `catalog-categories.ts`. Empty categories are hidden.
>
> **Extend: add a kind of part** (a fourth placement system). This is a big change:
> - a class implementing `PlacedPart`;
> - a `kind` in its union;
> - an array in the project file (section 8: new version + upgrade);
> - its geometry in `src/parts/part-geometry.ts`, used by `pin-positions.ts` so the nets see it;
> - an artist in `src/board-render/artists/` (section 10);
> - a catalog source in `catalog.ts`;
> - support in the 3D viewer and the MCP server.

## 6. Board types

A board is a **perfboard** (a separate pad per hole) or a **stripboard** (copper strips along every
row or column, cut at chosen holes).

- `BoardState.setup` holds the type and strip direction. Change it through `setBoardSetup()`
  (`src/features/board-type.ts`), which also owns the sidebar switch and shows the Cut tool only
  on a stripboard.
- Strip cuts live on the dots (`IDot.cut`). So they survive a resize, and stay (hidden) while the
  board is a perfboard.
- How each type is drawn is its *look* in `src/board-render/board-looks/` (section 10).
- Strip and cut sizes are in `src/project-file/stripboard-geometry.ts`, shared with the 3D viewer.

> **Extend: add a board type.**
> 1. A `BoardType` and its `Saved…` board in `src/project-file/project-file.ts`, with reader support.
> 2. A look in `src/board-render/board-looks/`, registered in `board-looks/index.ts`.
> 3. How it connects holes in `src/project-file/nets.ts`.
> 4. Its option in `board-type.ts`, and in the 3D viewer's `build-board.ts`.

## 7. Undo and redo

Every undoable mutation calls `HistoryState.record(change)` with an `IChange`
(`src/interfaces/change.interface.ts`):

- `add`/`remove`/`merge` of a line;
- `add`/`remove`/`move` of a part;
- `set` of a strip cut or of the board setup.

`undo()`/`redo()` in `src/features/project/undo-redo.ts` replay them through `applyChange()` and
redraw. History is cleared whenever the board is replaced (load, reset, resize) via
`resetForNewBoard()`.

> **Extend: a new undoable change.** Add its variant to `IChange`, handle it both ways in
> `applyChange()`, and call `HistoryState.record` where the change happens.

## 8. Project file and persistence

**The format** lives in `src/project-file/`, pure code shared by the editor, the 3D viewer and the
MCP server.

- `project-file.ts` defines version 3, with every field documented there. It holds grid
  `[col, row]` positions, the board type with a stripboard's strips and cuts, only marked pads,
  per-kind part arrays with refs, and the user's custom ICs. It's written to be read by people and
  programs: facts only, nothing derivable (no nets, strip segments or resolved pin positions).
- `read-project-file.ts` reads any version into that shape (v2: no board type or refs; no
  `version` field means v1, with pixel coordinates, every hole, the whole IC catalog). It throws
  `ProjectFileError` for non-projects before the board is touched. Bad entries are skipped and
  counted, and parts without a usable ref get numbered.
- `save-project.ts`'s `getSaveJson()` snapshots the editor into the current version (each part's
  `serialize()`). `load-project.ts`'s `loadProject(raw)` reads a file and rebuilds the board,
  pinning wires and parts to shared dot objects.

**Projects in the browser:**

- `project-store.ts` is the `localStorage` layout: two keys per project, its file and
  `{name, updatedAt}`, so tabs on different projects never write the same key.
- `current-project.ts` tracks the open one (`ProjectState.current`), opens, creates, imports and
  deletes projects, and autosaves shortly after any redraw that changed the board, and when the
  tab is hidden.
- `projects-modal.ts` is the UI: File menu, header name, and the Projects dialog with thumbnails
  (`project-thumbnail.ts`, section 10).

**Share links** carry a whole project in the editor URL's fragment: `#name=…&z=…`, or
`json=`/`src=` for links written by people and programs. A **short link**, `#name=…&p=<id>`,
names a copy stored on Perfboard Designer's project storage instead.

- The format is `src/project-file/share-link.ts`, documented for outside writers in
  `docs/share-links.md`. Keep the two in step.
- `share-project.ts` is the Share dialog. It always makes the full link, and on request a short
  one. It also opens an incoming link as a new stored project, then clears the fragment.
- `project-storage.ts` talks to the project storage (`STORED_PROJECTS_URL`,
  `https://projects.perfboarddesigner.com`): `storeProject()` for the dialog, `fetchStoredProject()`
  for `p=` links, fetched without asking since it's the site's own. The storage is the MCP server's
  Worker (section 12), but the editor knows only its HTTP API, documented in `docs/share-links.md`,
  and imports nothing from `mcp/`. `PERFBOARD_PROJECTS_URL`, set when the editor is built or run,
  points it at another copy (`vite.config.ts` passes it in as `__PERFBOARD_PROJECTS_URL__`), e.g.
  a local Worker: `PERFBOARD_PROJECTS_URL=http://localhost:8787 npm run start`. `off` builds an
  editor without short links: the dialog hides them, and a `p=` link says to ask for the full one.

> **Rule: the project works without short links and without the Worker.** They're extras: the
> editor contacts the storage only when a user makes or opens a short link, and the full link is
> always offered beside a short one. The MCP server's stdio copy likewise only points at the
> Worker for `image` and `store`, each of which can be turned off (section 12). Don't build a
> feature that needs them.

> **Extend: change the format.** Bump `PROJECT_FILE_VERSION`, document the new fields in
> `project-file.ts`, and add an upgrade path in the reader. **Old files must keep opening.**
> `examples/*.json` (mostly v1) are the compatibility fixtures; the two `*-555-blinker.json` are v3
> and are the MCP server's examples.

## 9. Connectivity: nets and wire crossings

**Nets** (`src/project-file/nets.ts`): `computeNets(project)` works out which pins the board
connects, from a project file and nothing else. So the editor and any program reading the file
always agree.

- A wire joins only its two end holes, and everything in one hole is joined.
- On a stripboard, a strip joins its holes up to the next cut, and a cut hole joins nothing.
- Nets are derived and never saved.
- The editor shows them live in the Nets panel (`src/features/nets-panel.ts`). Clicking a net
  lights it up on the board (`NetHighlightState`, drawn by the renderer).

**Wire crossings** (`src/project-file/wire-crossings.ts`): wires are insulated jumpers. Where one
runs across another wire, or over a hole holding a pin, a lead or another wire's end, it goes
*over* it (the later wire in the list is on top). Where three or more things meet at a hole,
they're joined. `layoutProjectWires(project)` works this out. The 2D renderer draws a dark edge
where a wire goes over something and a solder dot at junctions; the 3D viewer arches the upper wire.

**Rule:** no connectivity or crossing logic anywhere else, the MCP server included. Add what's
missing to these modules without reshaping their output.

## 10. Rendering

Everything that draws the 2D board (the editor's canvas, PNG and SVG export, Projects-dialog
thumbnails, the catalog's chip icons, and the MCP server's pictures) goes through one
renderer: **`src/board-render/`**.

### The idea

```
ProjectFile ─┐
BoardView ───┼─► drawBoard(painter, project, view) ─► Painter ─┬─ CanvasPainter → editor, PNG export, thumbnails
             │        (src/board-render/, pure)               └─ SvgPainter    → SVG export, MCP pictures, catalog icons
editor state ─► getSaveJson() + editorView()                       then: the active tool's preview on top
```

It has three layers, each knowing only the one below it:

1. **Painter** (`painter/painter.ts`): puts shapes on a surface (circle, arc, rect, line,
   polygon, path, text, image, group, stamp). Knows nothing about boards. Every call carries its
   whole style, so nothing leaks from one shape to the next; transforms, opacity and clipping only
   happen inside `group()`.
2. **Renderer** (`draw-board.ts` and below): what a board looks like, drawn from project-file
   entries and part definitions. Knows nothing about the DOM or the editor.
3. **Consumers**: each picks a painter and a view.

Because the renderer's input is the versioned project file, outside code depends on one function
and a small interface, not on how anything is drawn. A part's look can change freely, and every
consumer picks it up.

### Files

```
src/board-render/                  PURE: no DOM, no editor state
  index.ts                         the public API; code outside this folder imports only this
  draw-board.ts                    drawBoard(): the layer order, and boardSizePx()
  board-view.ts                    BoardView, BoardItem, PLAIN_VIEW
  render-svg.ts                    renderBoardSvg(project, options): a standalone SVG document
  palette.ts                       colours and sizes used by more than one file
  painter/painter.ts               the Painter interface and style types
  painter/svg-painter.ts           SvgPainter: writes SVG as a string, runs anywhere
  painter/fonts.ts                 font stacks, CSS font strings, text width estimates for SVG
  board-looks/                     one BoardLook per board type, boardLookFor(type)
  layers/holes.ts                  holes, marked pads, notes, selection/hover/start rings
  layers/wires.ts                  wires, selection glow, over-edges, junction dots
  layers/part-labels.ts            refs and values, kept on the board
  layers/net-highlight.ts          a lit-up net
  artists/part-artist.ts           the PartArtist interface, BoardPart, PartLabel
  artists/index.ts                 ARTISTS registry, boardParts(), drawPart(), iconsUsedBy()
  artists/ic-artist.ts             chips and dev boards: package, pin rings, pin labels
  artists/ic-package/              dip-shape.ts, module-shape.ts: the package drawings (+ catalog icons)
  artists/standard-artist.ts       leads + icon body
  artists/standard-geometry.ts     standardPartSpan(): shared with the hit test
  artists/standard-decorations.ts  resistor bands, ceramic code, LED colour, by definition
  artists/advanced-artist.ts       pin markers, body, icon, pin numbers, tiled header pins
  artists/advanced-geometry.ts     advancedPartGeometry(): src/parts geometry in px, shared with the hit test

src/features/board-canvas/         EDITOR ONLY (browser)
  canvas-painter.ts                CanvasPainter: Path2D, hole sprites, pixel-snapped text
  browser-icons.ts                 loads icons by file name; tells listeners when one arrives
  editor-view.ts                   editorView(): BoardView from the editor's state
src/features/draw-canvas.ts        redrawCanvas() = drawBoard + the tool's preview + listeners
```

### Layer order

`drawBoard` is the one place that knows what goes on top of what:

1. the bare board (its look: fill, a stripboard's strips and cuts)
2. `under-board` parts: chips lie flat, under the holes
3. holes, except those under a chip's body; marked pads, rings, notes
4. wires, with dark edges where they go over something
5. `over-wires` parts: every other part
6. junction dots
7. part labels (when `view.partLabels`)
8. part overlays: a chip's pin rings and pin labels
9. the lit-up net (`view.highlight`)

The editor then draws the active tool's preview on top (`ToolBehavior.drawPreview`).

### BoardView: showing more than the file

`BoardView` (`board-view.ts`) holds what to mark beyond the file:

- `partLabels`
- `selected` and `hovered`: `BoardItem`s, i.e. a part by `ref`, a wire by index, a hole by `[col, row]`
- `startHole`: a placement's first click
- `highlight`: a net

`PLAIN_VIEW` (`{}`) is the plain board. The editor builds its view in
`src/features/board-canvas/editor-view.ts` from `SelectionState`, `DotState`/`LineState` hover,
`ToolState.pendingStart`, `NetHighlightState` and `ViewState`.

### The editor's side

`redrawCanvas()` clears the canvas and calls
`drawBoard(painter, getSaveJson(), editorView())`, so the editor draws exactly what it would
save. A drag moves the part through `setAnchorDots`, so the snapshot already shows it mid-drag.
One `CanvasPainter` is kept for the page, so its hole sprites survive between redraws.

Placed parts don't draw themselves, but they still hit-test. They use the same geometry as the
drawing, so clicking and drawing agree:

- `PlacedStandardComponent.containsPoint` uses `standardPartSpan()`;
- `PlacedAdvancedComponent`'s pins, covered holes and body box come from `advancedPartGeometry()`;
- `Ic.containsPoint` uses the package extents (`DIP_OVERHANG`, `MODULE_EDGE`, `MODULE_END`).

### Icons

Part artwork is SVG files in `assets/icons/components/`, named by `getIconFile(def)` (the
definition's `iconFile`, else `<id>.svg`). Painters ask for icons by file name:

- **`CanvasPainter`** uses `browser-icons.ts`. The first ask starts the load and returns nothing,
  so the part draws its stand-in box; when the icon arrives, `redrawCanvas` runs again.
  One-off drawings (export, thumbnails) `await browserIcons.ready(iconsUsedBy(project))` first.
- **`SvgPainter`** takes an `icons(file) => svgText` function and embeds each icon once.
  SVG export fetches the icons from the site; the MCP server has them baked in at build time.

### Outputs

| Output | Where | Painter | View |
| --- | --- | --- | --- |
| Editor board | `src/features/draw-canvas.ts` | `CanvasPainter` on the page canvas | `editorView()` |
| PNG export | `src/features/project/save-image.ts` (`downloadAsImage`) | `CanvasPainter` on an offscreen canvas at 2× | labels as shown |
| SVG export | `save-image.ts` (`downloadAsSvg`) | `renderBoardSvg` with fetched icons | labels as shown |
| Thumbnails | `src/features/project/project-thumbnail.ts` | `CanvasPainter`, scaled to fit | `PLAIN_VIEW` |
| Catalog chip icons | `dipIconSvg()` / `moduleIconSvg()` in `artists/ic-package/` | `SvgPainter` | n/a |
| MCP pictures | `mcp/src/board-image.ts`, Worker `GET /render.svg` | `renderBoardSvg`, icons baked in | labels on |
| MCP PNGs | `mcp/src/board-png.ts`, `render_board` with `format: "png"` and Worker `GET /render.png` | that SVG, rasterized by resvg (WebAssembly) with fonts baked in | labels on |

### Rules

- `src/board-render/` is pure. It may import only `src/project-file/` and `src/parts/`
  (section 2). Anything needing a browser (`Path2D`, `document`, `Image`) belongs in
  `src/features/board-canvas/`. ESLint enforces both.
- Code outside the folder imports from `src/board-render/index.ts` only (the MCP server through
  `mcp/src/editor.ts`).
- Colours from a project file are free text. `SvgPainter` lets only plain colour syntax through
  (no markup, no `url()`), because the Worker serves its SVGs as they are.
- Canvas and SVG differ in a few known ways:
  - SVG text widths are estimates (`fonts.ts`), and an SVG uses its viewer's fonts.
  - Group opacity applies per shape on a canvas, but to the whole group in SVG. Only tool
    previews use it.

### Extending

> **A part's look.** Edit its artist (`artists/*-artist.ts`) or its package drawing. Every output
> follows.
>
> **Special art for one standard part** (like resistor bands). Write a `Decoration` in
> `artists/standard-decorations.ts` and add it to `DECORATIONS` under the definition's id:
> ```ts
> // e.g. print an inductor's value on its body
> const inductance: Decoration = (painter, part, bodyStart, bodySize) => {
>   if (part.value) painter.text(part.value, bodyStart + bodySize / 2, 0, {font: {family: "sans", size: 12}, color: "#111", align: "center", baseline: "middle"});
> };
> const DECORATIONS = {..., "inductor": inductance};
> ```
> Decorations draw in the part's own frame: rotated along the span, the icon's square from
> `bodyStart`.
>
> **A new kind of part.** Write a `PartArtist<YourSavedEntry>`:
> - `layer` (`"under-board"` or `"over-wires"`);
> - `draw`;
> - optional `drawOverlay` (over everything) and `label` (beside the part, or on its body).
>
> Then add its `BoardPart` variant in `part-artist.ts`, a line in `ARTISTS` and in `boardParts()`
> (`artists/index.ts`), and its icons in `iconsUsedBy()`.
>
> **A board type.** A `BoardLook` (`paintBoard` for the board and shared copper, a `hole` stamp)
> in `board-looks/`, registered in `board-looks/index.ts`.
>
> **A new output.** Implement `Painter` for the surface (e.g. a PDF painter), then call
> `drawBoard(yourPainter, project, view)`. `SvgPainter` is the simplest example to copy. If it runs
> outside the browser, keep it in `src/board-render/painter/`; if it needs the DOM, put it next to
> `canvas-painter.ts`.
>
> **A new thing to show** (say, highlighting one part's pins). Add a field to `BoardView`, draw it
> in the right layer (or a new layer in `drawBoard`), and fill it in `editorView()` if the editor
> should show it.

## 11. 3D viewer

`src/viewer-3d/` is a read-only three.js view, kept separate from the editor on purpose.

- It only consumes project-file JSON: read by the shared reader, laid out in pixels by its own
  `project-data.ts`, then built in mm (50 px grid = 2.54 mm pitch).
- It never imports editor state, only the pure layers: the reader, wire crossings, and from
  `src/parts/` the definitions, value parsing, colour codes and part geometry (chip pins and the
  solder joints of fixed-pin parts come from `part-geometry.ts`, like everywhere else).
- The editor side is `src/features/open-3d-view.ts`, which snapshots `getSaveJson()` and
  lazy-imports the viewer, so three.js stays out of the main bundle.
- Models for fixed-pin parts are builders in `src/viewer-3d/parts/`, picked by definition id in
  `build-catalog-parts.ts`.

## 12. MCP server

`mcp/` is a separate npm package (`perfboard-designer-mcp`, Node 22+) that lets AI agents design
boards. It runs two ways:

- `src/server.ts`: stdio, local;
- `src/worker.ts`: a Cloudflare Worker with stateless Streamable HTTP at `/mcp`
  (`wrangler.toml`; `npm run worker:dev` / `worker:deploy`), plus `GET /render.svg` and
  `/render.png`, and stored projects: `POST /projects`, `GET /<id>.json`, `.png` and `.svg`,
  served at `projects.perfboarddesigner.com`. Each data center keeps a copy of every picture and
  stored file it serves (the Workers Cache API, `edgeCached()`), so repeats aren't drawn again.

The stdio server works without the Worker. It points at it only for two extras, set in its
environment: `PERFBOARD_IMAGE_URL` (`make_share_link`'s `image`) and `PERFBOARD_PROJECTS_URL`
(`store`), each the public one unless set, `off` for none. `createServer()` takes both as optional,
and `make_share_link` offers agents only the ones there are.

Tool code must not use Node APIs, because it also runs on the Worker. **It depends on the editor,
never the other way round**, and only `mcp/src/editor.ts` imports the editor's source, so that
dependency is listed in one place.

| File | Role |
| --- | --- |
| `create-server.ts` | wires tools and resources together for either entry point |
| `tools/catalog-tools.ts` | `list_parts`, `get_part` |
| `tools/project-tools.ts` | `new_project`, `edit_project`, `get_project` |
| `tools/board-tools.ts` | `validate_project`, `get_nets`, `get_pin_positions`, `render_board` (text or PNG) |
| `tools/share-link-tools.ts` | `make_share_link` (link + `image` URL, optionally stored too), `read_share_link` |
| `board-image.ts` | SVG pictures via the board renderer |
| `board-png.ts` | PNG pictures: that SVG rasterized by resvg-wasm, which each entry point hands over (`setResvgWasm`) |
| `image-requests.ts` | the Worker's `GET /render.svg` and `/render.png`, a board from a share link's parameters |
| `project-handles.ts` | projects kept under a `projectId` (memory on stdio, a Durable Object each on the Worker) |
| `stored-projects.ts` | stored projects: a frozen copy under a short id from a name, a hash added when it's taken; `ProjectStorage` is a Durable Object each on the Worker (`StoredProjectHolder`, deleted after a year unopened), the hosted server's HTTP API on stdio |
| `project-requests.ts` | the Worker's `POST /projects` and `GET /<id>.json`, `.png`, `.svg` |
| `edit-ops.ts`, `edit-project.ts` | `edit_project`'s ops: all or none, one function per op |
| `validate.ts`, `expected-nets.ts` | checks, one function per check; `expectNets` |
| `render-board.ts`, `nets-report.ts` | text drawing of a board; nets as agents name pins |
| `guide.ts` | `INSTRUCTIONS` (keep under ~2 KB) and the full guide; keep the two in step |
| `resources.ts`, `examples.ts` | served documents and example projects |

`build.mjs` bundles the server, the editor's pure code and the SDK into `dist/server.js` and
`dist/worker.js`. It also bakes in the docs, the example projects and the part icons, the icons
with their `<metadata>` stripped, and the fonts in `mcp/fonts/` that PNG pictures draw text with
(Noto, cut down to the characters boards use). It copies resvg's WebAssembly to
`dist/resvg.wasm`: the stdio server reads it the first time it draws a PNG, and the Worker is
uploaded with it as a compiled module (Workers can't compile WebAssembly at run time).

> **Extend: add a tool.** Register it in the right `tools/*.ts` group with a zod input schema and
> a description written for agents. Take `projectId`/`project` through `project-source.ts`, and
> format replies with `reply.ts`. Facts about parts belong in the definitions, not in `mcp/`.
>
> **Extend: add a validation check.** A function in `validate.ts` taking the `Board`, called from
> `validateProject`; describe it in `validate_project`'s description and the guide.
>
> **Extend: add an example.** A v3 file in `examples/`, its id in `build.mjs`'s `EXAMPLES` and
> in `src/examples.ts`. Keep it valid with its `expectNets`.

Check server changes with a throwaway script outside the repo that drives the built
`dist/server.js`. `.mcp.json` runs that file as the `perfboard` server, so rebuild after a change.

## 13. Conventions

- **Shortcuts** go through `ShortcutRegistry.add({key, ctrl?, event, description})`
  (`src/features/shortcut-keys.ts`), which also renders the on-page legend. No ad hoc `keydown`
  listeners.
- **Canvas coordinates:** map mouse events with `Canvas.toDrawingCoordinates(e)`, never raw
  `clientX`/`clientY`. It accounts for the canvas's CSS scaling.
- **DOM:** grab required elements with `Utils.getSafeHtmlElement<T>(id)`.
- **Comments** say why, in plain sentences, at the top of a module and above anything non-obvious.
  Match the density of the code around you.
- **Layers:** `npm run lint` enforces the layer rules (section 2). If it stops an import, the fix
  is to move the code to the right layer, not to silence the rule.
- **Checks before a change is done:**
  - editor: `npx tsc --noEmit` and `npm run lint`;
  - server: `cd mcp && npm run typecheck && npm run build`.
- **Testing:** there's no test suite, and none should be added. Check changes by hand in the
  browser (`npm run start`, `/app/`), e.g. by opening `examples/*.json` through File › Import.
