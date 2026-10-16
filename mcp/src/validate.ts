import {
  Box, comparePins, computeNets, GridPos, isModulePart, isPowerNet, isValidRef, layoutProjectWires, Net, Netlist,
  NetPin, PartPins, partPins, pinName, PlacedPin, ProjectFile, ProjectFileError, readProjectFile,
} from "./editor";
import {partsLike} from "./parts";
import {holeContents, WireIndex} from "./nets-report";
import {checkExpectedNets} from "./expected-nets";
import {holeKey, joinList, offBoard, plural, showHole, wireName} from "./text";

// Checks a project file the way a person looking at the board would: beyond what the reader
// accepts (it quietly skips what it can't read), it names each problem and where it is, so an
// agent can fix it and try again. Errors make a board wrong; warnings are likely mistakes; notes
// are worth knowing but fine, such as wires crossing.

export interface Problem {
  severity: "error" | "warning";
  message: string;
}

export interface Validation {
  // No errors (warnings allowed).
  ok: boolean;
  // The project as the editor will read it (refs filled in, unreadable entries left out).
  project?: ProjectFile;
  // How many entries the reader left out, and the errors naming those it could place.
  leftOut: number;
  unreadable: Problem[];
  // Where each of project.wires is in the file as given.
  wireIndex: WireIndex;
  problems: Problem[];
  notes: string[];
}

class Report {
  readonly problems: Problem[] = [];
  readonly notes: string[] = [];
  error = (message: string) => this.problems.push({severity: "error", message});
  warn = (message: string) => this.problems.push({severity: "warning", message});
  note = (message: string) => this.notes.push(message);
  get ok() {
    return !this.problems.some(p => p.severity === "error");
  }
}

// The board being checked, as every check sees it.
interface Board {
  project: ProjectFile;
  parts: PartPins[];
  // What's in each hole: pins, and holes a part's body covers.
  holes: Map<string, HoleUser[]>;
  nets: Netlist;
  wireIndex: WireIndex;
  report: Report;
  // Wires with a problem at an end reported already, so they aren't reported again as stray.
  badEnds: Set<number>;
  // Parts with pins shorted by a stripboard's strips, reported already.
  stripShorted: Set<string>;
}

interface HoleUser {
  part: PartPins;
  what: string;
  body: boolean;
}

const PART_LISTS = ["placedIcs", "placedStandardComponents", "placedAdvancedComponents"] as const;
const LISTS = ["pads", "wires", ...PART_LISTS, "customIcs"] as const;
type ListName = typeof LISTS[number];

type Entry = Record<string, unknown>;
const asEntry = (value: unknown): Entry | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Entry : undefined;

// expectNets: the nets the board should make, as lists of "REF.pin" names (see expected-nets.ts).
export function validateProject(raw: unknown, expectNets?: string[][]): Validation {
  const report = new Report();

  let project: ProjectFile;
  let skipped: number;
  try {
    ({project, skipped} = readProjectFile(raw));
  } catch (err) {
    report.error(err instanceof ProjectFileError
      ? `${err.message} A project needs at least {"version": 3, "board": {"type": "perfboard", "cols": <n>, "rows": <n>}}.`
      : `It couldn't be read: ${String(err)}`);
    return {ok: false, leftOut: 0, unreadable: [], wireIndex: i => i, problems: report.problems, notes: report.notes};
  }

  const data = asEntry(raw) ?? {};
  if (data.version === undefined && asEntry(data.board)) report.warn('There\'s no "version": it was read as version 3. Add "version": 3.');
  const entries = readEntriesAlone(data, project);
  report.problems.push(...entries.unreadable);
  const unnamed = skipped - entries.unreadable.length;
  if (unnamed > 0) report.warn(`${unnamed} more entr${unnamed === 1 ? "y" : "ies"} couldn't be read and ${unnamed === 1 ? "was" : "were"} left out.`);
  reportRenamedRefs(data, project, entries.kept, report);

  // Messages point at entries by their place in the file as given, before any were left out.
  const wireIndex = (i: number) => entries.kept.wires?.[i] ?? i;
  const parts = partPins(project);
  const board: Board = {
    project, parts, holes: holeUsers(parts), nets: computeNets(project), wireIndex, report,
    badEnds: new Set(), stripShorted: new Set(),
  };
  checkParts(board);
  checkHoles(board);
  checkWireEnds(board);
  if (project.board.type === "stripboard") checkStrips(board);
  checkConnections(board);
  if (expectNets) checkExpectedNets(board.nets, expectNets, report.error);

  return {
    ok: report.ok, project, leftOut: skipped, unreadable: entries.unreadable, wireIndex,
    problems: report.problems, notes: report.notes,
  };
}

// Each entry of the file read on its own, to tell which ones the reader left out (each with why)
// and where in the file the kept ones are, list by list.
function readEntriesAlone(data: Entry, project: ProjectFile): {unreadable: Problem[]; kept: Partial<Record<ListName, number[]>>} {
  const unreadable: Problem[] = [];
  const kept: Partial<Record<ListName, number[]>> = {};
  const board = asEntry(data.board);
  // A version 1 file has no board: its entries can't be read one at a time.
  if (!board) return {unreadable, kept};
  const version = data.version === 2 ? 2 : 3;
  const {cols, rows} = project.board;
  const leftOut = (where: string, why: string) => unreadable.push({severity: "error", message: `${where} was left out: ${why}.`});

  const position = (name: string, value: unknown): string | undefined => {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger)) return `\`${name}\` must be a [column, row] pair of whole numbers`;
    const [c, r] = value as number[];
    if (c < 0 || c >= cols || r < 0 || r >= rows) return `\`${name}\` ${showHole([c, r])} is ${offBoard(cols, rows)}`;
    return undefined;
  };
  const why = (list: ListName, entry: Entry | undefined): string => {
    if (!entry) return "it isn't an object";
    const missing = (field: string) => typeof entry[field] !== "string" || !(entry[field] as string).trim() ? `\`${field}\` is missing` : undefined;
    const count = (field: string) => Number.isInteger(entry[field]) && (entry[field] as number) >= 1 ? undefined : `\`${field}\` must be a whole number, 1 or more`;
    const reasons = {
      pads: () => [position("at", entry.at)],
      wires: () => [position("from", entry.from), position("to", entry.to)],
      placedIcs: () => [position("at", entry.at), count("widthPin"), count("heightPin")],
      placedStandardComponents: () => [missing("definitionId"), position("from", entry.from), position("to", entry.to)],
      placedAdvancedComponents: () => [missing("definitionId"), position("at", entry.at)],
      customIcs: () => [count("widthPin"), count("heightPin")],
    }[list]().filter(Boolean);
    return reasons.length ? reasons.join("; ") : "it couldn't be read";
  };
  const readsAlone = (list: ListName, item: unknown) => {
    try {
      return readProjectFile({version, board: {...board, cuts: []}, [list]: [item]}).skipped === 0;
    } catch {
      return false;
    }
  };

  for (const list of LISTS) {
    const items = Array.isArray(data[list]) ? data[list] as unknown[] : [];
    items.forEach((item, i) => {
      if (readsAlone(list, item)) (kept[list] ??= []).push(i);
      else leftOut(`${list}[${i}]`, why(list, asEntry(item)));
    });
  }
  if (Array.isArray(board.cuts)) {
    (board.cuts as unknown[]).forEach((cut, i) => {
      const reason = position("cut", cut);
      if (reason) leftOut(`board.cuts[${i}]`, reason);
    });
  }
  return {unreadable, kept};
}

// Refs the reader had to change: malformed, or already taken by an earlier part.
function reportRenamedRefs(data: Entry, project: ProjectFile, kept: Partial<Record<ListName, number[]>>, report: Report) {
  for (const list of PART_LISTS) {
    const given = (kept[list] ?? []).map(i => asEntry((data[list] as unknown[])[i])?.ref);
    (project[list] as {ref: string}[]).forEach((part, i) => {
      const ref = given[i];
      if (typeof ref !== "string" || !ref.trim() || ref === part.ref) return;
      report.warn(`${list}[${i}]: ref "${ref}" ${isValidRef(ref) ? "is already used by another part" : "isn't a valid ref (a letter, then letters, digits, _ or -)"}, so it became ${part.ref}.`);
    });
  }
}

function holeUsers(parts: PartPins[]): Map<string, HoleUser[]> {
  const holes = new Map<string, HoleUser[]>();
  const put = (at: GridPos, user: HoleUser) => holes.set(holeKey(at), [...(holes.get(holeKey(at)) ?? []), user]);
  for (const part of parts) {
    for (const pin of part.pins) put(pin.at, {part, what: `${part.ref} pin ${pin.pin}${pin.label ? ` (${pin.label})` : ""}`, body: false});
    for (const at of part.coveredHoles) put(at, {part, what: `the body of ${part.ref}`, body: true});
  }
  return holes;
}

// Unknown parts, pins off the board, and two-lead parts with both leads in one hole.
function checkParts({project, parts, report}: Board) {
  const {cols, rows} = project.board;
  const onBoard = ([c, r]: GridPos) => c >= 0 && c < cols && r >= 0 && r < rows;
  for (const part of parts) {
    if (!part.known) {
      const like = partsLike(part.part);
      report.error(`${part.ref}: unknown definitionId "${part.part}"${like ? ` (did you mean ${like}?)` : ""}. Use list_parts for valid ids.`);
    }
    for (const pin of part.pins) {
      if (!onBoard(pin.at)) report.error(`${part.ref} pin ${pin.pin} lands at ${showHole(pin.at)}, ${offBoard(cols, rows)}.`);
    }
  }
  for (const part of project.placedStandardComponents) {
    if (holeKey(part.from) === holeKey(part.to)) report.error(`${part.ref}: both leads are in hole ${showHole(part.from)}; \`from\` and \`to\` must differ.`);
  }
}

// Two parts in one hole (an error), and parts whose bodies overlap (a warning).
function checkHoles({parts, holes, report}: Board) {
  const clashing = new Set<string>();
  for (const [hole, users] of holes) {
    if (new Set(users.map(u => u.part)).size < 2) continue;
    users.forEach(a => users.forEach(b => clashing.add(`${a.part.ref}|${b.part.ref}`)));
    report.error(`Hole [${hole.replace(",", ", ")}] is used twice: ${users.map(u => u.what).join(" and ")}. A hole takes one part's pin or lead: move one, and to connect them, run a wire between their pins.`);
  }
  const overlaps = (a: Box, b: Box) =>
    a.left < b.right - 0.01 && b.left < a.right - 0.01 && a.top < b.bottom - 0.01 && b.top < a.bottom - 0.01;
  parts.forEach((a, i) => parts.slice(i + 1).forEach(b => {
    if (a.body && b.body && !clashing.has(`${a.ref}|${b.ref}`) && overlaps(a.body, b.body)) {
      report.warn(`${a.ref} and ${b.ref} overlap: their bodies would sit on top of each other.`);
    }
  }));
}

// Wires of no length, running between the same holes as another, ending under a part's body, or
// (on a perfboard) ending in an empty hole.
function checkWireEnds({project, parts, holes, wireIndex, report, badEnds}: Board) {
  const pinHoles = new Set(parts.flatMap(part => part.pins.map(pin => holeKey(pin.at))));
  const wireEnds = new Map<string, number>();
  for (const wire of project.wires) for (const end of [wire.from, wire.to]) wireEnds.set(holeKey(end), (wireEnds.get(holeKey(end)) ?? 0) + 1);
  // The first wire between each pair of holes, either way round.
  const runs = new Map<string, number>();
  project.wires.forEach((wire, i) => {
    const name = wireName(wireIndex(i));
    if (holeKey(wire.from) === holeKey(wire.to)) {
      report.error(`${name} starts and ends in hole ${showHole(wire.from)}.`);
      badEnds.add(i);
    }
    const run = [holeKey(wire.from), holeKey(wire.to)].sort().join("|");
    const first = runs.get(run);
    if (first === undefined) runs.set(run, i);
    else if (holeKey(wire.from) !== holeKey(wire.to)) report.warn(`${name} runs between the same holes as ${wireName(wireIndex(first))}, ${showHole(wire.from)} and ${showHole(wire.to)}: remove one.`);
    for (const end of [wire.from, wire.to]) {
      const body = holes.get(holeKey(end))?.find(user => user.body);
      if (body) {
        report.error(`${name} ends at ${showHole(end)}, which is under ${body.what}.`);
        badEnds.add(i);
      } else if (project.board.type === "perfboard" && !pinHoles.has(holeKey(end)) && (wireEnds.get(holeKey(end)) ?? 0) < 2) {
        report.warn(`${name} ends at ${showHole(end)}, which has no pin and no other wire: that end connects to nothing.`);
        badEnds.add(i);
      }
    }
  });
}

// Stripboard mistakes: two pins of one part left on the same strip (shorted), and leads in cut
// holes (connected to nothing).
function checkStrips({project, parts, nets, wireIndex, report, badEnds, stripShorted}: Board) {
  const board = project.board;
  if (board.type !== "stripboard") return;
  // What the strips join with no wires: pins of one part on one of these nets are shorted by the
  // copper, not joined by a wire on purpose (a 555's pins 4 and 8 often are).
  const copper = computeNets({...project, wires: []});
  const strip = ([c, r]: GridPos) => board.strips === "horizontal" ? `row ${r}` : `column ${c}`;

  for (const part of parts) {
    const byNet = new Map<Net, PlacedPin[]>();
    const seen = new Set<string>();
    for (const pin of part.pins) {
      // Pins sharing a hole are reported as a clash already.
      if (seen.has(holeKey(pin.at))) continue;
      seen.add(holeKey(pin.at));
      // A cut hole has no copper, so no net.
      const net = copper.netAt(pin.at);
      if (!net) {
        report.warn(`${part.ref} pin ${pin.pin} is in cut hole ${showHole(pin.at)}, so it connects to nothing.`);
        continue;
      }
      byNet.set(net, [...(byNet.get(net) ?? []), pin]);
    }
    const shorted = [...byNet.values()].filter(pins => pins.length > 1);
    if (shorted.length) {
      stripShorted.add(part.ref);
      const groups = shorted.map(pins => `pins ${pins.map(p => p.pin).join(" & ")} (${strip(pins[0].at)})`);
      report.warn(`${part.ref}: ${groups.join(", ")} share a strip with no cut between, so they're shorted together. Add cuts between them (board.cuts) or turn the part across the strips.`);
    }
  }
  project.wires.forEach((wire, i) => {
    for (const end of [wire.from, wire.to]) {
      if (nets.netAt(end)) continue;
      report.warn(`${wireName(wireIndex(i))} ends in cut hole ${showHole(end)}, so that end connects to nothing.`);
      badEnds.add(i);
    }
  });
}

// An IC pin marked as not connected inside: "NC", "N.C.", "N/C".
const NO_CONNECT = /^N\.?\/?C\.?$/i;

// Wiring mistakes the nets show. Wires are insulated jumpers joined only at their ends, so wires
// crossing are fine: only noted.
function checkConnections(board: Board) {
  checkWiresOverHoles(board);
  checkShortedParts(board);
  const loose = checkLoosePins(board);
  checkStrayWires(board, loose);
  checkShortedRails(board);
}

// A wire running over a pin it doesn't join (a warning), or over another wire or wire end (a note).
function checkWiresOverHoles({project, nets, wireIndex, report}: Board) {
  const inHole = holeContents(project, nets);
  const wire = (i: number) => wireName(wireIndex(i));
  for (const hop of layoutProjectWires(project).hops) {
    if (hop.over === "wire" && hop.under !== undefined) {
      const at = hop.at.map(n => Math.round(n * 100) / 100) as GridPos;
      report.note(`${wire(hop.wire)} crosses over ${wire(hop.under)} at ${showHole(at)}. That's fine: wires are insulated and join only at their ends.`);
      continue;
    }
    const {pins, wires} = inHole(hop.at);
    if (pins.length) {
      const what = pins.map(pinName).join(" and ");
      report.warn(`${wire(hop.wire)} passes over hole ${showHole(hop.at)}, which holds ${what}, without ending there, so it isn't connected to ${pins.length === 1 ? "it" : "them"}. If it should be, end a wire in that hole.`);
    } else {
      report.note(`${wire(hop.wire)} passes over the end of ${wires.map(wire).join(" and ")} at ${showHole(hop.at)} without joining ${wires.length === 1 ? "it" : "them"}.`);
    }
  }
}

// A two-lead part whose leads are on one net is shorted out: it does nothing. (A chip's or
// module's pins often share a net on purpose, a 555's 2 and 6 say.) A strip shorting them is
// reported already, by checkStrips.
function checkShortedParts({nets, report, stripShorted}: Board) {
  for (const net of nets.nets) {
    const byPart = new Map<string, NetPin[]>();
    for (const pin of net.pins) {
      if (pin.kind === "standard-component") byPart.set(pin.ref, [...(byPart.get(pin.ref) ?? []), pin]);
    }
    for (const [ref, pins] of byPart) {
      if (pins.length < 2 || stripShorted.has(ref)) continue;
      report.warn(`${ref}: both leads (${joinList(pins.map(pinName))}) are on one net, so ${ref} is shorted out and does nothing in the circuit. A wire likely ends in the wrong hole: check the wires on that net.`);
    }
  }
}

// Pins on no net with another pin: a chip's may be unused on purpose, a two-lead part's can't
// be. Other parts' (headers, modules) often are, so they're left out. Returns the pins reported.
function checkLoosePins({project, nets, wireIndex, report}: Board): Set<NetPin> {
  const modules = new Set(project.placedIcs.filter(ic => isModulePart(ic.category, ic.name)).map(ic => ic.ref));
  const loose = nets.nets
    .filter(net => net.pins.length === 1)
    .map(net => net.pins[0])
    // In a cut hole is reported already; a no-connect pin is meant to be left alone.
    .filter(pin => nets.netAt(pin.at) && (pin.kind === "standard-component"
      || pin.kind === "ic" && !modules.has(pin.ref) && !NO_CONNECT.test(pin.label ?? "")))
    .sort(comparePins);
  const byPart = new Map<string, NetPin[]>();
  for (const pin of loose) byPart.set(pin.ref, [...(byPart.get(pin.ref) ?? []), pin]);
  for (const [ref, pins] of byPart) {
    const one = pins.length === 1;
    // Wires ending on them that lead nowhere else.
    const stubs = pins.flatMap(pin => nets.netAt(pin.at)?.wires ?? []).map(i => wireName(wireIndex(i)));
    const stubNote = stubs.length ? ` ${joinList(stubs)} on ${one ? "it" : "them"} lead${stubs.length === 1 ? "s" : ""} to no other pin.` : "";
    if (pins[0].kind === "ic") {
      report.warn(`${ref}: ${pins.map(pinName).join(", ")} ${one ? "is" : "are"} connected to nothing.${stubNote} Wire ${one ? "it" : "them"} up, unless ${one ? "it's" : "they're"} meant to be unused.`);
    } else {
      report.warn(`${ref}: ${joinList(pins.map(pinName))} ${one ? "is" : "are"} connected to nothing, so ${ref} does nothing in the circuit.${stubNote} Wire ${one ? "it to the net it belongs" : "them to the nets they belong"} to.`);
    }
  }
  return new Set(loose);
}

// Wires on no net of two or more pins, unless an end's problem was reported already, or the one
// pin they reach was (as a loose pin).
function checkStrayWires({nets, wireIndex, report, badEnds}: Board, reported: Set<NetPin>) {
  for (const net of nets.nets) {
    if (!net.wires.length || net.pins.length > 1) continue;
    if (net.wires.some(i => badEnds.has(i)) || net.pins.some(pin => reported.has(pin))) continue;
    const one = net.wires.length === 1;
    const list = joinList(net.wires.map(i => wireName(wireIndex(i))));
    const [pin] = net.pins;
    report.warn(pin
      ? `${list} lead${one ? "s" : ""} from ${pinName(pin)} to no other pin. End ${one ? "it" : "them"} on the pin ${pinName(pin)} should connect to, or remove ${one ? "it" : "them"}.`
      : `${list} connect${one ? "s" : ""} no pins, so ${one ? "it does" : "they do"} nothing. End ${one ? "it" : "them"} on the pins ${one ? "it" : "they"} should join, or remove ${one ? "it" : "them"}.`);
  }
}

// A net named after two or more supply rails ("GND/VCC") joins them.
function checkShortedRails({nets, report}: Board) {
  for (const net of nets.nets) {
    if (!isPowerNet(net) || !net.name?.includes("/")) continue;
    const rails = net.name.split("/").filter(name => name !== "…");
    const railPins = net.pins.filter(pin => rails.some(rail => rail.toLowerCase() === pin.label?.toLowerCase()));
    report.warn(`Short circuit: one net joins the supply rails ${rails.slice(0, -1).join(", ")} and ${rails[rails.length - 1]}${net.name.endsWith("…") ? " and more" : ""} (${railPins.map(pinName).join(", ")}). Separate them, unless they're meant to be one rail; get_nets lists all ${plural(net.pins.length, "pin")} on it.`);
  }
}
