import {computeNets, GridPos, holesAlong, layoutProjectWires, Net, partPins, pinName, ProjectFile} from "./editor";
import {holeKey, joinList, showHole} from "./text";

// render_board's text drawing of a board: one cell per hole, so an agent can see where things are,
// which holes are free and where wires run, without working it out from the file. Only draws:
// what's connected comes from the editor's nets code, and is named in the wire list below the grid.

export interface Area {
  from: GridPos;
  to: GridPos;
}

// Short keys for parts in the grid: a-z, A-Z, then two letters.
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const partKey = (i: number) => i < LETTERS.length ? LETTERS[i] : LETTERS[Math.floor(i / LETTERS.length) - 1] + LETTERS[i % LETTERS.length];

// A wire running over a hole, by its direction: across, down, or diagonally.
function runMark([dx, dy]: number[]): string {
  if (dy === 0) return "-";
  if (dx === 0) return "|";
  if (Math.abs(dx) === Math.abs(dy)) return dx * dy > 0 ? "\\" : "/";
  return "~";
}

const KEY_TEXT = [
  ". empty hole", "a1 pin 1 of part a", "# under a part's body", "o wire end", "* 3+ things joined",
  "- | \\ / ~ wire passing over (not joined)", "+ wires passing over each other", "x strip cut", "@ marked hole",
].join(", ");

export function renderBoard(project: ProjectFile, area?: Area): string {
  const {board} = project;
  const left = Math.max(0, Math.min(area?.from[0] ?? 0, area?.to[0] ?? 0));
  const top = Math.max(0, Math.min(area?.from[1] ?? 0, area?.to[1] ?? 0));
  const right = Math.min(board.cols - 1, area ? Math.max(area.from[0], area.to[0]) : board.cols - 1);
  const bottom = Math.min(board.rows - 1, area ? Math.max(area.from[1], area.to[1]) : board.rows - 1);
  const inArea = ([c, r]: readonly number[]) => c >= left && c <= right && r >= top && r <= bottom;

  const parts = partPins(project);
  const netlist = computeNets(project);
  const layout = layoutProjectWires(project);

  // Least to most important: whatever's set last in a hole is drawn.
  const cells = new Map<string, string>();
  const set = (at: readonly number[], text: string) => cells.set(holeKey(at), text);
  for (const pad of project.pads) set(pad.at, "@");
  project.wires.forEach(wire => {
    const mark = runMark([wire.to[0] - wire.from[0], wire.to[1] - wire.from[1]]);
    for (const {at} of holesAlong(wire)) {
      const before = cells.get(holeKey(at));
      set(at, before && before !== "@" && before !== mark ? "+" : mark);
    }
  });
  for (const part of parts) part.coveredHoles.forEach(at => set(at, "#"));
  if (board.type === "stripboard") board.cuts.forEach(at => set(at, "x"));
  for (const wire of project.wires) [wire.from, wire.to].forEach(at => set(at, "o"));
  layout.junctions.forEach(at => set(at, "*"));
  parts.forEach((part, i) => part.pins.forEach(pin => set(pin.at, `${partKey(i)}${pin.pin}`)));

  const width = Math.max(...[...cells.values(), String(right)].map(text => text.length)) + 1;
  const rowLabel = String(bottom).length;
  const lines: string[] = [];
  const header: string[] = [];
  for (let c = left; c <= right; c++) header.push(String(c).padEnd(width));
  lines.push(`${" ".repeat(rowLabel)}  ${header.join("")}`.trimEnd());
  for (let r = top; r <= bottom; r++) {
    const row: string[] = [];
    for (let c = left; c <= right; c++) row.push((cells.get(holeKey([c, r])) ?? ".").padEnd(width));
    lines.push(`${String(r).padStart(rowLabel)}  ${row.join("")}`.trimEnd());
  }

  const whole = left === 0 && top === 0 && right === board.cols - 1 && bottom === board.rows - 1;
  const strips = board.type === "stripboard"
    ? ` with ${board.strips} strips (every hole along a ${board.strips === "horizontal" ? "row" : "column"} is joined up to a cut)`
    : "";
  const out = [
    `${board.cols}×${board.rows} ${board.type}${strips}. Holes are [column, row] from 0${whole ? "" : `; showing columns ${left}-${right}, rows ${top}-${bottom}`}.`,
    `Key: ${KEY_TEXT}.`,
    "",
    ...lines,
  ];

  // The parts and wires in view, so the grid's keys and marks can be read back as names.
  const values = new Map([...project.placedStandardComponents, ...project.placedAdvancedComponents].map(e => [e.ref, e.value]));
  const shownParts = parts.map((part, i) => ({part, i})).filter(({part}) => part.pins.some(pin => inArea(pin.at)));
  if (shownParts.length) {
    out.push("", "Parts:");
    for (const {part, i} of shownParts) {
      const value = values.get(part.ref);
      const labelled = part.pins.some(pin => pin.label);
      const pins = labelled
        ? part.pins.map(pin => `${pin.pin} ${pin.label ?? ""}`.trim()).join(", ")
        : part.pins.length === 1 ? "pin 1" : `pins 1-${part.pins.length}`;
      out.push(`${partKey(i)} ${part.ref} ${part.part}${value ? ` ${value}` : ""} at ${showHole(part.pins[0].at)}: ${pins}`);
    }
  }

  const netOf = new Map<number, Net>();
  for (const net of netlist.nets) net.wires.forEach(i => netOf.set(i, net));
  const netText = (net: Net | undefined) => {
    if (!net || net.pins.length < 2) return "connects no pins";
    if (net.name) return net.name;
    const names = net.pins.map(pinName);
    return names.length > 4 ? `${names.slice(0, 4).join(", ")}...` : joinList(names);
  };
  const shownWires = project.wires.map((wire, i) => ({wire, i}))
    .filter(({wire}) => inArea(wire.from) || inArea(wire.to) || holesAlong(wire).some(({at}) => inArea(at)));
  if (shownWires.length) {
    out.push("", "Wires (index: ends, net):");
    for (const {wire, i} of shownWires) out.push(`${i}: ${showHole(wire.from)}-${showHole(wire.to)}, ${netText(netOf.get(i))}`);
  }
  return out.join("\n");
}
