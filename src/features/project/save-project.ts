import {DotState} from "../../state/DotState";
import {LineState} from "../../state/LineState";
import {IcState} from "../../state/IcState";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
import {Ic} from "../ic";
import {StandardComponentState} from "../../state/StandardComponentState";
import {PlacedStandardComponent} from "../standard-components/placed-standard-component";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {PlacedAdvancedComponent} from "../advanced-components/placed-advanced-component";

const saveBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('saveProjectBtn');
saveBtn.addEventListener('click', function() {
  // Convert the state of the canvas to a string (in JSON format)
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getSaveJson()));

  // Create a download link and click it
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "canvas_project.json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});


export function serializePlacedIc(ic: Ic) {
  return {
    id: ic.id,
    widthPin: ic.widthPin,
    heightPin: ic.heightPin,
    pinDescription: ic.pinDescription || {},
    name: ic.name,
    isCustom: !!ic.isCustom,
    rotationAngle: ic.rotationAngle || 0,
    topLeftDotX: ic.topLeftDot ? ic.topLeftDot.x : null,
    topLeftDotY: ic.topLeftDot ? ic.topLeftDot.y : null,
  };
}

export function serializePlacedStandardComponent(component: PlacedStandardComponent) {
  return {
    id: component.id,
    definitionId: component.definitionId,
    value: component.value,
    color: component.color,
    startDotX: component.startDot.x,
    startDotY: component.startDot.y,
    endDotX: component.endDot.x,
    endDotY: component.endDot.y,
  };
}

export function serializePlacedAdvancedComponent(component: PlacedAdvancedComponent) {
  return {
    id: component.id,
    definitionId: component.definitionId,
    value: component.value,
    rotationAngle: component.rotationAngle,
    anchorDotX: component.anchorDot.x,
    anchorDotY: component.anchorDot.y,
  };
}

export function getSaveJson(): IProjectSave {
  return {
    dots: DotState.dots,
    lines: LineState.lines,
    canvas: { width: Canvas.gridWidth, height: Canvas.gridHeight },
    ICs: Ic.IC_CONTAINER || [],
    placedIcs: IcState.placedIcs.map(ic => serializePlacedIc(ic)),
    placedStandardComponents: StandardComponentState.placedComponents.map(c => serializePlacedStandardComponent(c)),
    placedAdvancedComponents: AdvancedComponentState.placedComponents.map(c => serializePlacedAdvancedComponent(c))
  };
}
