import {comparePins, GridPos, Netlist, NetPin, pinName, ProjectFile, WireLayout} from "./editor";
import {holeKey, wireName} from "./text";

// The board's nets and wire crossings as get_nets reports them: pins by the names agents write
// ("U1.8 VCC", "D1.K", "R1.1") and wires by their place in the file. Worked out by the shared
// nets.ts and wire-crossings.ts, the editor's own code for its Nets panel and canvas; this only
// names things.

// Where each wire is in the file as given (the reader may have left some entries out).
export type WireIndex = (i: number) => number;

const round = (n: number) => Math.round(n * 100) / 100;

// What's in a hole: pins, and the wires ending there.
export function holeContents(project: ProjectFile, netlist: Netlist): (at: readonly number[]) => {pins: NetPin[]; wires: number[]} {
  const pins = new Map<string, NetPin[]>();
  for (const pin of netlist.nets.flatMap(net => net.pins).sort(comparePins)) pins.set(holeKey(pin.at), [...(pins.get(holeKey(pin.at)) ?? []), pin]);
  const wires = new Map<string, number[]>();
  project.wires.forEach((wire, i) => {
    for (const end of new Set([holeKey(wire.from), holeKey(wire.to)])) wires.set(end, [...(wires.get(end) ?? []), i]);
  });
  return at => ({pins: pins.get(holeKey(at)) ?? [], wires: wires.get(holeKey(at)) ?? []});
}

export interface NetsReport {
  // Nets joining two or more pins.
  nets: {name?: string; pins: string[]; wires: number[]}[];
  // Pins on no net with another pin.
  unconnected: string[];
  // Wires on no net of two or more pins: they connect nothing.
  strayWires?: number[];
  // Holes where three or more things are joined.
  junctions: {at: GridPos; joins: string[]}[];
  // Where a wire goes over another wire, or over a hole, without joining it.
  crossings: ({wire: number; at: [number, number]; over: "wire"; under: number} | {wire: number; at: GridPos; over: "hole"; holds: string[]})[];
}

export function netsReport(project: ProjectFile, netlist: Netlist, layout: WireLayout, wireIndex: WireIndex): NetsReport {
  const inHole = holeContents(project, netlist);
  const names = (at: readonly number[]) => {
    const {pins, wires} = inHole(at);
    return [...pins.map(pinName), ...wires.map(i => wireName(wireIndex(i)))];
  };
  const connected = netlist.nets.filter(net => net.pins.length > 1);
  const stray = netlist.nets.filter(net => net.pins.length < 2).flatMap(net => net.wires).map(wireIndex).sort((a, b) => a - b);
  return {
    nets: connected.map(net => ({...(net.name ? {name: net.name} : {}), pins: net.pins.map(pinName), wires: net.wires.map(wireIndex)})),
    unconnected: netlist.nets.filter(net => net.pins.length === 1).map(net => net.pins[0]).sort(comparePins).map(pinName),
    ...(stray.length ? {strayWires: stray} : {}),
    junctions: layout.junctions.map(at => ({at, joins: names(at)})),
    crossings: layout.hops.map(hop => hop.over === "wire" && hop.under !== undefined
      ? {wire: wireIndex(hop.wire), at: [round(hop.at[0]), round(hop.at[1])], over: "wire" as const, under: wireIndex(hop.under)}
      : {wire: wireIndex(hop.wire), at: hop.at, over: "hole" as const, holds: names(hop.at)}),
  };
}
