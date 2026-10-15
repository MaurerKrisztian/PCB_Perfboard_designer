# Perfboard Designer MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an AI agent (Claude, or any MCP
client) design perfboard and stripboard layouts for
[Perfboard Designer](https://perfboarddesigner.com). The agent looks up parts, writes the board
as a project file, checks it, and gives you a **share link**. Clicking the link opens the board in
the editor, where you can look at it and change it.

> "Lay out a 555 LED blinker on a small perfboard and send me the link."

It runs on your computer (stdio), needs no account and stores nothing. Every tool takes the whole
project, so there's no state between calls.

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

Once the package is published to npm, `npx -y perfboard-designer-mcp` replaces
`node /path/.../server.js` in both.

## Tools

| Tool | What it does |
| --- | --- |
| `list_parts` | Lists the parts a project can place (79 today), filtered by words such as `"capacitor"` or `"555"`. |
| `get_part` | One part in full: which list it goes in, its pins and pin labels, polarity, value unit, holes its body covers, and an example entry to copy. |
| `get_pin_positions` | Where every placed part's pins land on the board after rotation, e.g. `U1 pin 8 (VCC) at [9, 3]`, so wires can be routed to the right holes. |
| `validate_project` | Lists every problem, with where it is: unreadable entries, unknown parts, pins off the board, two things in one hole, overlapping parts, wires that connect nothing, and on a stripboard, pins shorted by a strip or in a cut hole. |
| `make_share_link` | Validates the project and returns the link that opens it. It refuses a project with errors unless `allowErrors` is set. `editorUrl` points it at another copy of the editor, e.g. `http://localhost:3000/app/`. |
| `read_share_link` | Reads the project out of a link you share with the agent (`z=`, `json=` or `src=`), so it can change an existing board. |

It also serves the format as **resources**: `perfboard://docs/project-file` (the project file
format, field by field), `perfboard://docs/share-links` (the link format) and `perfboard://parts`
(the whole parts catalog as JSON).

## How it's built

`src/` is the server. It imports the editor's own pure code directly: the project file reader
and share-link code in `../src/project-file/`, and the part definitions. That way it always
agrees with the editor about the format and the parts. `npm run build` bundles that code and
the MCP SDK into a single `dist/server.js` with no runtime dependencies, and bakes in the docs it
serves.

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle `dist/server.js` |
| `npm run typecheck` | Type-check the server and the editor code it imports |
| `npm run inspect` | Open the server in the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to try the tools by hand |
