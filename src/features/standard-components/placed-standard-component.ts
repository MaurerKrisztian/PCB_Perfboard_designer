import {IDot} from "../../interfaces/dot.interface";
import {StandardComponentState} from "../../state/StandardComponentState";
import {ComponentDefinition, getComponentDefinition} from "./component-definitions";
import {drawStandardComponentBody} from "./standard-component-render";

// Wider than GridConfig.lineSelectTolerance (used for hairline wires) since the
// component body renders ~32px tall, so clicks anywhere near the visible body should register.
const HIT_TEST_TOLERANCE = 18;

export class PlacedStandardComponent {
  public id: number = Math.random() * 100;
  public value?: string;

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
    drawStandardComponentBody(this.startDot, this.endDot, def, {selected: isSelected});
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

    return Math.abs(d - (d1 + d2)) < HIT_TEST_TOLERANCE;
  }
}
