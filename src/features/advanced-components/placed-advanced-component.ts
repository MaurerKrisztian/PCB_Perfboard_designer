import {IDot} from "../../interfaces/dot.interface";
import {GridConfig} from "../../state/GridConfig";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {AdvancedComponentDefinition, getAdvancedComponentDefinition, PinOffset} from "./advanced-component-definitions";
import {drawAdvancedComponentBody, getBoundingRect, PIN_PAD, Point} from "./advanced-component-render";
import {rotateOffset} from "./rotate-offset";

export class PlacedAdvancedComponent {
  public id: number = Math.random() * 100;
  public value?: string;
  public rotationAngle: 0 | 90 | 180 | 270 = 0;

  constructor(
    public definitionId: string,
    public anchorDot: IDot,
    rotationAngle: 0 | 90 | 180 | 270 = 0
  ) {
    this.rotationAngle = rotationAngle;
  }

  getDefinition(): AdvancedComponentDefinition | undefined {
    return getAdvancedComponentDefinition(this.definitionId);
  }

  private toAbsolute(offsets: PinOffset[]): Point[] {
    return offsets.map(({dx, dy}) => {
      const rotated = rotateOffset(dx, dy, this.rotationAngle);
      return {
        x: this.anchorDot.x + rotated.x * GridConfig.dotSpace,
        y: this.anchorDot.y + rotated.y * GridConfig.dotSpace
      };
    });
  }

  getPinPositions(): Point[] {
    const def = this.getDefinition();
    if (!def) return [];
    return this.toAbsolute(def.pinOffsets);
  }

  getShadedPositions(): Point[] {
    const def = this.getDefinition();
    if (!def?.shadedOffsets) return [];
    return this.toAbsolute(def.shadedOffsets);
  }

  getBodyOutline(): Point[] {
    const def = this.getDefinition();
    if (!def?.bodyOutline) return [];
    return this.toAbsolute(def.bodyOutline);
  }

  getIconAnchor(): Point {
    const def = this.getDefinition();
    if (def?.iconOffset) return this.toAbsolute([def.iconOffset])[0];
    const rect = getBoundingRect(this.getPinPositions());
    return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
  }

  rotate() {
    this.rotationAngle = ((this.rotationAngle + 90) % 360) as 0 | 90 | 180 | 270;
  }

  draw() {
    const def = this.getDefinition();
    if (!def) return;
    const isSelected = this === AdvancedComponentState.selectedPlacedComponent;
    drawAdvancedComponentBody(
      this.getPinPositions(), this.getShadedPositions(), this.getBodyOutline(), this.getIconAnchor(),
      def, this.rotationAngle, {selected: isSelected}
    );
  }

  containsPoint(x: number, y: number): boolean {
    const outline = this.getBodyOutline();
    const rect = outline.length >= 3
      ? getBoundingRect(outline)
      : getBoundingRect([...this.getPinPositions(), ...this.getShadedPositions()], PIN_PAD);
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
