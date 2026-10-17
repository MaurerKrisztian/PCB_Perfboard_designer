import {IDot} from "../../interfaces/dot.interface";
import {PlacedPart} from "../../interfaces/placed-part.interface";
import {SavedAdvancedComponent} from "../../project-file/project-file";
import {toGridPos} from "../../project-file/grid";
import {GridConfig} from "../../state/GridConfig";
import {Point} from "../../interfaces/point.interface";
import {AdvancedGeometry, advancedPartGeometry, Rect} from "../../board-render";
import {AdvancedComponentDefinition, getAdvancedComponentDefinition} from "../../parts/advanced-component-definitions";

export class PlacedAdvancedComponent implements PlacedPart {
  public ref = "";
  public value?: string;
  public rotationAngle: 0 | 90 | 180 | 270 = 0;
  // Only meaningful for gridSizable definitions; 1x1 keeps every fixed-geometry part - and
  // every project saved before header pins existed - behaving exactly as before.
  public rows = 1;
  public cols = 1;

  constructor(
    public definitionId: string,
    public anchorDot: IDot,
    rotationAngle: 0 | 90 | 180 | 270 = 0
  ) {
    this.rotationAngle = rotationAngle;
  }

  get kind(): "advanced-component" { return "advanced-component"; }
  get layer(): "over-wires" { return "over-wires"; }

  // Rows/cols spanned by a two-click placement, from the two corner dots in either order.
  static gridSpanFromDots(a: IDot, b: IDot): {rows: number; cols: number} {
    return {
      cols: Math.round(Math.abs(b.x - a.x) / GridConfig.dotSpace) + 1,
      rows: Math.round(Math.abs(b.y - a.y) / GridConfig.dotSpace) + 1,
    };
  }

  getDefinition(): AdvancedComponentDefinition | undefined {
    return getAdvancedComponentDefinition(this.definitionId);
  }

  // Where its pins, covered holes and body are, worked out as the board renderer draws it.
  private geometry(): AdvancedGeometry | undefined {
    return advancedPartGeometry({
      definitionId: this.definitionId,
      at: toGridPos(this.anchorDot),
      rotation: this.rotationAngle,
      rows: this.rows,
      cols: this.cols,
    });
  }

  getPinPositions(): Point[] {
    return this.geometry()?.pins ?? [];
  }

  getShadedPositions(): Point[] {
    return this.geometry()?.shaded ?? [];
  }

  rotate() {
    // A grid-sizable block is symmetric under rotation, so turning it about its anchor would
    // just make it jump off the holes the user spanned. Transpose it in place instead, which
    // keeps the top-left corner put and is what "rotate this header" actually means.
    if (this.getDefinition()?.gridSizable) {
      const rows = this.rows;
      this.rows = this.cols;
      this.cols = rows;
      return;
    }
    this.rotationAngle = ((this.rotationAngle + 90) % 360) as 0 | 90 | 180 | 270;
  }

  // Pin and shaded-hole positions already account for rotation and rows/cols.
  getOccupiedPositions(): Point[] {
    return [...this.getPinPositions(), ...this.getShadedPositions()];
  }

  getAnchorDots(): IDot[] {
    return [this.anchorDot];
  }

  setAnchorDots(dots: IDot[]) {
    if (dots[0]) this.anchorDot = dots[0];
  }

  serialize(): SavedAdvancedComponent {
    return {
      ref: this.ref,
      definitionId: this.definitionId,
      at: toGridPos(this.anchorDot),
      rotation: this.rotationAngle,
      rows: this.rows,
      cols: this.cols,
      ...(this.value ? {value: this.value} : {}),
    };
  }

  // Axis-aligned box around the visible body: the outline if the definition has one, otherwise
  // the pins padded out the way the body box is drawn.
  getBodyRect(): Rect | undefined {
    return this.geometry()?.bodyRect;
  }

  containsPoint(x: number, y: number): boolean {
    const rect = this.getBodyRect();
    if (!rect) return false;
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
