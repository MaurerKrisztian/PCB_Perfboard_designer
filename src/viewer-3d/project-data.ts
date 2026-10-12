// The 3D viewer's own, read-only view of a saved project file. It is deliberately decoupled
// from the editor's state classes: everything here is parsed straight from the JSON shape that
// save-project.ts writes (IProjectSave), so the viewer can render any project file on its own.

export type Rotation = 0 | 90 | 180 | 270;

export interface ViewerDot {
  x: number;
  y: number;
  color?: string;
}

export interface ViewerWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface ViewerIc {
  name: string;
  widthPin: number;
  heightPin: number;
  rotationAngle: Rotation;
  pinDescription: Record<number, string>;
  left: number;
  top: number;
}

export interface ViewerStandardPart {
  definitionId: string;
  value?: string;
  color?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface ViewerAdvancedPart {
  definitionId: string;
  value?: string;
  rotationAngle: Rotation;
  anchorX: number;
  anchorY: number;
  rows: number;
  cols: number;
}

export interface ViewerProject {
  canvasWidth: number;
  canvasHeight: number;
  dots: ViewerDot[];
  wires: ViewerWire[];
  ics: ViewerIc[];
  standardParts: ViewerStandardPart[];
  advancedParts: ViewerAdvancedPart[];
}

const DEFAULT_WIRE_COLOR = "#777676";
const DEFAULT_WIRE_WIDTH = 4;
const DOT_SPACE = 50;

function num(value: unknown): number | undefined {
  const n = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(n) ? n : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function rotation(value: unknown): Rotation {
  const n = Number(value);
  return n === 90 || n === 180 || n === 270 ? n : 0;
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];
}

// Reads each entry of a saved array, dropping the ones read() rejects (returns undefined for).
function collect<T>(value: unknown, read: (item: Record<string, unknown>) => T | undefined): T[] {
  const result: T[] = [];
  for (const item of list(value)) {
    const parsed = read(item);
    if (parsed) result.push(parsed);
  }
  return result;
}

/** Parses a project file (already JSON-decoded) into the viewer's model. Throws on files that
 *  aren't perfboard projects at all; individual malformed entries are skipped instead. */
export function readProject(raw: unknown): ViewerProject {
  if (!raw || typeof raw !== "object") throw new Error("Not a project file.");
  const data = raw as Record<string, unknown>;
  const canvas = (data.canvas ?? {}) as Record<string, unknown>;
  const canvasWidth = num(canvas.width);
  const canvasHeight = num(canvas.height);
  if (!canvasWidth || !canvasHeight || canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error("Not a project file: missing board size.");
  }

  let dots: ViewerDot[] = collect(data.dots, dot => {
    const x = num(dot.x);
    const y = num(dot.y);
    return x === undefined || y === undefined ? undefined : {x, y, color: str(dot.color)};
  });
  if (dots.length === 0) {
    // Same layout createDotGrid uses: one hole per 50px cell, centered in the cell.
    dots = [];
    for (let x = DOT_SPACE / 2; x < canvasWidth; x += DOT_SPACE) {
      for (let y = DOT_SPACE / 2; y < canvasHeight; y += DOT_SPACE) dots.push({x, y});
    }
  }

  const wires: ViewerWire[] = collect(data.lines, line => {
    const start = (line.start ?? {}) as Record<string, unknown>;
    const end = (line.end ?? {}) as Record<string, unknown>;
    const x1 = num(start.x), y1 = num(start.y), x2 = num(end.x), y2 = num(end.y);
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return undefined;
    return {x1, y1, x2, y2, color: str(line.color) ?? DEFAULT_WIRE_COLOR, width: num(line.width) ?? DEFAULT_WIRE_WIDTH};
  });

  const ics: ViewerIc[] = collect(data.placedIcs, ic => {
    const widthPin = num(ic.widthPin), heightPin = num(ic.heightPin);
    const left = num(ic.topLeftDotX), top = num(ic.topLeftDotY);
    if (!widthPin || !heightPin || left === undefined || top === undefined) return undefined;
    const pinDescription: Record<number, string> = {};
    const rawPins = (ic.pinDescription ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(rawPins)) {
      const label = str(rawPins[key]);
      if (label) pinDescription[Number(key)] = label;
    }
    return {
      name: str(ic.name) ?? "IC",
      widthPin: Math.max(2, Math.round(widthPin)),
      heightPin: Math.max(1, Math.round(heightPin)),
      rotationAngle: rotation(ic.rotationAngle),
      pinDescription, left, top,
    };
  });

  const standardParts: ViewerStandardPart[] = collect(data.placedStandardComponents, part => {
    const startX = num(part.startDotX), startY = num(part.startDotY);
    const endX = num(part.endDotX), endY = num(part.endDotY);
    const definitionId = str(part.definitionId);
    if (!definitionId || startX === undefined || startY === undefined || endX === undefined || endY === undefined) return undefined;
    return {definitionId, value: str(part.value), color: str(part.color), startX, startY, endX, endY};
  });

  const advancedParts: ViewerAdvancedPart[] = collect(data.placedAdvancedComponents, part => {
    const anchorX = num(part.anchorDotX), anchorY = num(part.anchorDotY);
    const definitionId = str(part.definitionId);
    if (!definitionId || anchorX === undefined || anchorY === undefined) return undefined;
    return {
      definitionId, value: str(part.value), rotationAngle: rotation(part.rotationAngle), anchorX, anchorY,
      rows: Math.max(1, Math.round(num(part.rows) ?? 1)),
      cols: Math.max(1, Math.round(num(part.cols) ?? 1)),
    };
  });

  return {canvasWidth, canvasHeight, dots, wires, ics, standardParts, advancedParts};
}
