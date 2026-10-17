import {initWasm, Resvg} from "@resvg/resvg-wasm";
import {GRID_PITCH_PX, GridPos, ProjectFile} from "./editor";
import {boardSvg} from "./board-image";

// Pictures of a board as PNG, for agents to look at: an agent reads an SVG as markup, but sees a
// PNG. Drawn from the same SVG as /render.svg (board-image.ts) by resvg, an SVG renderer compiled
// to WebAssembly so it runs on the Worker too, with the fonts build.mjs bakes in (fonts/), since
// it can't use the system's.

// How to get resvg's WebAssembly, which differs by platform: server.ts reads the file next to
// it, worker.ts has the module the Worker was uploaded with. Loaded the first time a picture is
// asked for, so a server that draws none never pays for it.
export type ResvgWasm = () => Promise<WebAssembly.Module | BufferSource>;

let loadWasm: ResvgWasm | undefined;
let ready: Promise<void> | undefined;

export function setResvgWasm(load: ResvgWasm): void {
  loadWasm = load;
}

function resvgReady(): Promise<void> {
  if (!loadWasm) return Promise.reject(new Error("This server can't draw PNG pictures."));
  ready ??= initWasm(loadWasm()).catch(err => {
    ready = undefined;
    throw err;
  });
  return ready;
}

let fonts: Uint8Array[] | undefined;
const fontBuffers = () => (fonts ??= PNG_FONTS.map(base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0))));

// The longest side of a picture: the board at its natural size (50 px per hole) up to this, scaled
// down past it, so a picture costs an agent about a thousand tokens at most.
const MAX_SIDE_PX = 1000;
// The biggest board a picture is drawn of, in holes: the whole board is drawn even for an area of
// it, and drawing grows with it. Callers check it, each with its own way out.
export const MAX_PNG_HOLES = 40000;

export interface BoardPng {
  png: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  // How far apart neighbouring holes are in the picture.
  holePx: number;
  // The corner holes it shows.
  shown: {from: GridPos; to: GridPos};
}

// The board, or only the holes from `area.from` to `area.to` (on the board, either way round).
export async function boardPng(project: ProjectFile, area?: {from: GridPos; to: GridPos}): Promise<BoardPng> {
  await resvgReady();
  const {cols, rows} = project.board;
  const [c0, c1] = area ? span(area.from[0], area.to[0], cols) : [0, cols - 1];
  const [r0, r1] = area ? span(area.from[1], area.to[1], rows) : [0, rows - 1];
  const x = c0 * GRID_PITCH_PX, y = r0 * GRID_PITCH_PX;
  const width = (c1 - c0 + 1) * GRID_PITCH_PX, height = (r1 - r0 + 1) * GRID_PITCH_PX;
  // The whole board's SVG seen through a window onto the area.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">${boardSvg(project)}</svg>`;
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(width, height));
  const resvg = new Resvg(svg, {
    fitTo: {mode: "zoom", value: scale},
    font: {fontBuffers: fontBuffers(), defaultFontFamily: "Noto Sans", sansSerifFamily: "Noto Sans", monospaceFamily: "Noto Sans Mono"},
  });
  try {
    const image = resvg.render();
    try {
      return {
        // asPng copies the picture out of resvg's memory into a buffer of its own.
        png: image.asPng() as Uint8Array<ArrayBuffer>, width: image.width, height: image.height, holePx: GRID_PITCH_PX * scale,
        shown: {from: [c0, r0], to: [c1, r1]},
      };
    } finally {
      image.free();
    }
  } finally {
    resvg.free();
  }
}

// The first and last index from a to b that are on a board `length` long.
const span = (a: number, b: number, length: number) =>
  [Math.max(0, Math.min(a, b)), Math.min(length - 1, Math.max(a, b))];
