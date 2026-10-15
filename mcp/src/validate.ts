import {GridPos} from "../../src/project-file/grid";
import {ProjectFile} from "../../src/project-file/project-file";
import {ProjectFileError, readProjectFile} from "../../src/project-file/read-project-file";
import {Box, PartPins, partPins, PlacedPin} from "../../src/project-file/pin-positions";
import {comparePins, computeNets, isPowerNet, Net, Netlist, NetPin, pinName} from "../../src/project-file/nets";
import {layoutProjectWires} from "../../src/project-file/wire-crossings";
import {isModulePart} from "../../src/project-file/ic-package";
import {similarPartIds} from "./parts";
import {holeContents, joinList, WireIndex, wireName} from "./nets-report";
import {checkExpectedNets} from "./expected-nets";

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
  // Where each of project.wires is in the file as given.
  wireIndex: WireIndex;
  problems: Problem[];
  notes: string[];
}

const PART_LISTS = ["placedIcs", "placedStandardComponents", "placedAdvancedComponents"] as const;
const LISTS = ["pads", "wires", ...PART_LISTS, "customIcs"] as const;
type ListName = typeof LISTS[number];

type Entry = Record<string, unknown>;
const asEntry = (value: unknown): Entry | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Entry : undefined;
const key = ([c, r]: GridPos) => `${c},${r}`;
const show = ([c, r]: GridPos) => `[${c}, ${r}]`;

// expectNets: the nets the board should make, as lists of "REF.pin" names (see expected-nets.ts).
export function validateProject(raw: unknown, expectNets?: string[][]): Validation {
  const problems: Problem[] = [];
  const notes: string[] = [];
  const error = (message: string) => problems.push({severity: "error", message});
  const warn = (message: string) => problems.push({severity: "warning", message});
  const note = (message: string) => notes.push(message);

  let project: ProjectFile;
  let skipped: number;
  try {
    ({project, skipped} = readProjectFile(raw));
  } catch (err) {
    error(err instanceof ProjectFileError
      ? `${err.message} A project needs at least {"version": 3, "board": {"type": "perfboard", "cols": <n>, "rows": <n>}}.`
      : `It couldn't be read: ${String(err)}`);
    return {ok: false, wireIndex: i => i, problems, notes};
  }

  const data = asEntry(raw) ?? {};
  if (data.version === undefined && asEntry(data.board)) warn('There\'s no "version": it was read as version 3. Add "version": 3.');
  const unreadable = reportUnreadableEntries(data, project, error);
  skipped -= unreadable.named;
  // Messages point at entries by their place in the file as given, before any were left out.
  const wireIndex = (i: number) => unreadable.kept.wires?.[i] ?? i;
  if (skipped > 0) warn(`${skipped} more entr${skipped === 1 ? "y" : "ies"} couldn't be read and ${skipped === 1 ? "was" : "were"} left out.`);
  reportRenamedRefs(data, project, warn);

  const {cols, rows} = project.board;
  const onBoard = ([c, r]: GridPos) => c >= 0 && c < cols && r >= 0 && r < rows;
  const parts = partPins(project);

  for (const part of parts) {
    if (!part.known) {
      const hints = similarPartIds(part.part);
      error(`${part.ref}: unknown definitionId "${part.part}"${hints.length ? ` (did you mean ${hints.map(h => `"${h}"`).join(", ")}?)` : ""}. Use list_parts for valid ids.`);
    }
    for (const pin of part.pins) {
      if (!onBoard(pin.at)) error(`${part.ref} pin ${pin.pin} lands at ${show(pin.at)}, off the ${cols}×${rows} board (columns 0-${cols - 1}, rows 0-${rows - 1}).`);
    }
  }
  project.placedStandardComponents.forEach(part => {
    if (key(part.from) === key(part.to)) error(`${part.ref}: both leads are in hole ${show(part.from)}; \`from\` and \`to\` must differ.`);
  });

  // What's in each hole: pins, and holes a part's body covers.
  const holes = new Map<string, {part: PartPins; what: string}[]>();
  const put = (at: GridPos, part: PartPins, what: string) => {
    const list = holes.get(key(at)) ?? [];
    list.push({part, what});
    holes.set(key(at), list);
  };
  for (const part of parts) {
    for (const pin of part.pins) put(pin.at, part, `${part.ref} pin ${pin.pin}${pin.label ? ` (${pin.label})` : ""}`);
    for (const at of part.coveredHoles) put(at, part, `the body of ${part.ref}`);
  }
  const clashing = new Set<string>();
  for (const [hole, users] of holes) {
    const partsHere = new Set(users.map(u => u.part));
    if (partsHere.size < 2) continue;
    users.forEach(a => users.forEach(b => clashing.add(`${a.part.ref}|${b.part.ref}`)));
    error(`Hole [${hole.replace(",", ", ")}] is used twice: ${users.map(u => u.what).join(" and ")}. A hole takes one part's pin or lead: move one, and to connect them, run a wire between their pins.`);
  }
  const overlaps = (a: Box, b: Box) =>
    a.left < b.right - 0.01 && b.left < a.right - 0.01 && a.top < b.bottom - 0.01 && b.top < a.bottom - 0.01;
  parts.forEach((a, i) => parts.slice(i + 1).forEach(b => {
    if (a.body && b.body && !clashing.has(`${a.ref}|${b.ref}`) && overlaps(a.body, b.body)) {
      warn(`${a.ref} and ${b.ref} overlap: their bodies would sit on top of each other.`);
    }
  }));

  const pinHoles = new Set(parts.flatMap(part => part.pins.map(pin => key(pin.at))));
  const wireEnds = new Map<string, number>();
  for (const wire of project.wires) for (const end of [wire.from, wire.to]) wireEnds.set(key(end), (wireEnds.get(key(end)) ?? 0) + 1);
  // Wires with a problem at an end reported already, so they aren't reported again as stray.
  const badEnds = new Set<number>();
  project.wires.forEach((wire, i) => {
    if (key(wire.from) === key(wire.to)) {
      error(`wires[${wireIndex(i)}] starts and ends in hole ${show(wire.from)}.`);
      badEnds.add(i);
    }
    for (const end of [wire.from, wire.to]) {
      const body = holes.get(key(end))?.find(u => u.what.startsWith("the body"));
      if (body) {
        error(`wires[${wireIndex(i)}] ends at ${show(end)}, which is under ${body.what}.`);
        badEnds.add(i);
      } else if (project.board.type === "perfboard" && !pinHoles.has(key(end)) && (wireEnds.get(key(end)) ?? 0) < 2) {
        warn(`wires[${wireIndex(i)}] ends at ${show(end)}, which has no pin and no other wire: that end connects to nothing.`);
        badEnds.add(i);
      }
    }
  });

  const nets = computeNets(project);
  if (project.board.type === "stripboard") checkStrips(project, parts, nets, warn, wireIndex, badEnds);
  checkConnections(project, nets, warn, note, wireIndex, badEnds);
  if (expectNets) checkExpectedNets(nets, expectNets, error);

  return {ok: !problems.some(p => p.severity === "error"), project, wireIndex, problems, notes};
}

// Entries the reader dropped, each read on its own to find which, with a reason. Returns how
// many it named, so the caller can mention any it couldn't place (a version 1 file's), and the
// file positions of the entries kept in each list.
function reportUnreadableEntries(
  data: Entry, project: ProjectFile, error: (message: string) => void
): {named: number; kept: Partial<Record<ListName, number[]>>} {
  const kept: Partial<Record<ListName, number[]>> = {};
  const board = asEntry(data.board);
  if (!board) return {named: 0, kept};
  const version = data.version === 2 ? 2 : 3;
  const {cols, rows} = project.board;
  let named = 0;

  const position = (name: string, value: unknown): string | undefined => {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger)) return `\`${name}\` must be a [column, row] pair of whole numbers`;
    const [c, r] = value as number[];
    if (c < 0 || c >= cols || r < 0 || r >= rows) return `\`${name}\` ${show([c, r])} is off the ${cols}×${rows} board (columns 0-${cols - 1}, rows 0-${rows - 1})`;
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

  for (const list of LISTS) {
    const entries = Array.isArray(data[list]) ? data[list] as unknown[] : [];
    entries.forEach((item, i) => {
      const probe = {version, board: {...board, cuts: []}, [list]: [item]};
      let dropped: boolean;
      try {
        dropped = readProjectFile(probe).skipped > 0;
      } catch {
        dropped = true;
      }
      if (dropped) {
        named++;
        error(`${list}[${i}] was left out: ${why(list, asEntry(item))}.`);
      } else {
        (kept[list] ??= []).push(i);
      }
    });
  }
  if (Array.isArray(board.cuts)) {
    (board.cuts as unknown[]).forEach((cut, i) => {
      const reason = position("cut", cut);
      if (reason) {
        named++;
        error(`board.cuts[${i}] was left out: ${reason}.`);
      }
    });
  }
  return {named, kept};
}

// Refs the reader had to change: malformed, or already taken by an earlier part.
function reportRenamedRefs(data: Entry, project: ProjectFile, warn: (message: string) => void) {
  for (const list of PART_LISTS) {
    const kept = (Array.isArray(data[list]) ? data[list] as unknown[] : []).map(asEntry).filter((entry): entry is Entry => {
      if (!entry) return false;
      try {
        return readProjectFile({version: data.version === 2 ? 2 : 3, board: {...asEntry(data.board), cuts: []}, [list]: [entry]}).skipped === 0;
      } catch {
        return false;
      }
    });
    (project[list] as {ref: string}[]).forEach((part, i) => {
      const given = kept[i]?.ref;
      if (typeof given === "string" && given.trim() && given !== part.ref) {
        warn(`${list}[${i}]: ref "${given}" ${/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(given) ? "is already used by another part" : "isn't a valid ref (a letter, then letters, digits, _ or -)"}, so it became ${part.ref}.`);
      }
    });
  }
}

// Stripboard mistakes: two pins of one part left on the same strip (shorted), and leads in cut
// holes (connected to nothing).
function checkStrips(project: ProjectFile, parts: PartPins[], nets: Netlist, warn: (message: string) => void, wireIndex: WireIndex, badEnds: Set<number>) {
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
      if (seen.has(key(pin.at))) continue;
      seen.add(key(pin.at));
      // A cut hole has no copper, so no net.
      const net = copper.netAt(pin.at);
      if (!net) {
        warn(`${part.ref} pin ${pin.pin} is in cut hole ${show(pin.at)}, so it connects to nothing.`);
        continue;
      }
      byNet.set(net, [...(byNet.get(net) ?? []), pin]);
    }
    const shorted = [...byNet.values()].filter(pins => pins.length > 1);
    if (shorted.length) {
      const groups = shorted.map(pins => `pins ${pins.map(p => p.pin).join(" & ")} (${strip(pins[0].at)})`);
      warn(`${part.ref}: ${groups.join(", ")} share a strip with no cut between, so they're shorted together. Add cuts between them (board.cuts) or turn the part across the strips.`);
    }
  }
  project.wires.forEach((wire, i) => {
    for (const end of [wire.from, wire.to]) {
      if (nets.netAt(end)) continue;
      warn(`wires[${wireIndex(i)}] ends in cut hole ${show(end)}, so that end connects to nothing.`);
      badEnds.add(i);
    }
  });
}

// An IC pin marked as not connected inside: "NC", "N.C.", "N/C".
const NO_CONNECT = /^N\.?\/?C\.?$/i;

// Wiring mistakes the nets show: a wire running over a pin it doesn't join, IC pins and leads left
// unconnected, wires that join no pins, supply rails shorted together. Wires are insulated
// jumpers joined only at their ends, so wires crossing are fine: only noted.
function checkConnections(
  project: ProjectFile, nets: Netlist, warn: (message: string) => void, note: (message: string) => void, wireIndex: WireIndex, badEnds: Set<number>
) {
  const inHole = holeContents(project, nets);
  const wire = (i: number) => wireName(wireIndex(i));

  for (const hop of layoutProjectWires(project).hops) {
    if (hop.over === "wire" && hop.under !== undefined) {
      const at = hop.at.map(n => Math.round(n * 100) / 100) as GridPos;
      note(`${wire(hop.wire)} crosses over ${wire(hop.under)} at ${show(at)}. That's fine: wires are insulated and join only at their ends.`);
      continue;
    }
    const {pins, wires} = inHole(hop.at);
    if (pins.length) {
      const what = pins.map(pinName).join(" and ");
      warn(`${wire(hop.wire)} passes over hole ${show(hop.at)}, which holds ${what}, without ending there, so it isn't connected to ${pins.length === 1 ? "it" : "them"}. If it should be, end a wire in that hole.`);
    } else {
      note(`${wire(hop.wire)} passes over the end of ${wires.map(wire).join(" and ")} at ${show(hop.at)} without joining ${wires.length === 1 ? "it" : "them"}.`);
    }
  }

  // Pins on no net with another pin: a chip's may be unused on purpose, a two-lead part's can't
  // be. Other parts' (headers, modules) often are, so they're left out.
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
    const stubs = pins.flatMap(pin => nets.netAt(pin.at)?.wires ?? []).map(wire);
    const stubNote = stubs.length ? ` ${joinList(stubs)} on ${one ? "it" : "them"} lead${stubs.length === 1 ? "s" : ""} to no other pin.` : "";
    if (pins[0].kind === "ic") {
      warn(`${ref}: ${pins.map(pinName).join(", ")} ${one ? "is" : "are"} connected to nothing.${stubNote} Wire ${one ? "it" : "them"} up, unless ${one ? "it's" : "they're"} meant to be unused.`);
    } else {
      warn(`${ref}: ${joinList(pins.map(pinName))} ${one ? "is" : "are"} connected to nothing, so ${ref} does nothing in the circuit.${stubNote} Wire ${one ? "it to the net it belongs" : "them to the nets they belong"} to.`);
    }
  }

  // Wires on no net of two or more pins, unless an end's problem was reported already, or the one
  // pin they reach was just now.
  const reported = new Set(loose);
  for (const net of nets.nets) {
    if (!net.wires.length || net.pins.length > 1) continue;
    if (net.wires.some(i => badEnds.has(i)) || net.pins.some(pin => reported.has(pin))) continue;
    const one = net.wires.length === 1;
    const list = joinList(net.wires.map(wire));
    const [pin] = net.pins;
    warn(pin
      ? `${list} lead${one ? "s" : ""} from ${pinName(pin)} to no other pin. End ${one ? "it" : "them"} on the pin ${pinName(pin)} should connect to, or remove ${one ? "it" : "them"}.`
      : `${list} connect${one ? "s" : ""} no pins, so ${one ? "it does" : "they do"} nothing. End ${one ? "it" : "them"} on the pins ${one ? "it" : "they"} should join, or remove ${one ? "it" : "them"}.`);
  }

  for (const net of nets.nets) {
    if (!isPowerNet(net) || !net.name?.includes("/")) continue;
    const rails = net.name.split("/").filter(name => name !== "…");
    const railPins = net.pins.filter(pin => rails.some(rail => rail.toLowerCase() === pin.label?.toLowerCase()));
    warn(`Short circuit: one net joins the supply rails ${rails.slice(0, -1).join(", ")} and ${rails[rails.length - 1]}${net.name.endsWith("…") ? " and more" : ""} (${railPins.map(pinName).join(", ")}). Separate them, unless they're meant to be one rail; get_nets lists all ${net.pins.length} pins on it.`);
  }
}
