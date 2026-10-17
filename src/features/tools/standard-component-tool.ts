import {ActiveTool} from "../../state/ToolState";
import {getComponentDefinition} from "../../parts/component-definitions";
import {drawPart} from "../../board-render";
import {PlacedStandardComponent} from "../standard-components/placed-standard-component";
import {placePart} from "../placed-parts";
import {standardKey} from "../catalog/catalog-keys";
import {recordRecentKey} from "../catalog/recent-components";
import {drawStartMarker, ToolBehavior} from "./tool";

type StandardComponentTool = Extract<ActiveTool, {kind: "standard-component"}>;

// Two-click span (one pad per lead) that stays armed for repeated placement.
export const standardComponentTool: ToolBehavior<StandardComponentTool> = {
  onPointerDown(tool, {hoverDot}) {
    if (!hoverDot) return false;
    if (!tool.start) {
      tool.start = hoverDot;
      return true;
    }
    if (tool.start !== hoverDot) {
      placePart(new PlacedStandardComponent(tool.definitionId, tool.start, hoverDot));
      recordRecentKey(standardKey(tool.definitionId));
    }
    tool.start = undefined;
    return true;
  },

  drawPreview(tool, hoverDot, painter) {
    const def = getComponentDefinition(tool.definitionId);
    if (!def) return;
    if (!tool.start) {
      drawStartMarker(painter, hoverDot, `Start ${def.name}`);
      return;
    }
    const ghost = new PlacedStandardComponent(def.id, tool.start, hoverDot);
    drawPart(painter, {kind: "standard-component", entry: ghost.serialize()}, {ghost: true});
  },

  statusText(tool) {
    const name = getComponentDefinition(tool.definitionId)?.name ?? "Component";
    return tool.start ? `Placing ${name} [Click end pad]` : `${name} Armed [Click start pad]`;
  },
};
