import {GridPos} from "./grid";
import {ProjectFile} from "./project-file";
import {PartKind, partPins} from "./pin-positions";

// Which pins are connected to which: the board's nets, worked out from a project file and nothing
// else, so the editor (from its save snapshot) and the MCP server always agree. Nets are derived,
// never saved in the file.
//
// What connects: a wire joins the holes at its two ends, never the holes it passes over; things in
// the same hole are joined (one pad); on a stripboard every hole along a strip is joined up to the
// next cut. A cut hole has no copper, so whatever is in it connects to nothing there.

export interface NetPin {
  ref: string;
  kind: PartKind;
  pin: number;
  // A chip's pin name ("VCC"), a part's pin label, or which lead of a polarized part it is ("K",
  // "+").
  label?: string;
  at: GridPos;
}

export interface Net {
  // Taken from its pins' names, e.g. "GND" or "TRIG/THRESH"; absent when none is named.
  name?: string;
  // In ref then pin order. Empty for wires that connect no pins.
  pins: NetPin[];
  // Indexes into the project's wires.
  wires: number[];
  // Holes with a pin or a wire end on the net (not every hole along its strips).
  holes: GridPos[];
}

export interface Netlist {
  // Every group of connected pins and wires, unconnected single pins included: power nets first,
  // then by their first pin, then nets of wires alone.
  nets: Net[];
  // The net that hole is on, if anything on the board connects to it there.
  netAt(at: GridPos): Net | undefined;
}

const key = ([c, r]: GridPos) => `${c},${r}`;

// Supply rails by their usual names, so a net is named after its rail rather than, say, a RESET
// pin tied to it.
const POWER_NAME = /^([ADP]?GND|V(CC|DD|SS|EE|IN|BAT|BUS)\d*|V[+-]|[+-]?\d+(\.\d+)?V|\d+V\d+)$/i;

const isPowerName = (name: string) => POWER_NAME.test(name);

// A name listing more than three, cut short: "GND/VCC/VDD/…".
const MORE = "…";

// A supply rail. One named after two rails ("GND/VCC") shorts them together.
export function isPowerNet(net: Net): boolean {
  return !!net.name && net.name.split("/").every(name => name === MORE || isPowerName(name));
}

export function comparePins(a: NetPin, b: NetPin): number {
  return a.ref.localeCompare(b.ref, undefined, {numeric: true, sensitivity: "base"}) || a.pin - b.pin;
}

// A pin as people and programs name it: "D1.K" for a polarized lead, else "U1.8".
export function pinId(pin: NetPin): string {
  return pin.kind === "standard-component" && pin.label ? `${pin.ref}.${pin.label}` : `${pin.ref}.${pin.pin}`;
}

// With its name when it has one: "U1.8 VCC", "D1.K", "R1.1".
export function pinName(pin: NetPin): string {
  return pin.label && pin.kind !== "standard-component" ? `${pinId(pin)} ${pin.label}` : pinId(pin);
}

// A polarized part's lead label ("K", "+", a battery's "−") says which lead it is, not what the
// net is.
const POLARITY_MARK = /^[+\-−]$/;

function netName(pins: NetPin[]): string | undefined {
  const names = pins
    .filter(p => p.kind !== "standard-component")
    .map(p => p.label?.trim() ?? "")
    .filter(name => name && !POLARITY_MARK.test(name));
  const distinct = names.filter((name, i) => names.findIndex(n => n.toLowerCase() === name.toLowerCase()) === i);
  // Every rail on it, so a short between two shows in the name.
  const power = distinct.filter(isPowerName);
  const shown = power.length ? power : distinct;
  if (!shown.length) return undefined;
  return shown.length > 3 ? `${shown.slice(0, 3).join("/")}/${MORE}` : shown.join("/");
}

export function computeNets(project: ProjectFile): Netlist {
  const board = project.board;
  const cuts = new Set(board.type === "stripboard" ? board.cuts.map(key) : []);

  const parent = new Map<string, string>();
  const find = (node: string): string => {
    let root = node;
    for (let up = parent.get(root); up !== undefined && up !== root; up = parent.get(root)) root = up;
    parent.set(node, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  // Something in a cut hole is a node of its own, joined to nothing else in the hole.
  let isolated = 0;
  const nodeAt = (at: GridPos) => cuts.has(key(at)) ? `cut#${isolated++}` : key(at);

  if (board.type === "stripboard") {
    const horizontal = board.strips === "horizontal";
    const along = horizontal ? board.cols : board.rows;
    const across = horizontal ? board.rows : board.cols;
    for (let line = 0; line < across; line++) {
      for (let i = 1; i < along; i++) {
        const prev: GridPos = horizontal ? [i - 1, line] : [line, i - 1];
        const here: GridPos = horizontal ? [i, line] : [line, i];
        if (!cuts.has(key(prev)) && !cuts.has(key(here))) union(key(prev), key(here));
      }
    }
  }

  const wireNodes = project.wires.map(wire => {
    const from = nodeAt(wire.from);
    union(from, nodeAt(wire.to));
    return from;
  });

  const pinNodes: {pin: NetPin; node: string}[] = [];
  for (const part of partPins(project)) {
    for (const {pin, label, at} of part.pins) {
      pinNodes.push({pin: {ref: part.ref, kind: part.kind, pin, ...(label ? {label} : {}), at}, node: nodeAt(at)});
    }
  }

  const byRoot = new Map<string, Net>();
  const netFor = (node: string): Net => {
    const root = find(node);
    let net = byRoot.get(root);
    if (!net) byRoot.set(root, net = {pins: [], wires: [], holes: []});
    return net;
  };
  const holeSeen = new Set<string>();
  const addHole = (net: Net, at: GridPos) => {
    if (cuts.has(key(at)) || holeSeen.has(key(at))) return;
    holeSeen.add(key(at));
    net.holes.push(at);
  };
  for (const {pin, node} of pinNodes) {
    const net = netFor(node);
    net.pins.push(pin);
    addHole(net, pin.at);
  }
  project.wires.forEach((wire, i) => {
    const net = netFor(wireNodes[i]);
    net.wires.push(i);
    addHole(net, wire.from);
    addHole(net, wire.to);
  });

  const nets = [...byRoot.values()];
  for (const net of nets) {
    net.pins.sort(comparePins);
    const name = netName(net.pins);
    if (name) net.name = name;
  }
  const rank = (net: Net) => !net.pins.length ? 2 : isPowerNet(net) ? 0 : 1;
  nets.sort((a, b) => rank(a) - rank(b) || (a.pins.length && b.pins.length ? comparePins(a.pins[0], b.pins[0]) : a.wires[0] - b.wires[0]));

  return {
    nets,
    netAt(at) {
      if (cuts.has(key(at)) || !parent.has(key(at))) return undefined;
      return byRoot.get(find(key(at)));
    },
  };
}
