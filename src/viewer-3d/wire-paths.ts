import {ViewerWire} from "./project-data";

export interface WirePoint {
  x: number;
  y: number;
}

/** One jumper wire as the user drew it: a run of editor segments joined end to end. `points`
 *  runs from one free end to the other; a closed loop repeats its first point at the end. */
export interface WirePath {
  points: WirePoint[];
  color: string;
  width: number;
  closed: boolean;
}

/** The key the solder registry uses for a hole (see SceneKit.solder). */
export function holeKey(px: number, py: number): string {
  return `${Math.round(px)},${Math.round(py)}`;
}

interface Segment {
  a: WirePoint;
  b: WirePoint;
  ka: string;
  kb: string;
  color: string;
  width: number;
}

/** Joins the editor's segments back into the wires they were drawn as. The editor stores every
 *  bend as two segments sharing a hole, so a hole where exactly two segments of the same color
 *  and width meet is a plain bend and the run continues through it. Any other hole ends the run:
 *  a junction, a color or width change, or a hole a component lead already sits in. */
export function chainWires(wires: ViewerWire[], componentHoles: ReadonlySet<string>): WirePath[] {
  const segments: Segment[] = [];
  for (const wire of wires) {
    if (wire.x1 === wire.x2 && wire.y1 === wire.y2) continue;
    const a = {x: wire.x1, y: wire.y1}, b = {x: wire.x2, y: wire.y2};
    segments.push({a, b, ka: holeKey(a.x, a.y), kb: holeKey(b.x, b.y), color: wire.color, width: wire.width});
  }

  const touching = new Map<string, number[]>();
  segments.forEach((segment, i) => {
    for (const key of [segment.ka, segment.kb]) {
      const list = touching.get(key);
      if (list) list.push(i);
      else touching.set(key, [i]);
    }
  });

  // The segment that carries on past hole `key` from segment `from`, if the hole is a plain bend.
  const continuation = (from: number, key: string): number | undefined => {
    const list = touching.get(key);
    if (!list || list.length !== 2 || componentHoles.has(key)) return undefined;
    const other = list[0] === from ? list[1] : list[0];
    const here = segments[from], there = segments[other];
    return here.color.toLowerCase() === there.color.toLowerCase() && here.width === there.width ? other : undefined;
  };

  // Walks away from hole `key`, an end of segment `from`, collecting each point passed. Reaching
  // a segment already walked means the run has closed into a loop.
  const follow = (from: number, key: string, visited: Set<number>): {points: WirePoint[]; closed: boolean} => {
    const points: WirePoint[] = [];
    let current = from, at = key;
    for (;;) {
      const next = continuation(current, at);
      if (next === undefined) return {points, closed: false};
      if (visited.has(next)) return {points, closed: true};
      visited.add(next);
      const segment = segments[next];
      const far = segment.ka === at ? segment.b : segment.a;
      points.push(far);
      current = next;
      at = segment.ka === at ? segment.kb : segment.ka;
    }
  };

  const visited = new Set<number>();
  const paths: WirePath[] = [];
  segments.forEach((segment, i) => {
    if (visited.has(i)) return;
    visited.add(i);
    const forward = follow(i, segment.kb, visited);
    if (forward.closed) {
      paths.push({points: [segment.a, segment.b, ...forward.points], color: segment.color, width: segment.width, closed: true});
      return;
    }
    const backward = follow(i, segment.ka, visited);
    paths.push({
      points: [...backward.points.reverse(), segment.a, segment.b, ...forward.points],
      color: segment.color, width: segment.width, closed: false,
    });
  });
  return paths;
}
