import {IDot} from "../../interfaces/dot.interface";
import {Point} from "../../interfaces/point.interface";
import {PlacedPart} from "../../interfaces/placed-part.interface";
import {SavedStandardComponent} from "../../project-file/project-file";
import {toGridPos} from "../../project-file/grid";
import {ComponentDefinition, getComponentDefinition} from "../../parts/component-definitions";
import {standardPartSpan} from "../../board-render";

// Perpendicular hit-test tolerance over the body vs. over a lead. The body is the only part
// that renders wide, so it gets a chunkier tolerance for easy clicking; the leads render as a
// thin (~4px) line, so they get just enough tolerance to be clickable without reaching out
// over neighboring, unrelated wires. A single tolerance derived from body size used to be
// applied along the *entire* span (including well past the leads and the component's own
// dots), which was generous enough to swallow clicks meant for separate, adjacent wires.
const BODY_HIT_PAD = 4;
const LEAD_HIT_HALF_WIDTH = 8;
const END_HIT_PAD = 6;

export class PlacedStandardComponent implements PlacedPart {
  public ref = "";
  public value?: string;
  public color?: string;

  constructor(
    public definitionId: string,
    public startDot: IDot,
    public endDot: IDot
  ) {}

  get kind(): "standard-component" { return "standard-component"; }
  get layer(): "over-wires" { return "over-wires"; }

  getDefinition(): ComponentDefinition | undefined {
    return getComponentDefinition(this.definitionId);
  }

  getPinPositions(): Point[] {
    return [{x: this.startDot.x, y: this.startDot.y}, {x: this.endDot.x, y: this.endDot.y}];
  }

  getOccupiedPositions(): Point[] {
    return this.getPinPositions();
  }

  getAnchorDots(): IDot[] {
    return [this.startDot, this.endDot];
  }

  setAnchorDots(dots: IDot[]) {
    if (dots[0]) this.startDot = dots[0];
    if (dots[1]) this.endDot = dots[1];
  }

  serialize(): SavedStandardComponent {
    return {
      ref: this.ref,
      definitionId: this.definitionId,
      from: toGridPos(this.startDot),
      to: toGridPos(this.endDot),
      ...(this.value ? {value: this.value} : {}),
      ...(this.color ? {color: this.color} : {}),
    };
  }

  containsPoint(x: number, y: number): boolean {
    const def = this.getDefinition();
    if (!def) {
      // Definition missing (e.g. a stale save) - fall back to a generous fixed box around
      // the span so the orphaned component can still be found and deleted.
      return this.containsPointFallback(x, y);
    }

    const {length, angle, bodyStart, bodyEnd, bodySize} = standardPartSpan(this.startDot, this.endDot, def);
    if (length === 0) return false;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - this.startDot.x;
    const dy = y - this.startDot.y;
    // Rotate the click into the component's local space, where its span runs along the x-axis.
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    if (localX >= bodyStart && localX <= bodyEnd) {
      return Math.abs(localY) <= bodySize / 2 + BODY_HIT_PAD;
    }
    if (localX >= -END_HIT_PAD && localX <= length + END_HIT_PAD) {
      return Math.abs(localY) <= LEAD_HIT_HALF_WIDTH;
    }
    return false;
  }

  private containsPointFallback(x: number, y: number): boolean {
    const tolerance = 18;
    const dx1 = this.startDot.x - x;
    const dy1 = this.startDot.y - y;
    const dx2 = this.endDot.x - x;
    const dy2 = this.endDot.y - y;
    const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const d = Math.sqrt(
      Math.pow(this.endDot.x - this.startDot.x, 2) + Math.pow(this.endDot.y - this.startDot.y, 2)
    );
    return Math.abs(d - (d1 + d2)) < tolerance;
  }
}
