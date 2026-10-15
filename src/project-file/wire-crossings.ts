import {GridPos} from "./grid";
import {ProjectFile} from "./project-file";
import {partPins} from "./pin-positions";

// Where wires pass over things without joining them, and where things do join: what the 2D and
// 3D views draw so a crossing never passes for a joint. A wire joins only the holes at its two
// ends (see nets.ts), so a wire running across another wire, or over a hole holding a pin, a lead
// or another wire's end, goes over it. Of two wires crossing between their ends, the later one in
// the list is on top: the order the editor draws them in.

export interface WireEnds {
  from: GridPos;
  to: GridPos;
}

// One place a wire goes over something.
export interface WireHop {
  // The wire on top, by index.
  wire: number;
  // Where, in grid units: a hole, or a point between holes where two wires cross.
  at: [number, number];
  // Another wire's run (`under`, its index), or a hole holding a pin, a lead or a wire's end.
  over: "wire" | "hole";
  under?: number;
}

export interface WireLayout {
  // By wire, then along it from its `from` end.
  hops: WireHop[];
  // Holes where three or more things are joined: wire ends, and a pin if there is one.
  junctions: GridPos[];
}

const key = ([c, r]: GridPos) => `${c},${r}`;
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;

// Where two wires cross strictly between their ends, with how far along `b` (0 to 1). A wire
// ending on the other isn't a crossing (it passes over that end's hole), and parallel wires never
// cross: one lying along the other passes over its end holes.
function interiorCrossing(a: WireEnds, b: WireEnds): {at: [number, number]; along: number} | undefined {
  const [ax, ay] = a.from;
  const [bx, by] = b.from;
  const rx = a.to[0] - ax, ry = a.to[1] - ay;
  const sx = b.to[0] - bx, sy = b.to[1] - by;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return undefined;
  const t = ((bx - ax) * sy - (by - ay) * sx) / denom;
  const u = ((bx - ax) * ry - (by - ay) * rx) / denom;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return undefined;
  return {at: [ax + t * rx, ay + t * ry], along: u};
}

export function layoutWires(wires: WireEnds[], pinHoles: GridPos[]): WireLayout {
  const pins = new Set(pinHoles.map(key));
  const ends = new Map<string, number>();
  for (const wire of wires) {
    for (const end of [wire.from, wire.to]) ends.set(key(end), (ends.get(key(end)) ?? 0) + 1);
  }

  const hops: (WireHop & {along: number})[] = [];
  wires.forEach((wire, i) => {
    const [x1, y1] = wire.from;
    const [x2, y2] = wire.to;
    const steps = gcd(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let k = 1; k < steps; k++) {
      const hole: GridPos = [x1 + (x2 - x1) / steps * k, y1 + (y2 - y1) / steps * k];
      if (pins.has(key(hole)) || ends.has(key(hole))) hops.push({wire: i, at: hole, over: "hole", along: k / steps});
    }
  });
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const crossing = interiorCrossing(wires[i], wires[j]);
      if (crossing) hops.push({wire: j, at: crossing.at, over: "wire", under: i, along: crossing.along});
    }
  }
  hops.sort((a, b) => a.wire - b.wire || a.along - b.along);

  const junctions = [...ends.entries()]
    .filter(([hole, count]) => count + (pins.has(hole) ? 1 : 0) >= 3)
    .map(([hole]) => hole.split(",").map(Number) as GridPos);
  return {
    hops: hops.map(hop => ({wire: hop.wire, at: hop.at, over: hop.over, ...(hop.under !== undefined ? {under: hop.under} : {})})),
    junctions,
  };
}

export function layoutProjectWires(project: ProjectFile): WireLayout {
  return layoutWires(project.wires, partPins(project).flatMap(part => part.pins.map(pin => pin.at)));
}
