import {
  BoxGeometry, CanvasTexture, CylinderGeometry, Group, Material, Mesh, MeshStandardMaterial,
  MeshStandardMaterialParameters, PlaneGeometry, Quaternion, SphereGeometry, SRGBColorSpace, Vector3,
} from "three";
import {holeKey} from "./wire-paths";

// The editor saves positions as canvas pixels with one hole every 50px (GridConfig.dotSpace).
// The 3D scene works in millimetres so parts can use real package dimensions, with the
// standard 0.1" (2.54mm) perfboard pitch mapped onto that 50px grid.
export const PX_PER_PITCH = 50;
export const PITCH = 2.54;
const MM_PER_PX = PITCH / PX_PER_PITCH;

export const BOARD_THICKNESS = 1.6;
export const BOARD_BOTTOM_Y = -BOARD_THICKNESS;
// How far leads poke out below the board, through their solder joints.
export const LEAD_TIP_Y = BOARD_BOTTOM_Y - 1.1;
export const LEAD_RADIUS = 0.3;

/** Maps canvas pixels onto the board: x right, z toward the viewer (canvas y runs down), y up
 *  out of the top face, with the board centered on the origin. */
export class BoardFrame {
  readonly width: number;
  readonly depth: number;

  constructor(canvasWidthPx: number, canvasHeightPx: number) {
    this.width = canvasWidthPx * MM_PER_PX;
    this.depth = canvasHeightPx * MM_PER_PX;
  }

  x(px: number): number {
    return px * MM_PER_PX - this.width / 2;
  }

  z(py: number): number {
    return py * MM_PER_PX - this.depth / 2;
  }

  point(px: number, py: number, y = 0): Vector3 {
    return new Vector3(this.x(px), y, this.z(py));
  }
}

const UP = new Vector3(0, 1, 0);

/** Shared geometry/material cache plus the registry of holes that end up soldered, handed to
 *  every part builder so a whole board shares a handful of GPU resources. */
export class SceneKit {
  readonly solderedHoles = new Map<string, {x: number; z: number}>();
  readonly unitCylinder = new CylinderGeometry(1, 1, 1, 14, 1);
  readonly unitSphere = new SphereGeometry(1, 16, 12);
  readonly unitBox = new BoxGeometry(1, 1, 1);
  private readonly materials = new Map<string, Material>();

  constructor(readonly frame: BoardFrame) {}

  standard(key: string, params: MeshStandardMaterialParameters): MeshStandardMaterial {
    let material = this.materials.get(key) as MeshStandardMaterial | undefined;
    if (!material) {
      material = new MeshStandardMaterial(params);
      this.materials.set(key, material);
    }
    return material;
  }

  get leadMaterial(): MeshStandardMaterial {
    return this.standard("lead", {color: "#d3d7dc", metalness: 1, roughness: 0.32});
  }

  get blackPlasticMaterial(): MeshStandardMaterial {
    return this.standard("black-plastic", {color: "#1c1f23", roughness: 0.55});
  }

  /** Marks a hole as having something soldered into it (drawn as a joint on the underside). */
  solder(px: number, py: number) {
    this.solderedHoles.set(holeKey(px, py), {x: this.frame.x(px), z: this.frame.z(py)});
  }

  rod(a: Vector3, b: Vector3, radius: number, material: Material): Mesh | null {
    const direction = new Vector3().subVectors(b, a);
    const length = direction.length();
    if (length < 1e-4) return null;
    const mesh = new Mesh(this.unitCylinder, material);
    mesh.scale.set(radius, length, radius);
    mesh.position.copy(a).addScaledVector(direction, 0.5);
    mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, direction.normalize()));
    mesh.castShadow = true;
    return mesh;
  }

  ball(center: Vector3, radius: number, material: Material): Mesh {
    const mesh = new Mesh(this.unitSphere, material);
    mesh.scale.setScalar(radius);
    mesh.position.copy(center);
    mesh.castShadow = true;
    return mesh;
  }

  box(sizeX: number, sizeY: number, sizeZ: number, material: Material | Material[], center: Vector3): Mesh {
    const mesh = new Mesh(this.unitBox, material);
    mesh.scale.set(sizeX, sizeY, sizeZ);
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** A bent wire through the given points: rods for the runs, balls at the bends so corners
   *  read as rounded. Used for every lead and jumper wire. */
  bentWire(points: Vector3[], radius: number, material: Material): Group {
    const group = new Group();
    for (let i = 0; i < points.length - 1; i++) {
      const rod = this.rod(points[i], points[i + 1], radius, material);
      if (rod) group.add(rod);
      if (i > 0) group.add(this.ball(points[i], radius, material));
    }
    return group;
  }

  lead(points: Vector3[]): Group {
    return this.bentWire(points, LEAD_RADIUS, this.leadMaterial);
  }
}

/** A texture painted with the 2D canvas API (for markings, labels and silkscreen). */
export function paintedTexture(widthPx: number, heightPx: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(widthPx));
  canvas.height = Math.max(2, Math.round(heightPx));
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export const LABEL_FONT = "Inter, Arial, sans-serif";

/** Sets ctx.font to the largest size (capped at maxHeight) that fits text within maxWidth. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, weight = "600"): number {
  let size = maxHeight;
  ctx.font = `${weight} ${size}px ${LABEL_FONT}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    size = Math.max(4, size * maxWidth / width);
    ctx.font = `${weight} ${size}px ${LABEL_FONT}`;
  }
  return size;
}

// Pixels per millimetre for painted markings: enough for crisp text up close.
const LABEL_PPM = 48;

/** A flat, transparent label (part markings) of the given size in mm, centered on its origin
 *  and facing +z. */
export function textPlane(text: string, widthMm: number, heightMm: number, color: string): Mesh {
  const texture = paintedTexture(widthMm * LABEL_PPM, heightMm * LABEL_PPM, (ctx, w, h) => {
    fitFont(ctx, text, w * 0.92, h * 0.8);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2);
  });
  const material = new MeshStandardMaterial({
    map: texture, transparent: true, roughness: 0.7, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });
  return new Mesh(new PlaneGeometry(widthMm, heightMm), material);
}
