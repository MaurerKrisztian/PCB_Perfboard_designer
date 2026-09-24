import {IDot} from "../../interfaces/dot.interface";
import {StandardComponentState} from "../../state/StandardComponentState";
import {ComponentDefinition, getComponentBodySize, getComponentDefinition} from "./component-definitions";
import {drawStandardComponentBody} from "./standard-component-render";

// Wider than GridConfig.lineSelectTolerance (used for hairline wires) since the component
// body renders as a square of getComponentBodySize(def) px, so clicks anywhere near the
// visible body should register. Derived from the body size so bigger parts stay as easy to
// click as small ones; the fallback covers components whose definition has gone missing.
const HIT_TEST_TOLERANCE_RATIO = 0.6;
const FALLBACK_HIT_TEST_TOLERANCE = 18;

export class PlacedStandardComponent {
  public id: number = Math.random() * 100;
  public value?: string;
  public color?: string;

  constructor(
    public definitionId: string,
    public startDot: IDot,
    public endDot: IDot
  ) {}

  getDefinition(): ComponentDefinition | undefined {
    return getComponentDefinition(this.definitionId);
  }

  draw() {
    const def = this.getDefinition();
    if (!def) return;
    const isSelected = this === StandardComponentState.selectedPlacedComponent;
    drawStandardComponentBody(this.startDot, this.endDot, def, {selected: isSelected, value: this.value, color: this.color});
  }

  private getHitTestTolerance(): number {
    const def = this.getDefinition();
    return def ? getComponentBodySize(def) * HIT_TEST_TOLERANCE_RATIO : FALLBACK_HIT_TEST_TOLERANCE;
  }

  containsPoint(x: number, y: number): boolean {
    const dx1 = this.startDot.x - x;
    const dy1 = this.startDot.y - y;
    const dx2 = this.endDot.x - x;
    const dy2 = this.endDot.y - y;

    const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const d = Math.sqrt(
      Math.pow(this.endDot.x - this.startDot.x, 2) + Math.pow(this.endDot.y - this.startDot.y, 2)
    );

    return Math.abs(d - (d1 + d2)) < this.getHitTestTolerance();
  }
}
