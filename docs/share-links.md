# Share links

A share link opens a board in Perfboard Designer for whoever clicks it. The whole project travels
inside the link itself, so there's no account, no upload and no server. In the editor, use
**🔗 Share** (or **File → Share Link...**) to make one. The same dialog can also make a **short
link** to a copy of the board stored on Perfboard Designer's server (`p`, below).

This page is the link format, written so that people and programs can make links too, including
AI agents that design a board and hand the user a link to open it. The code is
[`src/project-file/share-link.ts`](../src/project-file/share-link.ts). An agent that can use MCP
can skip most of this page: the [MCP server](../mcp/README.md) looks up parts, checks the project
and makes the link for it.

## What happens when a link is opened

- The project is added to the receiver's projects (kept in their browser) as a **new project**,
  and opened. Whatever they had open stays as it was. The link is a snapshot: later changes by the
  sender aren't in it.
- It's named after the link's `name`, or "Shared project". If a project with that name exists,
  the new one is numbered: "LED demo 2".
- The link is then removed from the address bar, so reloading doesn't add the project again.
- The project is checked like an imported file. Entries that can't be read are left out, and the
  user is told how many. A link that can't be read at all leaves everything untouched and says why.

## Format

```
https://perfboarddesigner.com/app/#<fragment>
```

The project goes in the URL **fragment** (after `#`), which browsers never send to a server. The
fragment holds `key=value` parameters joined with `&`, like a query string:

| Parameter | Value |
| --- | --- |
| `name` | Optional. The project's name, percent-encoded. |
| `z` | The project file, compressed (see below). This is what the editor makes. |
| `json` | The project file as plain JSON, percent-encoded. Must be the **last** parameter. |
| `src` | The `https://` address of a project file hosted somewhere else, percent-encoded. |
| `p` | The id of a project stored on Perfboard Designer's server: a short link. |

Use exactly one of `z`, `json`, `src` and `p`. If several are present, `json` wins, then `z`, then
`src`, then `p`.

### `z`: compressed (shortest)

1. Write the project file as JSON (minified is best).
2. Compress its UTF-8 bytes with **raw DEFLATE** (no zlib or gzip header).
3. Encode the result as **base64url** (`-` and `_` instead of `+` and `/`) with no `=` padding.

The reader is forgiving about what programs commonly produce instead. It also accepts zlib- or
gzip-wrapped data, plain base64 with `+`, `/` and `=` padding, and line breaks in the base64 text.

Python:

```python
import base64, json, urllib.parse, zlib

def share_link(project: dict, name: str = "") -> str:
    data = json.dumps(project, separators=(",", ":")).encode("utf-8")
    deflate = zlib.compressobj(9, zlib.DEFLATED, -15)  # -15: raw DEFLATE, no header
    z = base64.urlsafe_b64encode(deflate.compress(data) + deflate.flush()).rstrip(b"=").decode()
    name_param = f"name={urllib.parse.quote(name, safe='')}&" if name else ""
    return f"https://perfboarddesigner.com/app/#{name_param}z={z}"
```

Node.js:

```js
const zlib = require("zlib");

function shareLink(project, name = "") {
  const z = zlib.deflateRawSync(Buffer.from(JSON.stringify(project))).toString("base64url");
  const nameParam = name ? `name=${encodeURIComponent(name)}&` : "";
  return `https://perfboarddesigner.com/app/#${nameParam}z=${z}`;
}
```

### `json`: plain JSON (no tools needed)

```
https://perfboarddesigner.com/app/#name=LED%20demo&json=<percent-encoded project file JSON>
```

This is for writers that can't compress, such as a language model writing the link directly.
These links are 3 to 7 times longer than `z` links. Rules:

- `json` must be the **last parameter**: everything after `json=` is the project.
- Percent-encode the JSON, as `encodeURIComponent` or Python's
  `urllib.parse.quote(text, safe="")` do. Encode at least spaces (`%20`), `#` (`%23`, which
  starts every color), `%` (`%25`) and `+` (`%2B`). A `+` is kept as a plus sign, never read as
  a space. Unencoded links may survive in a browser's address bar but are often broken by the chat
  apps and editors that turn text into links.
- The reader tolerates a stray `%` that doesn't start an escape, such as a note saying `50%`.

### `src`: a file hosted elsewhere

```
https://perfboarddesigner.com/app/#src=https%3A%2F%2Fexample.com%2Fmy-board.json
```

- The address must be `http://` or `https://`, and the site must allow other websites to read
  the file (CORS). Raw GitHub Gist and raw GitHub file addresses
  (`gist.githubusercontent.com`, `raw.githubusercontent.com`) do. A gist's normal page does not.
- The user is asked before anything is downloaded, since fetching the file shows that site the
  visit.
- Without a `name`, the project is named after the file (`my-board.json` → "my-board").
- There's no size limit to worry about here, so this suits large boards and programs that can
  publish files.

### `p`: a stored project (short link)

```
https://perfboarddesigner.com/app/#name=LED%20blinker&p=led-blinker
```

- The project is stored on Perfboard Designer's own server, `https://projects.perfboarddesigner.com`
  (below), and the link names it by its id. It's fetched without asking, since it's the site's own.
- Without a `name`, the project is named after its id.
- A stored project never changes, and it's deleted after a year unopened. Anyone with the link
  can open it. Unlike the other forms, it needs the server: the Share dialog offers the full link
  beside it, which works without one.

### Stored projects

`https://projects.perfboarddesigner.com` keeps projects for short links. Anyone can store one:

| Request | Answer |
| --- | --- |
| `POST /projects` with `{"project": {…}, "id": "led-blinker", "name": "LED blinker"}` (`id` and `name` optional) | `{id, link, file, image, png}`: the id it got, a short link, the file's address and its pictures' |
| `GET /<id>.json` | the project file |
| `GET /<id>.png`, `GET /<id>.svg` | pictures of the board |

- **Ids** are lowercase letters, digits and dashes, at most 40 characters, made from the wanted
  `id` or else the `name` (`"Mágneses kapcsoló!"` → `magneses-kapcsolo`). If another board has
  that id, a few characters of the board's SHA-256 are added (`led-blinker-08196a`); storing the
  same board under the same id again gives the same id back. With neither, the id is the hash.
- Only valid project files are stored, as the editor reads them, up to 1 MB.
- Every site may call it (CORS). There's no sign-in.
- It's the [MCP server's](../mcp/README.md) Cloudflare Worker, which agents store through too.

### Limits

- The project file may be at most 5 MB once unpacked, and a board at most 500 holes on a side.
- Links longer than about 8,000 characters may be cut off by some chat apps and mail clients; the
  Share dialog warns about these. For scale, the boards in [`examples/`](../examples) make `z`
  links of 0.8k to 2.7k characters.

## The project file

A share link carries the same project file as **File → Save Project to File**. Every version
opens, but write the current one, version 3. It's documented field by field in
[`src/project-file/project-file.ts`](../src/project-file/project-file.ts). In short:

- Positions are `[column, row]` grid holes counted from the **top-left hole**, both starting at 0.
  Neighbouring holes are 2.54 mm (0.1 in) apart.
- `board`: `{"type": "perfboard", "cols": 12, "rows": 8}`, or a stripboard with
  `"strips": "horizontal" | "vertical"` and `"cuts": [[col, row], ...]`.
- `pads`: holes marked with a `color` and/or a `note` (like `+9V` or `GND`). Purely visual: it
  doesn't connect anything.
- `wires`: `{"from": [c, r], "to": [c, r]}`, with optional `color` (`"#rrggbb"`) and `width`.
- `placedStandardComponents`: two-lead parts placed between two holes: `definitionId`, `from`,
  `to`, optional `value` (`"10k"`, `"100n"`) and `color` (LEDs). On polarized parts, `from` is
  an LED's cathode, a diode's anode and an electrolytic capacitor's − lead (`leadLabels` in the
  definitions).
- `placedAdvancedComponents`: fixed-footprint parts: `definitionId`, the anchor pin `at`,
  `rotation` (0, 90, 180 or 270), `rows` and `cols` (1 except for sizable parts such as header
  pins), optional `value`.
- `placedIcs`: DIP chips and dual-row modules: `name`, `at` (top-left pin), `widthPin` (columns
  including both pin rows, 4 for a 0.3" DIP), `heightPin` (pins per side), `rotation`, and
  `pinDescription` (`{"1": "GND", "2": "TRIG", ...}`, numbered counter-clockwise from pin 1).
- `customIcs`: user-made catalog entries. `[]` is fine.
- Every part should have a unique `ref` (R1, C2, U1...). Missing or duplicate refs are numbered
  automatically.

The reader is forgiving: empty lists can be left out, a file without `version` that has a `board`
is read as version 3, and entries it can't read are skipped (and counted) instead of failing the
whole project.

The `definitionId`s, with each part's pins, are in
[`component-definitions.ts`](../src/parts/component-definitions.ts)
(two-lead parts such as `resistor`, `ceramic-capacitor`, `electrolytic-capacitor`, `led` and
`diode`) and
[`advanced-component-definitions.ts`](../src/parts/advanced-component-definitions.ts)
(fixed-footprint parts such as `transistor`, `potentiometer` and `header-pins`). Built-in chips are
in [`ic-definitions.ts`](../src/parts/ic-definitions.ts), and footprints are described in
[component-footprints.md](component-footprints.md). Check ids against these files: a part with an
unknown `definitionId` isn't skipped, it stays on the board as an unrecognised part with an `X` ref.

## Example

A 9 V LED circuit on a 12 × 8 perfboard:

```json
{
  "version": 3,
  "board": {"type": "perfboard", "cols": 12, "rows": 8},
  "pads": [{"at": [1, 1], "color": "#ef4444", "note": "+9V"}, {"at": [1, 6], "note": "GND"}],
  "wires": [
    {"from": [1, 1], "to": [3, 1], "color": "#ef4444"},
    {"from": [8, 4], "to": [8, 6]},
    {"from": [8, 6], "to": [1, 6]}
  ],
  "placedIcs": [],
  "placedStandardComponents": [
    {"ref": "R1", "definitionId": "resistor", "from": [3, 1], "to": [8, 1], "value": "470"},
    {"ref": "D1", "definitionId": "led", "from": [8, 2], "to": [8, 4], "color": "#22c55e"}
  ],
  "placedAdvancedComponents": [
    {"ref": "J1", "definitionId": "header-pins", "at": [0, 1], "rotation": 0, "rows": 6, "cols": 1}
  ],
  "customIcs": []
}
```

As a `json` link (the start of it):

```
https://perfboarddesigner.com/app/#name=LED%20demo&json=%7B%22version%22%3A3%2C%22board%22%3A%7B%22type%22%3A%22perfboard%22%2C...
```
