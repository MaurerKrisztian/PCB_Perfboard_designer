import {Canvas} from "../../state/Canvas";
import {ActiveTool} from "../../state/ToolState";
import {IDot} from "../../interfaces/dot.interface";
import {getAdvancedComponentDefinition} from "../advanced-components/advanced-component-definitions";
import {drawAdvancedComponentBody} from "../advanced-components/advanced-component-render";
import {PlacedAdvancedComponent} from "../advanced-components/placed-advanced-component";
import {findDotAt} from "../dot-lookup";
import {placePart} from "../placed-parts";
import {advancedKey} from "../catalog/catalog-keys";
import {recordRecentKey} from "../catalog/recent-components";
import {ToolBehavior} from "./tool";

type AdvancedComponentTool = Extract<ActiveTool, {kind: "advanced-component"}>;

// A grid-sizable block (header pins) spanned between two corner pads. The lattice grows
// right/down from its anchor, so the anchor is the top-left corner of the spanned rect - neither
// clicked dot is it when spanning up and/or left. Always unrotated: the spanned rect already fixes
// the block's orientation, and a rotation would swing the lattice off the holes the user picked.
function spannedBlock(definitionId: string, a: IDot, b: IDot): PlacedAdvancedComponent | undefined {
  const anchorDot = findDotAt(Math.min(a.x, b.x), Math.min(a.y, b.y));
  if (!anchorDot) return undefined;
  const block = new PlacedAdvancedComponent(definitionId, anchorDot, 0);
  const {rows, cols} = PlacedAdvancedComponent.gridSpanFromDots(a, b);
  block.rows = rows;
  block.cols = cols;
  return block;
}

// Pins are rigid, so a single click anchors the component using the armed rotation, matching IC
// placement. The exception is a gridSizable part (header pins), whose block size is chosen by the
// user: that takes two clicks to span opposite corners, like a wire or a standard component.
// Either way the tool stays armed for repeated placement.
export const advancedComponentTool: ToolBehavior<AdvancedComponentTool> = {
  onPointerDown(tool, {hoverDot}) {
    if (!hoverDot) return false;
    const def = getAdvancedComponentDefinition(tool.definitionId);
    if (!def?.gridSizable) {
      placePart(new PlacedAdvancedComponent(tool.definitionId, hoverDot, tool.rotation));
      recordRecentKey(advancedKey(tool.definitionId));
      return true;
    }
    if (!tool.start) {
      tool.start = hoverDot;
      return true;
    }
    const block = spannedBlock(tool.definitionId, tool.start, hoverDot);
    if (block) {
      placePart(block);
      recordRecentKey(advancedKey(tool.definitionId));
    }
    tool.start = undefined;
    return true;
  },

  drawPreview(tool, hoverDot) {
    const def = getAdvancedComponentDefinition(tool.definitionId);
    if (!def) return;
    // Second half of a two-click span: preview the whole block the commit would place.
    const ghost = (def.gridSizable && tool.start && spannedBlock(def.id, tool.start, hoverDot))
      || new PlacedAdvancedComponent(def.id, hoverDot, def.gridSizable ? 0 : tool.rotation);
    Canvas.ctx.save();
    drawAdvancedComponentBody(
      ghost.getPinPositions(), ghost.getShadedPositions(), ghost.getBodyOutline(), ghost.getIconAnchor(),
      def, ghost.rotationAngle, {ghost: true}
    );
    Canvas.ctx.restore();
  },

  statusText(tool) {
    const def = getAdvancedComponentDefinition(tool.definitionId);
    const name = def?.name ?? "Component";
    if (def?.gridSizable) {
      return tool.start ? `Placing ${name} [Click opposite corner]` : `${name} Armed [Click first corner]`;
    }
    return `${name} Armed [Click pad to place • R to rotate]`;
  },
};
