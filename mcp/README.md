# Perfboard Designer MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an AI agent (Claude, or any MCP
client) design perfboard and stripboard layouts for
[Perfboard Designer](https://perfboarddesigner.com). The agent looks up parts, writes the board
as a project file, checks it, and gives you a **share link**. Clicking the link opens the board in
the editor, where you can look at it and change it.

> "Lay out a 555 LED blinker on a small perfboard and send me the link."

It runs on your computer (stdio), needs no account and saves nothing to disk; or it can be hosted
on Cloudflare Workers ([below](#hosting-it-on-cloudflare-workers)). While it runs it keeps the projects an agent is working on in memory, each under a `projectId`, so the agent sends
a project at most once and then changes it with small edits. The project file stays the source of
truth: `get_project` returns it, and every tool also takes a whole file instead of an id.

## Setup

Node.js 22 or newer. Build it from this repo:

```bash
cd mcp
npm install
npm run build
```

Then add it to your MCP client, using the absolute path to `dist/server.js`.

**Claude Code:**

```bash
claude mcp add perfboard -- node /path/to/perfboard-designer/mcp/dist/server.js
```

**Claude Desktop** (`claude_desktop_config.json`) and other clients that take a command:

```json
{
  "mcpServers": {
    "perfboard": {
      "command": "node",
      "args": ["/path/to/perfboard-designer/mcp/dist/server.js"]
    }
  }
}
```

Links open the public editor, https://perfboarddesigner.com/app/. To point them at another copy (a
local dev server, say), set `PERFBOARD_EDITOR_URL` in the server's environment:

```json
{
  "mcpServers": {
    "perfboard": {
      "command": "node",
      "args": ["/path/to/perfboard-designer/mcp/dist/server.js"],
      "env": {"PERFBOARD_EDITOR_URL": "http://localhost:3000/app/"}
    }
  }
}
```

Once the package is published to npm, `npx -y perfboard-designer-mcp` replaces
`node /path/.../server.js` in both.

## Tools

| Tool | What it does |
| --- | --- |
| `list_parts` | Lists the parts a project can place (79 today). Without a query, every part by category, one line each (its id, name and pin count). With words such as `"capacitor"` or `"555"`, the parts matching all of them, or the closest ones when none do. |
| `get_part` | Parts in full, as many as you name in `ids`: which list each goes in, its pins and pin labels, polarity, value unit, holes its body covers, and an example entry to copy. |
| `new_project` | Starts a project kept in memory and returns its `projectId`: a blank perfboard or stripboard of the size you give, or a copy of an example (`example: "555-led-blinker"`). |
| `edit_project` | Changes a kept project with a list of ops, all or none: `add_part` (by part id, with `at`, or `from`/`to` for two-lead parts; refs are numbered if left out), `update_part` (move, turn, change value or ref), `remove_parts`, `add_wire` (`from`/`to`, or a `path` of holes made into one wire per leg; any end can be a pin by name, e.g. `"U1.7"` or `"D1.K"`, for the hole it's in), `update_wire` (ends by hole or pin too), `remove_wires`, `set_board`, `add_cuts`/`remove_cuts`, `set_pad`. Returns what changed, where the new or moved parts' pins landed, and the board checked as `validate_project` does; when it has no errors, also its nets. |
| `get_project` | The whole project file of a kept project. |
| `get_pin_positions` | Where every placed part's pins land on the board after rotation, e.g. `U1 pin 8 (VCC) at [9, 3]`, so wires can be routed to the right holes. |
| `render_board` | Draws the board as text, one cell per hole with column and row numbers: pins by part key and number (`a1`), holes under a body, wire ends, holes a wire runs over without joining them, strip cuts and marked holes, then which part each key is and every wire with its net. `area` draws only part of the board (needed above 6000 holes). |
| `get_nets` | Which pins the board connects: each net with its name (e.g. `GND`), its pins (`U1.8 VCC` for a chip pin, `D1.K` or `C1.+` for a polarized lead, `R1.1` otherwise) and its wires, plus pins connected to nothing, junctions (holes where three or more things join) and crossings (where a wire goes over another wire or a hole without joining it). |
| `validate_project` | Lists every problem, with where it is: unreadable entries, unknown parts, pins off the board, two parts' pins or leads in one hole, overlapping parts, wires that connect nothing (a loose end, or no pins on their net), a wire passing over a pin without ending there, IC pins and two-lead parts' leads connected to nothing, supply rails shorted together, and on a stripboard, pins shorted by a strip or in a cut hole. Wires crossing are listed as notes, not problems. Pass `expectNets` (the netlist you meant, e.g. `[["U1.8", "U1.4", "R1.1", "J1.1"], ["U1.2", "U1.6", "C1.+"]]`) and every missing or extra connection is an error; for a kept project it's remembered, so `edit_project` and `make_share_link` check against it too (`[]` forgets it). A whole project sent here is kept, and the reply gives its `projectId`. |
| `make_share_link` | Validates the project (with `expectNets`, given or remembered) and returns the link that opens it, and `image`: the address of an SVG picture of the board, drawn as the editor draws it (served by the hosted Worker, below). It refuses a project with errors unless `allowErrors` is set. `editorUrl` points it at another copy of the editor, e.g. `http://localhost:3000/app/`; it defaults to `PERFBOARD_EDITOR_URL`. |
| `read_share_link` | Reads the project out of a link you share with the agent (`z=`, `json=` or `src=`) and keeps it under a `projectId`, so the agent can change an existing board. |

Every tool that reads a project takes either `projectId` or the whole file as `project`. Kept
projects last as long as the server process (the 200 most recently used); on Cloudflare, 30 days
after they were last used.

Its instructions to agents are kept short (clients cut them off at about 2 KB); the full guide is
the resource `perfboard://docs/guide` (`src/guide.ts`).

It also serves the format as **resources**: `perfboard://docs/project-file` (the project file
format, field by field), `perfboard://docs/share-links` (the link format), `perfboard://parts`
(the whole parts catalog as JSON), and example projects: `perfboard://examples/555-led-blinker` (a
555 LED blinker on a perfboard, all wired with jumpers) and
`perfboard://examples/555-led-blinker-stripboard` (the same circuit on a stripboard), read from
`../examples/`.

## Hosting it on Cloudflare Workers

The public copy runs at `https://mcp.perfboarddesigner.com/mcp`; how to add it to Claude Code,
claude.ai, ChatGPT, Cursor and other clients is on https://perfboarddesigner.com/mcp-server/
(`../mcp-server/index.html`).

The same server also runs as a [Cloudflare Worker](https://developers.cloudflare.com/workers/),
so an MCP client can reach it over the web with nothing installed: Streamable HTTP at `/mcp`
(`src/worker.ts`). It's stateless, every request getting a fresh server, so kept projects can't
live in memory: each is kept in its own Durable Object (`ProjectHolder`), named by its
`projectId`, and forgotten after 30 days unused. Project ids are random, so they can't be guessed.
There's no sign-in: anyone with the address can use it.

It also draws boards: `/render.svg?` followed by a share link's part after the `#` (`name=…&z=…`
or `json=…`; `src=` links aren't fetched) answers with an SVG picture of that board, drawn by the
editor's own board renderer (`../src/board-render/`) with the part icons baked in. Its address
says everything in it, so it's cached for good (`src/board-image.ts`).

Try it locally (at http://localhost:8787/mcp):

```bash
npm run worker:dev
```

Publish it to your Cloudflare account (`npx wrangler login` once first):

```bash
npm run worker:deploy
```

Both build first. `wrangler.toml` is the Worker's config: its name, the Durable Object binding
and, in `[vars]`, `PERFBOARD_EDITOR_URL` for where links open. Then add it to a client by its
address:

```bash
claude mcp add --transport http perfboard https://perfboard-designer-mcp.<your-subdomain>.workers.dev/mcp
```

On the Workers Free plan a request gets 10 ms of CPU time, which checking a big board can run
over; the Paid plan allows far more.

## How things connect

Wires are insulated jumpers: a wire joins only the holes at its two ends. Running over a hole
doesn't connect it, and two wires crossing aren't shorted, so a crossing is fine (the editor marks
it so it doesn't pass for a joint, and the 3D view arches the upper wire). A hole takes one part's
pin or lead at most (a second part there is an error, as on a real board) plus any number of wire
ends, and everything in a hole is joined: to connect two parts, run a wire between their pins.
On a stripboard, every hole along a strip is joined up to the next cut, and a cut hole connects to
nothing. `get_nets` and `validate_project` work this out with the same code as the
editor's Nets panel, so they agree with what you see there.

## How it's built

`src/` is the server: `create-server.ts` puts it together, `server.ts` runs it over stdio and
`worker.ts` on Cloudflare, `tools/` holds the tools by group, `resources.ts`
the documents it serves, `project-handles.ts` the kept projects (and where they're stored), `edit-ops.ts` and
`edit-project.ts` `edit_project`'s ops, `validate.ts` the checks, `guide.ts` its instructions and
guide. It builds on the editor's own pure code, all of it taken through `editor.ts`, the one file
that imports from `../src/`: the project file reader, share-link code, pin positions, nets
(`nets.ts`) and wire crossings (`wire-crossings.ts`) in `../src/project-file/`, the part
definitions and part geometry in `../src/parts/`, and the board renderer (`../src/board-render/`)
for pictures of a board. That way it always agrees with the editor about the format, the parts and what's
connected. The editor never imports anything from here. `npm run build` bundles that code and the MCP SDK into
a single `dist/server.js` (and `dist/worker.js` for Cloudflare) with no runtime dependencies,
and bakes in the docs and examples it serves and the part icons its pictures embed.

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle `dist/server.js` and `dist/worker.js` |
| `npm run typecheck` | Type-check the server and the editor code it imports |
| `npm run worker:dev` | Run the Cloudflare Worker locally, at http://localhost:8787/mcp |
| `npm run worker:deploy` | Publish the Worker to Cloudflare |
| `npm run inspect` | Open the server in the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to try the tools by hand |
