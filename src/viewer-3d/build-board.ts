import {
  CircleGeometry, Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, LatheGeometry, Matrix4,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, Shape, Vector2, Vector3,
} from "three";
import {BOARD_BOTTOM_Y, BOARD_THICKNESS, BoardFrame, PITCH, SceneKit} from "./scene-kit";
import {CUT_GAP_PITCH, STRIP_WIDTH_PITCH} from "../project-file/stripboard-geometry";
import {ViewerBoard, ViewerDot, ViewerProject} from "./project-data";
import {WirePath} from "./wire-paths";

const PERFBOARD_COLOR = "#0e5a27";
// Stripboards are usually SRBP (paper-based), a warm brown.
const STRIPBOARD_COLOR = "#7a5230";
const COPPER_COLOR = "#c98a4f";
// The editor's untouched dot color; any other color means the user marked that hole.
const DEFAULT_DOT_COLOR = "#a4a0a0";
const HOLE_RADIUS = 0.5;
const PAD_RADIUS = 0.95;
const CORNER_RADIUS = 1.2;
// A stripboard's strips and the gap at each cut, the same sizes the editor draws (in mm here).
// Strips stop just short of the board's rounded edges.
const STRIP_WIDTH = STRIP_WIDTH_PITCH * PITCH;
const CUT_GAP = CUT_GAP_PITCH * PITCH;
const STRIP_END_INSET = 0.4;
// Lifts pads/holes off the faces they sit on so they don't z-fight with the board.
const SURFACE_LIFT = 0.015;

function roundedRect(width: number, depth: number, radius: number): Shape {
  const x = -width / 2, y = -depth / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function instanced(geometry: CircleGeometry | RingGeometry, material: MeshBasicMaterial | MeshStandardMaterial, positions: Vector3[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, positions.length);
  const matrix = new Matrix4();
  positions.forEach((position, i) => mesh.setMatrixAt(i, matrix.makeTranslation(position.x, position.y, position.z)));
  mesh.receiveShadow = true;
  return mesh;
}

function buildSlab(frame: BoardFrame, color: string): Mesh {
  const geometry = new ExtrudeGeometry(roundedRect(frame.width, frame.depth, CORNER_RADIUS), {depth: BOARD_THICKNESS, bevelEnabled: false, curveSegments: 6});
  // The shape is drawn in XY and extruded along +z; lay it flat with the top face at y=0.
  geometry.rotateX(Math.PI / 2);
  const slab = new Mesh(geometry, new MeshStandardMaterial({color, roughness: 0.78}));
  slab.receiveShadow = true;
  return slab;
}

/** Copper rings around holes (in their marked color, if marked) and the holes themselves, on both
 *  faces. A perfboard has a pad at every hole; a stripboard only rings the holes the user marked,
 *  its copper being the strips. */
function buildPadsAndHoles(frame: BoardFrame, dots: ViewerDot[], padEveryHole: boolean): Group {
  const group = new Group();
  const markColor = (dot: ViewerDot) =>
    dot.color && dot.color.toLowerCase() !== DEFAULT_DOT_COLOR ? dot.color : undefined;
  const padded = padEveryHole ? dots : dots.filter(dot => markColor(dot));

  const padMaterial = new MeshStandardMaterial({color: "#ffffff", metalness: 1, roughness: 0.38, side: DoubleSide});
  const holeMaterial = new MeshBasicMaterial({color: "#040604", side: DoubleSide});
  const padGeometry = new RingGeometry(HOLE_RADIUS, PAD_RADIUS, 24).rotateX(-Math.PI / 2);
  const holeGeometry = new CircleGeometry(HOLE_RADIUS, 16).rotateX(-Math.PI / 2);
  const padColors = padded.map(dot => new Color(markColor(dot) ?? COPPER_COLOR));

  for (const faceY of [SURFACE_LIFT, BOARD_BOTTOM_Y - SURFACE_LIFT]) {
    if (padded.length > 0) {
      const pads = instanced(padGeometry, padMaterial, padded.map(dot => frame.point(dot.x, dot.y, faceY)));
      padColors.forEach((color, i) => pads.setColorAt(i, color));
      group.add(pads);
    }
    // Holes sit a hair above their pads' plane so the black disc always wins the depth test.
    const holeY = faceY + Math.sign(faceY || 1) * 0.002;
    group.add(instanced(holeGeometry, holeMaterial, dots.map(dot => frame.point(dot.x, dot.y, holeY))));
  }
  return group;
}

// The stretches of copper along one strip, as [from, to] in mm along it: the whole strip, minus a
// gap at each cut.
function stripRuns(start: number, end: number, cuts: number[]): [number, number][] {
  const runs: [number, number][] = [];
  let from = start;
  for (const cut of [...cuts].sort((a, b) => a - b)) {
    if (cut - CUT_GAP / 2 > from) runs.push([from, cut - CUT_GAP / 2]);
    from = Math.max(from, cut + CUT_GAP / 2);
  }
  if (end > from) runs.push([from, end]);
  return runs;
}

/** A stripboard's copper strips, on its bottom face: one per row (or column) of holes. */
function buildStrips(frame: BoardFrame, board: Extract<ViewerBoard, {type: "stripboard"}>, dots: ViewerDot[]): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({color: COPPER_COLOR, metalness: 1, roughness: 0.38, side: DoubleSide});
  const y = BOARD_BOTTOM_Y - SURFACE_LIFT;
  const horizontal = board.strips === "horizontal";
  // Each strip runs through one line of holes: a row's y, or a column's x (in canvas pixels).
  const lines = Array.from(new Set(dots.map(dot => horizontal ? dot.y : dot.x)));
  const halfLength = (horizontal ? frame.width : frame.depth) / 2 - STRIP_END_INSET;

  for (const line of lines) {
    const cuts = board.cuts
      .filter(cut => (horizontal ? cut.y : cut.x) === line)
      .map(cut => horizontal ? frame.x(cut.x) : frame.z(cut.y));
    for (const [from, to] of stripRuns(-halfLength, halfLength, cuts)) {
      const length = to - from;
      const geometry = horizontal ? new PlaneGeometry(length, STRIP_WIDTH) : new PlaneGeometry(STRIP_WIDTH, length);
      // PlaneGeometry stands in XY; lay it flat, facing down.
      geometry.rotateX(Math.PI / 2);
      const strip = new Mesh(geometry, material);
      const middle = (from + to) / 2;
      strip.position.set(horizontal ? middle : frame.x(line), y, horizontal ? frame.z(line) : middle);
      strip.receiveShadow = true;
      group.add(strip);
    }
  }
  return group;
}

/** The board itself: a rounded slab with a hole at every grid dot, and its copper. A perfboard
 *  has a pad around every hole, on both faces; a stripboard has bare SRBP on top and copper
 *  strips underneath, broken at each cut. */
export function buildBoard(kit: SceneKit, project: ViewerProject): Group {
  const {frame} = kit;
  const {board, dots} = project;
  const group = new Group();
  if (board.type === "stripboard") {
    group.add(buildSlab(frame, STRIPBOARD_COLOR));
    group.add(buildStrips(frame, board, dots));
    group.add(buildPadsAndHoles(frame, dots, false));
  } else {
    group.add(buildSlab(frame, PERFBOARD_COLOR));
    group.add(buildPadsAndHoles(frame, dots, true));
  }
  return group;
}

/** A solder fillet on the underside of every hole something was soldered into. Built last,
 *  once every part has registered its holes with the kit. */
export function buildSolderJoints(kit: SceneKit): InstancedMesh | null {
  const holes = Array.from(kit.solderedHoles.values());
  if (holes.length === 0) return null;
  const profile = [
    new Vector2(PAD_RADIUS, 0),
    new Vector2(0.86, 0.18),
    new Vector2(0.66, 0.42),
    new Vector2(0.46, 0.68),
    new Vector2(0.34, 0.92),
    new Vector2(0, 1.0),
  ];
  // Lathe builds upward from the pad; flip it to hang down from the bottom face.
  const geometry = new LatheGeometry(profile, 20).rotateX(Math.PI);
  const material = new MeshStandardMaterial({color: "#d7dbe0", metalness: 1, roughness: 0.22});
  return instanced(geometry as unknown as CircleGeometry, material, holes.map(h => new Vector3(h.x, BOARD_BOTTOM_Y - SURFACE_LIFT, h.z)));
}

/** Insulated jumper wires lying on the top face. Each wire is one continuous insulated run, so
 *  its bends are just insulation; only its two free ends dive into their holes as bare tinned
 *  copper and get soldered. Thickness follows the editor's thin/normal/thick gauges. */
export function buildWires(kit: SceneKit, paths: WirePath[]): Group {
  const {frame} = kit;
  const group = new Group();
  const conductor = kit.standard("wire-conductor", {color: "#d0d4d8", metalness: 1, roughness: 0.3});
  for (const path of paths) {
    const radius = 0.25 + path.width * 0.09;
    const insulation = kit.standard(`wire:${path.color}`, {color: path.color, roughness: 0.45});
    const points = path.points.map(p => frame.point(p.x, p.y, radius));
    group.add(kit.bentWire(points, radius, insulation));
    if (path.closed) {
      // A loop has no free ends; round off the one corner bentWire leaves out.
      group.add(kit.ball(points[0], radius, insulation));
      continue;
    }
    const ends = [path.points[0], path.points[path.points.length - 1]];
    for (const {x: px, y: py} of ends) {
      group.add(kit.ball(frame.point(px, py, radius), radius, insulation));
      const stub = kit.rod(frame.point(px, py, radius), frame.point(px, py, BOARD_BOTTOM_Y - 1.1), radius * 0.45, conductor);
      if (stub) group.add(stub);
      kit.solder(px, py);
    }
  }
  return group;
}
