import {
  CircleGeometry, Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, LatheGeometry, Matrix4,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, Shape, Vector2, Vector3,
} from "three";
import {BOARD_BOTTOM_Y, BOARD_THICKNESS, SceneKit} from "./scene-kit";
import {ViewerDot} from "./project-data";
import {WirePath} from "./wire-paths";

const BOARD_COLOR = "#0e5a27";
const COPPER_COLOR = "#c98a4f";
// The editor's untouched dot color; any other color means the user marked that hole.
const DEFAULT_DOT_COLOR = "#a4a0a0";
const HOLE_RADIUS = 0.5;
const PAD_RADIUS = 0.95;
const CORNER_RADIUS = 1.2;
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

/** The perfboard itself: a rounded FR-4 slab with a copper pad and a hole at every grid dot,
 *  on both faces. */
export function buildBoard(kit: SceneKit, dots: ViewerDot[]): Group {
  const {frame} = kit;
  const group = new Group();

  const slabGeometry = new ExtrudeGeometry(roundedRect(frame.width, frame.depth, CORNER_RADIUS), {depth: BOARD_THICKNESS, bevelEnabled: false, curveSegments: 6});
  // The shape is drawn in XY and extruded along +z; lay it flat with the top face at y=0.
  slabGeometry.rotateX(Math.PI / 2);
  const slab = new Mesh(slabGeometry, new MeshStandardMaterial({color: BOARD_COLOR, roughness: 0.78}));
  slab.receiveShadow = true;
  group.add(slab);

  const topPositions = dots.map(dot => frame.point(dot.x, dot.y, SURFACE_LIFT));
  const bottomPositions = dots.map(dot => frame.point(dot.x, dot.y, BOARD_BOTTOM_Y - SURFACE_LIFT));

  const padMaterial = new MeshStandardMaterial({color: "#ffffff", metalness: 1, roughness: 0.38, side: DoubleSide});
  const holeMaterial = new MeshBasicMaterial({color: "#040604", side: DoubleSide});
  const padGeometry = new RingGeometry(HOLE_RADIUS, PAD_RADIUS, 24).rotateX(-Math.PI / 2);
  const holeGeometry = new CircleGeometry(HOLE_RADIUS, 16).rotateX(-Math.PI / 2);

  const padColors = dots.map(dot =>
    new Color(dot.color && dot.color.toLowerCase() !== DEFAULT_DOT_COLOR ? dot.color : COPPER_COLOR)
  );
  for (const positions of [topPositions, bottomPositions]) {
    const pads = instanced(padGeometry, padMaterial, positions);
    padColors.forEach((color, i) => pads.setColorAt(i, color));
    group.add(pads);
    // Holes sit a hair above their pads' plane so the black disc always wins the depth test.
    const holes = instanced(holeGeometry, holeMaterial, positions.map(p => p.clone().setY(p.y + Math.sign(p.y || 1) * 0.002)));
    group.add(holes);
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
