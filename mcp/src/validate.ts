import {GridPos} from "../../src/project-file/grid";
import {ProjectFile} from "../../src/project-file/project-file";
import {ProjectFileError, readProjectFile} from "../../src/project-file/read-project-file";
import {Box, PartPins, partPins} from "../../src/project-file/pin-positions";
import {similarPartIds} from "./parts";

// Checks a project file the way a person looking at the board would: beyond what the reader
// accepts (it quietly skips what it can't read), it names each problem and where it is, so an
// agent can fix it and try again. Errors make a board wrong; warnings are likely mistakes.

export interface Problem {
  severity: "error" | "warning";
  message: string;
}

export interface Validation {
  // No errors (warnings allowed).
  ok: boolean;
  // The project as the editor will read it (refs filled in, unreadable entries left out).
  project?: ProjectFile;
  problems: Problem[];
}

const PART_LISTS = ["placedIcs", "placedStandardComponents", "placedAdvancedComponents"] as const;
const LISTS = ["pads", "wires", ...PART_LISTS, "customIcs"] as const;
type ListName = typeof LISTS[number];

type Entry = Record<string, unknown>;
const asEntry = (value: unknown): Entry | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Entry : undefined;
const key = ([c, r]: GridPos) => `${c},${r}`;
const show = ([c, r]: GridPos) => `[${c}, ${r}]`;

export function validateProject(raw: unknown): Validation {
  const problems: Problem[] = [];
  const error = (message: string) => problems.push({severity: "error", message});
  const warn = (message: string) => problems.push({severity: "warning", message});

  let project: ProjectFile;
  let skipped: number;
  try {
    ({project, skipped} = readProjectFile(raw));
  } catch (err) {
    error(err instanceof ProjectFileError
      ? `${err.message} A project needs at least {"version": 3, "board": {"type": "perfboard", "cols": <n>, "rows": <n>}}.`
      : `It couldn't be read: ${String(err)}`);
    return {ok: false, problems};
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
    error(`Hole [${hole.replace(",", ", ")}] is used twice: ${users.map(u => u.what).join(" and ")}.`);
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
  project.wires.forEach((wire, i) => {
    if (key(wire.from) === key(wire.to)) error(`wires[${wireIndex(i)}] starts and ends in hole ${show(wire.from)}.`);
    for (const end of [wire.from, wire.to]) {
      const body = holes.get(key(end))?.find(u => u.what.startsWith("the body"));
      if (body) error(`wires[${wireIndex(i)}] ends at ${show(end)}, which is under ${body.what}.`);
      else if (project.board.type === "perfboard" && !pinHoles.has(key(end)) && (wireEnds.get(key(end)) ?? 0) < 2) {
        warn(`wires[${wireIndex(i)}] ends at ${show(end)}, which has no pin and no other wire: that end connects to nothing.`);
      }
    }
  });

  if (project.board.type === "stripboard") checkStrips(project, parts, warn, wireIndex);

  return {ok: !problems.some(p => p.severity === "error"), project, problems};
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
function checkStrips(project: ProjectFile, parts: PartPins[], warn: (message: string) => void, wireIndex: (i: number) => number) {
  const board = project.board;
  if (board.type !== "stripboard") return;
  const cuts = new Set(board.cuts.map(key));
  const horizontal = board.strips === "horizontal";
  // The strip segment a hole is on: its strip, and how many cuts come before it along the strip.
  const segment = ([c, r]: GridPos): string | undefined => {
    if (cuts.has(key([c, r]))) return undefined;
    const before = board.cuts.filter(([cc, cr]) => horizontal ? cr === r && cc < c : cc === c && cr < r).length;
    return horizontal ? `row ${r}#${before}` : `column ${c}#${before}`;
  };

  for (const part of parts) {
    const bySegment = new Map<string, number[]>();
    const seen = new Set<string>();
    for (const pin of part.pins) {
      // Pins sharing a hole are reported as a clash already.
      if (seen.has(key(pin.at))) continue;
      seen.add(key(pin.at));
      const seg = segment(pin.at);
      if (seg === undefined) {
        warn(`${part.ref} pin ${pin.pin} is in cut hole ${show(pin.at)}, so it connects to nothing.`);
        continue;
      }
      bySegment.set(seg, [...(bySegment.get(seg) ?? []), pin.pin]);
    }
    const shorted = [...bySegment.entries()].filter(([, pins]) => pins.length > 1);
    if (shorted.length) {
      const groups = shorted.map(([seg, pins]) => `pins ${pins.join(" & ")} (${seg.split("#")[0]})`);
      warn(`${part.ref}: ${groups.join(", ")} share a strip with no cut between, so they're shorted together. Add cuts between them (board.cuts) or turn the part across the strips.`);
    }
  }
  project.wires.forEach((wire, i) => {
    for (const end of [wire.from, wire.to]) {
      if (cuts.has(key(end))) warn(`wires[${wireIndex(i)}] ends in cut hole ${show(end)}, so that end connects to nothing.`);
    }
  });
}
