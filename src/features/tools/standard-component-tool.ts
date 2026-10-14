import {ActiveTool} from "../../state/ToolState";
import {getComponentDefinition} from "../standard-components/component-definitions";
import {drawStandardComponentBody} from "../standard-components/standard-component-render";
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

  drawPreview(tool, hoverDot) {
    const def = getComponentDefinition(tool.definitionId);
    if (!def) return;
    if (!tool.start) {
      drawStartMarker(hoverDot, `Start ${def.name}`);
      return;
    }
    drawStandardComponentBody(tool.start, hoverDot, def, {ghost: true});
  },

  statusText(tool) {
    const name = getComponentDefinition(tool.definitionId)?.name ?? "Component";
    return tool.start ? `Placing ${name} [Click end pad]` : `${name} Armed [Click start pad]`;
  },
};
