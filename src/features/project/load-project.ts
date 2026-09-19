import {Utils} from "../../utils/utils";
import {DotState} from "../../state/DotState";
import {LineState} from "../../state/LineState";
import {IcState} from "../../state/IcState";
import {redrawCanvas} from "../draw-canvas";
import {Canvas} from "../../state/Canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
import {Ic} from "../ic";
import {unserialize} from "../../utils/serialization";
import {StandardComponentState} from "../../state/StandardComponentState";
import {PlacedStandardComponent} from "../standard-components/placed-standard-component";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {PlacedAdvancedComponent} from "../advanced-components/placed-advanced-component";
import {applyCanvasResolution} from "../canvas-sizing";
import {getCurrentZoom} from "../view-controls";
import {disarmWire} from "../wire";
import {updateSelectionStatus} from "../selection-status";

const loadInput = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectBtn');
const loadTrigger = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectTrigger');

loadTrigger.addEventListener('click', function() {
  loadInput.click();
});

loadInput.addEventListener('change', function(e) {
  // @ts-ignore
  const file = e.target.files[0];

  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    const data = JSON.parse(contents) as IProjectSave;

    // Load the state of the canvas from the uploaded file
    loadProject(data)

    // Redraw the canvas
    redrawCanvas();
  };
  reader.readAsText(file);
});

export function deserializePlacedIc(data: any): Ic | null {
  if (!data || data.widthPin == null || data.heightPin == null) return null;
  const ic = new Ic(
    Number(data.widthPin),
    Number(data.heightPin),
    data.pinDescription || {},
    String(data.name || 'Component'),
    Boolean(data.isCustom)
  );
  if (data.id) {
    ic.id = Number(data.id);
  }
  ic.rotationAngle = Number(data.rotationAngle || 0);
  if (data.topLeftDotX !== null && data.topLeftDotY !== null) {
    const targetDot = DotState.dots.find(d => d.x === data.topLeftDotX && d.y === data.topLeftDotY);
    if (targetDot) {
      ic.topLeftDot = targetDot;
    } else {
      ic.updatePosition(data.topLeftDotX, data.topLeftDotY);
    }
  }
  return ic;
}

export function deserializePlacedStandardComponent(data: any): PlacedStandardComponent | null {
  if (!data || !data.definitionId) return null;
  const startDot = DotState.dots.find(d => d.x === data.startDotX && d.y === data.startDotY);
  const endDot = DotState.dots.find(d => d.x === data.endDotX && d.y === data.endDotY);
  if (!startDot || !endDot) return null;

  const component = new PlacedStandardComponent(String(data.definitionId), startDot, endDot);
  if (data.id) {
    component.id = Number(data.id);
  }
  if (data.value) {
    component.value = String(data.value);
  }
  if (data.color) {
    component.color = String(data.color);
  }
  return component;
}

export function deserializePlacedAdvancedComponent(data: any): PlacedAdvancedComponent | null {
  if (!data || !data.definitionId) return null;
  const anchorDot = DotState.dots.find(d => d.x === data.anchorDotX && d.y === data.anchorDotY);
  if (!anchorDot) return null;

  const parsedRotation = Number(data.rotationAngle);
  const rotationAngle = ([0, 90, 180, 270].indexOf(parsedRotation) > -1 ? parsedRotation : 0) as 0 | 90 | 180 | 270;
  const component = new PlacedAdvancedComponent(String(data.definitionId), anchorDot, rotationAngle);
  if (data.id) {
    component.id = Number(data.id);
  }
  if (data.value) {
    component.value = String(data.value);
  }
  return component;
}

export function loadProject(project: IProjectSave){
  Canvas.gridWidth = project.canvas.width;
  Canvas.gridHeight = project.canvas.height;
  applyCanvasResolution(getCurrentZoom());
  DotState.dots = project.dots;
  LineState.lines = project.lines;
  if (project.ICs) {
    Ic.IC_CONTAINER = project.ICs.map(ic => unserialize(ic, Ic));
    Ic.showICs();
  }
  if (project.placedIcs) {
    IcState.placedIcs = project.placedIcs.map(data => deserializePlacedIc(data)).filter(ic => ic !== null) as Ic[];
  } else {
    IcState.placedIcs = [];
  }
  if (project.placedStandardComponents) {
    StandardComponentState.placedComponents = project.placedStandardComponents
      .map(data => deserializePlacedStandardComponent(data))
      .filter(c => c !== null) as PlacedStandardComponent[];
  } else {
    StandardComponentState.placedComponents = [];
  }
  if (project.placedAdvancedComponents) {
    AdvancedComponentState.placedComponents = project.placedAdvancedComponents
      .map(data => deserializePlacedAdvancedComponent(data))
      .filter(c => c !== null) as PlacedAdvancedComponent[];
  } else {
    AdvancedComponentState.placedComponents = [];
  }
  IcState.selectedPlacedIc = undefined;
  DotState.selectedDot = undefined;
  LineState.selectedLine = undefined;
  IcState.selectedIc = undefined;
  StandardComponentState.armedDefinitionId = undefined;
  StandardComponentState.pendingStartDot = undefined;
  StandardComponentState.selectedPlacedComponent = undefined;
  AdvancedComponentState.armedDefinitionId = undefined;
  AdvancedComponentState.selectedPlacedComponent = undefined;
  disarmWire();
  updateSelectionStatus();
  redrawCanvas();
}
