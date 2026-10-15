import {BoardRefs, boardPins, GridPos, isValidRef, partPins, pinName, ProjectFile, Rotation, SavedWire} from "./editor";
import {findPart, icEntry, noSuchPart} from "./parts";
import {findPin, pinsByRef} from "./expected-nets";
import {EditOp, Op} from "./edit-ops";
import {offBoard, plural, sameHole, showHole, toGridPos} from "./text";

// edit_project's operations (edit-ops.ts): small changes to a project (add a part, route a wire,
// cut a strip) so an agent never rewrites the whole file to change one thing. They only edit the
// file's entries: what's connected is still worked out by the editor's nets code afterwards.

export interface EditResult {
  project: ProjectFile;
  // What each op did, in words.
  changes: string[];
  // Parts added or moved, for reporting where their pins landed.
  placed: string[];
}

class OpError extends Error {}

export const isEditError = (err: unknown): err is Error => err instanceof OpError;

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

// Each op says what it did, in words.
function applyOne(project: ProjectFile, op: EditOp, placed: Set<string>): string {
  switch (op.op) {
    case "add_part": return addPart(project, op, placed);
    case "update_part": return updatePart(project, op, placed);
    case "remove_parts": return removeParts(project, op);
    case "add_wire": return addWire(project, op);
    case "update_wire": return updateWire(project, op);
    case "remove_wires": return removeWires(project, op);
    case "set_board": return setBoard(project, op);
    case "add_cuts": return addCuts(project, op);
    case "remove_cuts": return removeCuts(project, op);
    case "set_pad": return setPad(project, op);
  }
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

// --- Parts ---

function addPart(project: ProjectFile, op: Op<"add_part">, placed: Set<string>): string {
  const part = findPart(op.part);
  const custom = part ? undefined : project.customIcs.find(ic => ic.name.toLowerCase() === op.part.trim().toLowerCase());
  if (!part && !custom) throw new OpError(`${noSuchPart(op.part)} Use list_parts to find one.`);

  if (part?.kind === "standard-component") {
    notFor(`a two-lead part (${part.id})`, op, ["at", "rotation", "rows", "cols"]);
    if (!op.from || !op.to) throw new OpError(`${part.id} is a two-lead part: give \`from\` and \`to\`, the holes of its two leads.`);
    checkOnBoard(project, op.from, "`from`");
    checkOnBoard(project, op.to, "`to`");
    const ref = claimRef(project, op.ref, part.refPrefix);
    project.placedStandardComponents.push({
      ref, definitionId: part.id, from: toGridPos(op.from), to: toGridPos(op.to),
      ...(op.value ? {value: op.value} : {}), ...(op.color ? {color: op.color} : {}),
    });
    placed.add(ref);
    return `Added ${ref} (${part.name}${op.value ? ` ${op.value}` : ""}) from ${showHole(op.from)} to ${showHole(op.to)}.`;
  }

  notFor("a part placed by `at`", op, ["from", "to", "color"]);
  if (!op.at) throw new OpError("Give `at`: the hole of pin 1 (a chip's or pin block's top-left pin).");
  checkOnBoard(project, op.at, "`at`");
  const at = toGridPos(op.at);
  const rotation: Rotation = op.rotation ?? 0;
  const turned = rotation ? `, turned ${rotation}°` : "";

  if (part?.kind === "advanced-component") {
    if (!part.sizable) notFor(`${part.id} (not a pin block)`, op, ["rows", "cols"]);
    const ref = claimRef(project, op.ref, part.refPrefix);
    project.placedAdvancedComponents.push({
      ref, definitionId: part.id, at, rotation, rows: op.rows ?? 1, cols: op.cols ?? 1,
      ...(op.value ? {value: op.value} : {}),
    });
    placed.add(ref);
    return `Added ${ref} (${part.name}${part.sizable ? `, ${op.rows ?? 1}×${op.cols ?? 1}` : ""}) at ${showHole(at)}${turned}.`;
  }

  notFor("a chip", op, ["rows", "cols", "value"]);
  const ref = claimRef(project, op.ref, "U");
  if (part?.kind === "ic") {
    project.placedIcs.push(icEntry(part, at, rotation, ref));
  } else {
    const ic = custom!;
    const sideways = rotation === 90 || rotation === 270;
    project.placedIcs.push({
      ref, name: ic.name, at, rotation,
      widthPin: sideways ? ic.heightPin : ic.widthPin, heightPin: sideways ? ic.widthPin : ic.heightPin,
      pinDescription: {...ic.pinDescription}, ...(ic.category ? {category: ic.category} : {}),
    });
  }
  placed.add(ref);
  return `Added ${ref} (${part?.name ?? custom!.name}) with its top-left pin at ${showHole(at)}${turned}.`;
}

function updatePart(project: ProjectFile, op: Op<"update_part">, placed: Set<string>): string {
  const found = findRef(project, op.ref);
  const said: string[] = [];
  const by = op.by ?? [0, 0];
  const moved = (at: readonly number[]) => [at[0] + by[0], at[1] + by[1]];
  if (op.by && (op.at || op.from || op.to)) throw new OpError("Give `by` or new positions, not both.");

  if (found.kind === "standard-component") {
    notFor("a two-lead part", op, ["at", "rotation", "rows", "cols"]);
    const e = found.entry;
    const from = op.from ?? moved(e.from);
    const to = op.to ?? moved(e.to);
    checkOnBoard(project, from, "`from`");
    checkOnBoard(project, to, "`to`");
    if (!sameHole(from, e.from) || !sameHole(to, e.to)) said.push(`now runs from ${showHole(from)} to ${showHole(to)}`);
    e.from = toGridPos(from);
    e.to = toGridPos(to);
    if (op.color !== undefined) {
      if (op.color) e.color = op.color;
      else delete e.color;
      said.push(op.color ? `color ${op.color}` : "no color");
    }
  } else {
    notFor("a part placed by `at`", op, ["from", "to", "color"]);
    const e = found.entry;
    const at = op.at ?? moved(e.at);
    checkOnBoard(project, at, "`at`");
    if (!sameHole(at, e.at)) said.push(`now at ${showHole(at)}`);
    e.at = toGridPos(at);
    if (op.rotation !== undefined && op.rotation !== e.rotation) {
      // A chip's widthPin and heightPin describe it as placed.
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

function removeParts(project: ProjectFile, op: Op<"remove_parts">): string {
  const parts = op.refs.map(ref => findRef(project, ref));
  const gone = new Set(parts.map(p => p.entry));
  project.placedIcs = project.placedIcs.filter(e => !gone.has(e));
  project.placedStandardComponents = project.placedStandardComponents.filter(e => !gone.has(e));
  project.placedAdvancedComponents = project.placedAdvancedComponents.filter(e => !gone.has(e));
  return `Removed ${parts.map(p => p.ref).join(", ")}.`;
}

function allParts(project: ProjectFile) {
  return [
    ...project.placedIcs.map(entry => ({entry, kind: "ic" as const, ref: entry.ref})),
    ...project.placedStandardComponents.map(entry => ({entry, kind: "standard-component" as const, ref: entry.ref})),
    ...project.placedAdvancedComponents.map(entry => ({entry, kind: "advanced-component" as const, ref: entry.ref})),
  ];
}

function findRef(project: ProjectFile, ref: string) {
  const parts = allParts(project);
  const part = parts.find(p => p.ref.toUpperCase() === ref.trim().toUpperCase());
  if (!part) {
    const refs = parts.map(p => p.ref);
    throw new OpError(`There's no part ${ref}.${refs.length ? ` The board has ${refs.join(", ")}.` : " The board has no parts."}`);
  }
  return part;
}

// The ref a part gets: `wanted`, if it's valid and free, else the next free one for `prefix`.
// `except` is the part's own ref when renaming it.
function claimRef(project: ProjectFile, wanted: string | undefined, prefix: string, except?: string): string {
  const refs = new BoardRefs(allParts(project).map(p => p.ref).filter(ref => ref !== except));
  if (wanted === undefined) return refs.claimNext(prefix);
  const ref = wanted.trim();
  if (!refs.claim(ref)) {
    throw new OpError(isValidRef(ref)
      ? `Ref ${wanted} is already used by another part.`
      : `"${wanted}" isn't a valid ref: a letter, then up to 15 letters, digits, _ or -.`);
  }
  return ref;
}

// Refuses fields given that don't apply to this kind of part.
function notFor(kind: string, op: Record<string, unknown>, fields: string[]) {
  const given = fields.filter(field => op[field] !== undefined);
  if (given.length) throw new OpError(`${given.map(f => `\`${f}\``).join(", ")} ${given.length === 1 ? "doesn't" : "don't"} apply to ${kind}.`);
}

// --- Wires ---

function addWire(project: ProjectFile, op: Op<"add_wire">): string {
  if (op.path && (op.from || op.to)) throw new OpError("Give either `path` or `from` and `to`, not both.");
  const given = op.path ?? (op.from && op.to ? [op.from, op.to] : undefined);
  if (!given) throw new OpError("A wire needs `from` and `to`, or a `path` of two or more holes.");
  const points = given.map((end, i) => wireEndAt(project, end, op.path ? `path[${i}]` : i ? "`to`" : "`from`"));
  // Holes repeated back to back would make wires of no length.
  const corners = points.filter((end, i) => i === 0 || !sameHole(end.at, points[i - 1].at));
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

function updateWire(project: ProjectFile, op: Op<"update_wire">): string {
  const i = findWire(project, op.wire);
  const from = op.from === undefined ? undefined : wireEndAt(project, op.from, "`from`");
  const to = op.to === undefined ? undefined : wireEndAt(project, op.to, "`to`");
  const updated: SavedWire = {
    ...project.wires[i], ...(from ? {from: from.at} : {}), ...(to ? {to: to.at} : {}),
    ...(op.color !== undefined ? {color: op.color} : {}), ...(op.width !== undefined ? {width: op.width} : {}),
  };
  if (!updated.color) delete updated.color;
  if (sameHole(updated.from, updated.to)) throw new OpError(`The wire would start and end in hole ${showHole(updated.from)}.`);
  project.wires[i] = updated;
  return `wires[${i}] now runs from ${from?.said ?? showHole(updated.from)} to ${to?.said ?? showHole(updated.to)}.`;
}

function removeWires(project: ProjectFile, op: Op<"remove_wires">): string {
  const indexes = new Set(op.wires.map(selector => findWire(project, selector)));
  const sorted = [...indexes].sort((a, b) => a - b);
  project.wires = project.wires.filter((_, i) => !indexes.has(i));
  return `Removed ${sorted.map(i => `wires[${i}]`).join(", ")}; later wires move up by ${sorted.length === 1 ? "one" : "as many"}.`;
}

// Where a wire end goes: the hole given, or the hole of the pin named, as of this op (so a part
// added earlier in the same edit can be wired to). `said` is how the reply names it.
function wireEndAt(project: ProjectFile, end: readonly number[] | string, what: string): {at: GridPos; said: string} {
  if (typeof end !== "string") {
    checkOnBoard(project, end, what);
    return {at: toGridPos(end), said: showHole(end)};
  }
  const pin = findPin(end, pinsByRef(boardPins(project)));
  if (typeof pin === "string") throw new OpError(`${what} ${pin}.`);
  return {at: pin.at, said: `${pinName(pin)} ${showHole(pin.at)}`};
}

function findWire(project: ProjectFile, selector: number | number[][]): number {
  if (typeof selector === "number") {
    if (selector >= project.wires.length) throw new OpError(`There's no wires[${selector}]: the board has ${plural(project.wires.length, "wire")}.`);
    return selector;
  }
  const [a, b] = selector;
  const i = project.wires.findIndex(w => (sameHole(w.from, a) && sameHole(w.to, b)) || (sameHole(w.from, b) && sameHole(w.to, a)));
  if (i < 0) throw new OpError(`No wire runs between ${showHole(a)} and ${showHole(b)}.`);
  return i;
}

// --- The board ---

function setBoard(project: ProjectFile, op: Op<"set_board">): string {
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
      parts.join(", "),
      wires.length > 6 ? `${wires.length} wires (${wires.slice(0, 6).join(", ")}...)` : wires.join(", "),
      pads ? plural(pads, "marked hole") : "",
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
  const now = project.board;
  return `The board is now a ${now.cols}×${now.rows} ${now.type}${now.type === "stripboard" ? ` with ${now.strips} strips` : ""}.${dropped ? ` Its ${dropped} cut${dropped === 1 ? " was" : "s were"} dropped.` : ""}`;
}

// The board, for an op on its strip cuts.
function stripboard(project: ProjectFile, at: number[][]): Extract<ProjectFile["board"], {type: "stripboard"}> {
  const board = project.board;
  if (board.type !== "stripboard") throw new OpError("Only a stripboard has cuts: change it with set_board first.");
  at.forEach((hole, i) => checkOnBoard(project, hole, `at[${i}]`));
  return board;
}

function addCuts(project: ProjectFile, op: Op<"add_cuts">): string {
  const board = stripboard(project, op.at);
  const added = op.at.filter((at, i) => !board.cuts.some(cut => sameHole(cut, at)) && !op.at.slice(0, i).some(prev => sameHole(prev, at)));
  board.cuts.push(...added.map(toGridPos));
  return `Cut the strip${added.length === 1 ? "" : "s"} at ${added.map(showHole).join(", ") || "nothing new (already cut)"}.`;
}

function removeCuts(project: ProjectFile, op: Op<"remove_cuts">): string {
  const board = stripboard(project, op.at);
  const before = board.cuts.length;
  board.cuts = board.cuts.filter(cut => !op.at.some(at => sameHole(at, cut)));
  return `Removed ${plural(before - board.cuts.length, "cut")}.`;
}

function setPad(project: ProjectFile, op: Op<"set_pad">): string {
  checkOnBoard(project, op.at, "`at`");
  project.pads = project.pads.filter(pad => !sameHole(pad.at, op.at));
  if (!op.color && !op.note) return `Unmarked hole ${showHole(op.at)}.`;
  project.pads.push({at: toGridPos(op.at), ...(op.color ? {color: op.color} : {}), ...(op.note ? {note: op.note} : {})});
  return `Marked hole ${showHole(op.at)}.`;
}

function checkOnBoard(project: ProjectFile, at: readonly number[], what: string) {
  const {cols, rows} = project.board;
  if (at[0] < 0 || at[1] < 0 || at[0] >= cols || at[1] >= rows) {
    throw new OpError(`${what} ${showHole(at)} is ${offBoard(cols, rows)}.`);
  }
}
