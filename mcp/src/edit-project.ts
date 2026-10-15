import * as z from "zod";
import {GridPos} from "../../src/project-file/grid";
import {ProjectFile, Rotation, SavedWire} from "../../src/project-file/project-file";
import {BoardRefs} from "../../src/project-file/part-refs";
import {partPins} from "../../src/project-file/pin-positions";
import {NetPin, pinName} from "../../src/project-file/nets";
import {findPart, icEntry, similarPartIds} from "./parts";
import {findPin, pinsByRef} from "./expected-nets";

// edit_project's operations: small changes to a project (add a part, route a wire, cut a strip)
// so an agent never rewrites the whole file to change one thing. They only edit the file's
// entries: what's connected is still worked out by the shared nets code afterwards.

const hole = z.array(z.number().int()).length(2).describe("A hole, [column, row].");
// A wire end: a hole, or a pin by name, which stands for the hole it's in.
const wireEnd = z.union([z.array(z.number().int()).length(2), z.string()])
  .describe('A hole [column, row], or a pin by name: "U1.7", "U1.DISCH", "D1.K", "R2.1" (the hole that pin is in).');
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const wireSelector = z.union([z.number().int().min(0), z.array(hole).length(2)])
  .describe("A wire by its index in wires, or by its two end holes [[c, r], [c, r]] (either way round).");

export const editOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_part"),
    part: z.string().describe('The part\'s id from list_parts ("resistor", "ne555", "header-pins"), or the name of one of the project\'s customIcs.'),
    ref: z.string().optional().describe("Its reference designator. The next free one (R1, R2...) when left out."),
    from: hole.optional().describe("Two-lead parts: the hole of lead 1. On a polarized part get_part's leadLabels say which that is: K for a diode or LED, - for an electrolytic."),
    to: hole.optional().describe("Two-lead parts: the hole of lead 2."),
    at: hole.optional().describe("Other parts: pin 1's hole (a chip's or pin block's top-left pin)."),
    rotation: rotation.optional().describe("Other parts: 0 (default), 90, 180 or 270, clockwise."),
    rows: z.number().int().min(1).optional().describe("Pin blocks (header-pins): rows of pins."),
    cols: z.number().int().min(1).optional().describe("Pin blocks (header-pins): pins per row."),
    value: z.string().optional().describe('E.g. "10k", "100n".'),
    color: z.string().optional().describe('Two-lead parts, e.g. an LED\'s "#ef4444".'),
  }),
  z.object({
    op: z.literal("update_part"),
    ref: z.string(),
    by: hole.optional().describe("Move it by [columns, rows]."),
    from: hole.optional(),
    to: hole.optional(),
    at: hole.optional(),
    rotation: rotation.optional().describe("Turns about `at`; a chip's widthPin and heightPin are swapped to match."),
    rows: z.number().int().min(1).optional(),
    cols: z.number().int().min(1).optional(),
    value: z.string().optional().describe('"" removes it.'),
    color: z.string().optional().describe('"" removes it.'),
    newRef: z.string().optional(),
  }),
  z.object({op: z.literal("remove_parts"), refs: z.array(z.string()).min(1)}),
  z.object({
    op: z.literal("add_wire"),
    from: wireEnd.optional(),
    to: wireEnd.optional(),
    path: z.array(wireEnd).min(2).optional()
      .describe("Instead of from/to: holes (or pins) to run through in order, made into one wire per leg. Each corner is a wire end, so it joins whatever is in that hole."),
    color: z.string().optional(),
    width: z.number().positive().optional(),
  }),
  z.object({
    op: z.literal("update_wire"),
    wire: wireSelector,
    from: wireEnd.optional(),
    to: wireEnd.optional(),
    color: z.string().optional(),
    width: z.number().positive().optional(),
  }),
  z.object({
    op: z.literal("remove_wires"),
    wires: z.array(wireSelector).min(1).describe("Indexes are as they stand before this op, so list several in one op."),
  }),
  z.object({
    op: z.literal("set_board"),
    cols: z.number().int().min(1).optional(),
    rows: z.number().int().min(1).optional(),
    type: z.enum(["perfboard", "stripboard"]).optional(),
    strips: z.enum(["horizontal", "vertical"]).optional().describe("A stripboard's strips."),
  }),
  z.object({op: z.literal("add_cuts"), at: z.array(hole).min(1).describe("Stripboard holes to cut the strip at.")}),
  z.object({op: z.literal("remove_cuts"), at: z.array(hole).min(1)}),
  z.object({
    op: z.literal("set_pad"),
    at: hole,
    color: z.string().optional(),
    note: z.string().optional().describe("Both color and note left out (or \"\") unmarks the hole."),
  }),
]);

export type EditOp = z.infer<typeof editOp>;

export interface EditResult {
  project: ProjectFile;
  // What each op did, in words.
  changes: string[];
  // Parts added or moved, for reporting where their pins landed.
  placed: string[];
}

class OpError extends Error {}

const show = ([c, r]: readonly number[]) => `[${c}, ${r}]`;
const same = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];
const pos = (at: readonly number[]): GridPos => [at[0], at[1]];

// Applies `ops` in order to a copy of `project`. Throws, naming the op, if one can't be done: then
// nothing is changed.
export function applyEdits(project: ProjectFile, ops: EditOp[]): EditResult {
  const draft = structuredClone(project);
  const changes: string[] = [];
  const placed = new Set<string>();
  ops.forEach((op, i) => {
    try {
      changes.push(applyOne(draft, op, placed));
    } catch (err) {
      if (err instanceof OpError) throw new OpError(`ops[${i}] (${op.op}): ${err.message} No change was made.`);
      throw err;
    }
  });
  // Parts removed after being placed have nothing to report.
  const refs = new Set(allParts(draft).map(part => part.ref));
  return {project: draft, changes, placed: [...placed].filter(ref => refs.has(ref))};
}

export const isEditError = (err: unknown): err is Error => err instanceof OpError;

function allParts(project: ProjectFile) {
  return [
    ...project.placedIcs.map(entry => ({entry, kind: "ic" as const, ref: entry.ref})),
    ...project.placedStandardComponents.map(entry => ({entry, kind: "standard-component" as const, ref: entry.ref})),
    ...project.placedAdvancedComponents.map(entry => ({entry, kind: "advanced-component" as const, ref: entry.ref})),
  ];
}

function findRef(project: ProjectFile, ref: string) {
  const part = allParts(project).find(p => p.ref.toUpperCase() === ref.trim().toUpperCase());
  if (!part) {
    const refs = allParts(project).map(p => p.ref);
    throw new OpError(`There's no part ${ref}.${refs.length ? ` The board has ${refs.join(", ")}.` : " The board has no parts."}`);
  }
  return part;
}

function checkOnBoard(project: ProjectFile, at: readonly number[], what: string) {
  const {cols, rows} = project.board;
  if (at[0] < 0 || at[1] < 0 || at[0] >= cols || at[1] >= rows) {
    throw new OpError(`${what} ${show(at)} is off the ${cols}×${rows} board (columns 0-${cols - 1}, rows 0-${rows - 1}).`);
  }
}

function claimRef(project: ProjectFile, wanted: string | undefined, prefix: string, except?: string): string {
  const refs = new BoardRefs(allParts(project).map(p => p.ref).filter(ref => ref !== except));
  if (wanted === undefined) return refs.claimNext(prefix);
  if (!refs.claim(wanted.trim())) {
    throw new OpError(/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(wanted.trim())
      ? `Ref ${wanted} is already used by another part.`
      : `"${wanted}" isn't a valid ref: a letter, then up to 15 letters, digits, _ or -.`);
  }
  return wanted.trim();
}

function notFor(kind: string, op: Record<string, unknown>, fields: string[]) {
  const given = fields.filter(field => op[field] !== undefined);
  if (given.length) throw new OpError(`${given.map(f => `\`${f}\``).join(", ")} ${given.length === 1 ? "doesn't" : "don't"} apply to ${kind}.`);
}

// Where a wire end goes: the hole given, or the hole of the pin named, as of this op (so a part
// added earlier in the same edit can be wired to). `said` is how the reply names it.
function wireEndAt(project: ProjectFile, end: readonly number[] | string, what: string): {at: GridPos; said: string} {
  if (typeof end !== "string") {
    checkOnBoard(project, end, what);
    return {at: pos(end), said: show(end)};
  }
  const pins: NetPin[] = partPins(project).flatMap(part => part.pins.map(({pin, label, at}) =>
    ({ref: part.ref, kind: part.kind, pin, ...(label ? {label} : {}), at})));
  const pin = findPin(end, pinsByRef(pins));
  if (typeof pin === "string") throw new OpError(`${what} ${pin}.`);
  return {at: pin.at, said: `${pinName(pin)} ${show(pin.at)}`};
}

function findWire(project: ProjectFile, selector: number | number[][]): number {
  if (typeof selector === "number") {
    if (selector >= project.wires.length) throw new OpError(`There's no wires[${selector}]: the board has ${project.wires.length} wire${project.wires.length === 1 ? "" : "s"}.`);
    return selector;
  }
  const [a, b] = selector;
  const i = project.wires.findIndex(w => (same(w.from, a) && same(w.to, b)) || (same(w.from, b) && same(w.to, a)));
  if (i < 0) throw new OpError(`No wire runs between ${show(a)} and ${show(b)}.`);
  return i;
}

function applyOne(project: ProjectFile, op: EditOp, placed: Set<string>): string {
  switch (op.op) {
    case "add_part": return addPart(project, op, placed);
    case "update_part": return updatePart(project, op, placed);
    case "remove_parts": {
      const parts = op.refs.map(ref => findRef(project, ref));
      const gone = new Set(parts.map(p => p.entry));
      project.placedIcs = project.placedIcs.filter(e => !gone.has(e));
      project.placedStandardComponents = project.placedStandardComponents.filter(e => !gone.has(e));
      project.placedAdvancedComponents = project.placedAdvancedComponents.filter(e => !gone.has(e));
      return `Removed ${parts.map(p => p.ref).join(", ")}.`;
    }
    case "add_wire": {
      if (op.path && (op.from || op.to)) throw new OpError("Give either `path` or `from` and `to`, not both.");
      const given = op.path ?? (op.from && op.to ? [op.from, op.to] : undefined);
      if (!given) throw new OpError("A wire needs `from` and `to`, or a `path` of two or more holes.");
      const points = given.map((end, i) => wireEndAt(project, end, op.path ? `path[${i}]` : i ? "`to`" : "`from`"));
      // Holes repeated back to back would make wires of no length.
      const corners = points.filter((end, i) => i === 0 || !same(end.at, points[i - 1].at));
      if (corners.length < 2) throw new OpError("The wire starts and ends in the same hole.");
      const first = project.wires.length;
      for (let i = 1; i < corners.length; i++) {
        project.wires.push({
          from: corners[i - 1].at, to: corners[i].at,
          ...(op.color ? {color: op.color} : {}), ...(op.width ? {width: op.width} : {}),
        });
      }
      const made = corners.length - 1;
      return made === 1
        ? `Added wires[${first}] from ${corners[0].said} to ${corners[1].said}.`
        : `Added wires[${first}]-[${first + made - 1}] along ${corners.map(end => end.said).join(" → ")}.`;
    }
    case "update_wire": {
      const i = findWire(project, op.wire);
      const wire: SavedWire = project.wires[i];
      const from = op.from === undefined ? undefined : wireEndAt(project, op.from, "`from`");
      const to = op.to === undefined ? undefined : wireEndAt(project, op.to, "`to`");
      const updated: SavedWire = {
        ...wire, ...(from ? {from: from.at} : {}), ...(to ? {to: to.at} : {}),
        ...(op.color !== undefined ? {color: op.color} : {}), ...(op.width !== undefined ? {width: op.width} : {}),
      };
      if (!updated.color) delete updated.color;
      if (same(updated.from, updated.to)) throw new OpError(`The wire would start and end in hole ${show(updated.from)}.`);
      project.wires[i] = updated;
      return `wires[${i}] now runs from ${from?.said ?? show(updated.from)} to ${to?.said ?? show(updated.to)}.`;
    }
    case "remove_wires": {
      const indexes = new Set(op.wires.map(selector => findWire(project, selector)));
      const sorted = [...indexes].sort((a, b) => a - b);
      project.wires = project.wires.filter((_, i) => !indexes.has(i));
      return `Removed ${sorted.map(i => `wires[${i}]`).join(", ")}; later wires move up by ${sorted.length === 1 ? "one" : "as many"}.`;
    }
    case "set_board": {
      const {board} = project;
      const cols = op.cols ?? board.cols;
      const rows = op.rows ?? board.rows;
      const type = op.type ?? board.type;
      if (op.strips && type !== "stripboard") throw new OpError("`strips` is for a stripboard.");
      const off = ([c, r]: readonly number[]) => c >= cols || r >= rows;
      const parts = partPins(project).filter(part => part.pins.some(pin => off(pin.at))).map(part => part.ref);
      const wires = project.wires.flatMap((wire, i) => off(wire.from) || off(wire.to) ? [`wires[${i}]`] : []);
      const pads = project.pads.filter(pad => off(pad.at)).length;
      if (parts.length || wires.length || pads) {
        const what = [
          parts.length ? `${parts.join(", ")}` : "",
          wires.length ? (wires.length > 6 ? `${wires.length} wires (${wires.slice(0, 6).join(", ")}...)` : wires.join(", ")) : "",
          pads ? `${pads} marked hole${pads === 1 ? "" : "s"}` : "",
        ].filter(Boolean);
        throw new OpError(`These would be off the edge of a board ${cols}×${rows} holes: ${what.join("; ")}. Move or remove them first.`);
      }
      if (type === "stripboard") {
        const cuts = board.type === "stripboard" ? board.cuts.filter(([c, r]) => c < cols && r < rows) : [];
        project.board = {type, cols, rows, strips: op.strips ?? (board.type === "stripboard" ? board.strips : "horizontal"), cuts};
      } else {
        project.board = {type, cols, rows};
      }
      const dropped = board.type === "stripboard" && type === "perfboard" && board.cuts.length;
      const b = project.board;
      return `The board is now a ${b.cols}×${b.rows} ${b.type}${b.type === "stripboard" ? ` with ${b.strips} strips` : ""}.${dropped ? ` Its ${dropped} cut${dropped === 1 ? " was" : "s were"} dropped.` : ""}`;
    }
    case "add_cuts":
    case "remove_cuts": {
      const board = project.board;
      if (board.type !== "stripboard") throw new OpError("Only a stripboard has cuts: change it with set_board first.");
      op.at.forEach((at, i) => checkOnBoard(project, at, `at[${i}]`));
      if (op.op === "add_cuts") {
        const added = op.at.filter((at, i) => !board.cuts.some(cut => same(cut, at)) && !op.at.slice(0, i).some(prev => same(prev, at)));
        board.cuts.push(...added.map(pos));
        return `Cut the strip${added.length === 1 ? "" : "s"} at ${added.map(show).join(", ") || "nothing new (already cut)"}.`;
      }
      const before = board.cuts.length;
      board.cuts = board.cuts.filter(cut => !op.at.some(at => same(at, cut)));
      return `Removed ${before - board.cuts.length} cut${before - board.cuts.length === 1 ? "" : "s"}.`;
    }
    case "set_pad": {
      checkOnBoard(project, op.at, "`at`");
      project.pads = project.pads.filter(pad => !same(pad.at, op.at));
      if (!op.color && !op.note) return `Unmarked hole ${show(op.at)}.`;
      project.pads.push({at: pos(op.at), ...(op.color ? {color: op.color} : {}), ...(op.note ? {note: op.note} : {})});
      return `Marked hole ${show(op.at)}.`;
    }
  }
}

function addPart(project: ProjectFile, op: Extract<EditOp, {op: "add_part"}>, placed: Set<string>): string {
  const part = findPart(op.part);
  const custom = part ? undefined : project.customIcs.find(ic => ic.name.toLowerCase() === op.part.trim().toLowerCase());
  if (!part && !custom) {
    const hints = similarPartIds(op.part);
    throw new OpError(`There's no part "${op.part}".${hints.length ? ` Did you mean ${hints.map(h => `"${h}"`).join(", ")}?` : ""} Use list_parts to find one.`);
  }

  if (part?.kind === "standard-component") {
    notFor(`a two-lead part (${part.id})`, op, ["at", "rotation", "rows", "cols"]);
    if (!op.from || !op.to) throw new OpError(`${part.id} is a two-lead part: give \`from\` and \`to\`, the holes of its two leads.`);
    checkOnBoard(project, op.from, "`from`");
    checkOnBoard(project, op.to, "`to`");
    const ref = claimRef(project, op.ref, part.refPrefix);
    project.placedStandardComponents.push({
      ref, definitionId: part.id, from: pos(op.from), to: pos(op.to),
      ...(op.value ? {value: op.value} : {}), ...(op.color ? {color: op.color} : {}),
    });
    placed.add(ref);
    return `Added ${ref} (${part.name}${op.value ? ` ${op.value}` : ""}) from ${show(op.from)} to ${show(op.to)}.`;
  }

  notFor("a part placed by `at`", op, ["from", "to", "color"]);
  if (!op.at) throw new OpError("Give `at`: the hole of pin 1 (a chip's or pin block's top-left pin).");
  checkOnBoard(project, op.at, "`at`");
  const rot: Rotation = op.rotation ?? 0;

  if (part?.kind === "advanced-component") {
    if (!part.sizable) notFor(`${part.id} (not a pin block)`, op, ["rows", "cols"]);
    const ref = claimRef(project, op.ref, part.refPrefix);
    project.placedAdvancedComponents.push({
      ref, definitionId: part.id, at: pos(op.at), rotation: rot, rows: op.rows ?? 1, cols: op.cols ?? 1,
      ...(op.value ? {value: op.value} : {}),
    });
    placed.add(ref);
    return `Added ${ref} (${part.name}${part.sizable ? `, ${op.rows ?? 1}×${op.cols ?? 1}` : ""}) at ${show(op.at)}${rot ? `, turned ${rot}°` : ""}.`;
  }

  notFor("a chip", op, ["rows", "cols", "value"]);
  const ref = claimRef(project, op.ref, "U");
  if (part?.kind === "ic") {
    project.placedIcs.push(icEntry(part, pos(op.at), rot, ref));
  } else {
    const ic = custom!;
    const turned = rot === 90 || rot === 270;
    project.placedIcs.push({
      ref, name: ic.name, at: pos(op.at), rotation: rot,
      widthPin: turned ? ic.heightPin : ic.widthPin, heightPin: turned ? ic.widthPin : ic.heightPin,
      pinDescription: {...ic.pinDescription}, ...(ic.category ? {category: ic.category} : {}),
    });
  }
  placed.add(ref);
  return `Added ${ref} (${part?.name ?? custom!.name}) with its top-left pin at ${show(op.at)}${rot ? `, turned ${rot}°` : ""}.`;
}

function updatePart(project: ProjectFile, op: Extract<EditOp, {op: "update_part"}>, placed: Set<string>): string {
  const found = findRef(project, op.ref);
  const said: string[] = [];
  const by = op.by ?? [0, 0];
  if (op.by && (op.at || op.from || op.to)) throw new OpError("Give `by` or new positions, not both.");

  if (found.kind === "standard-component") {
    notFor("a two-lead part", op, ["at", "rotation", "rows", "cols"]);
    const e = found.entry;
    const from = op.from ?? [e.from[0] + by[0], e.from[1] + by[1]];
    const to = op.to ?? [e.to[0] + by[0], e.to[1] + by[1]];
    checkOnBoard(project, from, "`from`");
    checkOnBoard(project, to, "`to`");
    if (!same(from, e.from) || !same(to, e.to)) said.push(`now runs from ${show(from)} to ${show(to)}`);
    e.from = pos(from);
    e.to = pos(to);
    if (op.color !== undefined) {
      if (op.color) e.color = op.color;
      else delete e.color;
      said.push(op.color ? `color ${op.color}` : "no color");
    }
  } else {
    notFor("a part placed by `at`", op, ["from", "to", "color"]);
    const e = found.entry;
    const at = op.at ?? [e.at[0] + by[0], e.at[1] + by[1]];
    checkOnBoard(project, at, "`at`");
    if (!same(at, e.at)) said.push(`now at ${show(at)}`);
    e.at = pos(at);
    if (op.rotation !== undefined && op.rotation !== e.rotation) {
      if (found.kind === "ic" && (op.rotation - found.entry.rotation) % 180 !== 0) {
        [found.entry.widthPin, found.entry.heightPin] = [found.entry.heightPin, found.entry.widthPin];
      }
      e.rotation = op.rotation;
      said.push(`turned to ${op.rotation}°`);
    }
    if (found.kind === "advanced-component") {
      if (op.rows !== undefined || op.cols !== undefined) {
        found.entry.rows = op.rows ?? found.entry.rows;
        found.entry.cols = op.cols ?? found.entry.cols;
        said.push(`${found.entry.rows}×${found.entry.cols}`);
      }
    } else {
      notFor("a chip", op, ["rows", "cols", "value"]);
    }
  }

  if (op.value !== undefined && found.kind !== "ic") {
    if (op.value) found.entry.value = op.value;
    else delete found.entry.value;
    said.push(op.value ? `value ${op.value}` : "no value");
  }
  const oldRef = found.ref;
  if (op.newRef !== undefined && op.newRef.trim() !== oldRef) {
    found.entry.ref = claimRef(project, op.newRef, "", oldRef);
    said.push(`renamed ${found.entry.ref}`);
  }
  placed.delete(oldRef);
  placed.add(found.entry.ref);
  return said.length ? `${oldRef}: ${said.join(", ")}.` : `${oldRef}: nothing to change.`;
}

// Where the pins of these parts landed, as "pin label": [column, row].
export function pinsOf(project: ProjectFile, refs: string[]): Record<string, Record<string, GridPos>> {
  const wanted = new Set(refs);
  const result: Record<string, Record<string, GridPos>> = {};
  for (const part of partPins(project)) {
    if (!wanted.has(part.ref)) continue;
    result[part.ref] = Object.fromEntries(part.pins.map(pin => [`${pin.pin}${pin.label ? ` ${pin.label}` : ""}`, pin.at]));
  }
  return result;
}
