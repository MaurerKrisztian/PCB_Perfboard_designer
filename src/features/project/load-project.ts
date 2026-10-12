import {Utils} from "../../utils/utils";
import {DotState} from "../../state/DotState";
import {LineState} from "../../state/LineState";
import {PartState} from "../../state/PartState";
import type {Part} from "../../interfaces/placed-part.interface";
import {redrawCanvas} from "../draw-canvas";
import {Canvas} from "../../state/Canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
import {Ic} from "../ic";
import {unserialize} from "../../utils/serialization";
import {PlacedStandardComponent} from "../standard-components/placed-standard-component";
import {PlacedAdvancedComponent} from "../advanced-components/placed-advanced-component";
import {applyCanvasResolution} from "../canvas-sizing";
import {getCurrentZoom} from "../view-controls";
import {resetForNewBoard} from "../reset-interaction";

const loadInput = Utils.getSafeHtmlElement<HTMLInputElement>('loadProjectBtn');
const loadTrigger = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectTrigger');

loadTrigger.addEventListener('click', function() {
  loadInput.click();
});

loadInput.addEventListener('change', function() {
  const file = loadInput.files?.[0];
  // Clear the input so picking the same file again still fires 'change'.
  loadInput.value = '';

  if (!file) return;

  const reader = new FileReader();
  reader.onload = function() {
    try {
      const data = JSON.parse(String(reader.result)) as IProjectSave;
      loadProject(data);
    } catch (err) {
      console.error(err);
      alert(`Couldn't open "${file.name}": it isn't a valid project file.`);
    }
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
  // Projects saved before grid-sizable parts existed carry no rows/cols, and correctly fall
  // back to the 1x1 that every fixed-geometry part uses.
  component.rows = Math.max(1, Math.round(Number(data.rows)) || 1);
  component.cols = Math.max(1, Math.round(Number(data.cols)) || 1);
  return component;
}

export function loadProject(project: IProjectSave){
  resetForNewBoard();
  Canvas.gridWidth = project.canvas.width;
  Canvas.gridHeight = project.canvas.height;
  applyCanvasResolution(getCurrentZoom());
  DotState.dots = project.dots;
  LineState.lines = project.lines;
  if (project.ICs) {
    Ic.IC_CONTAINER = project.ICs.map(ic => unserialize(ic, Ic));
    Ic.showICs();
  }
  // Kind by kind, in the grouped order PartState.parts keeps.
  const parts: (Part | null)[] = [
    ...(project.placedIcs ?? []).map(data => deserializePlacedIc(data)),
    ...(project.placedStandardComponents ?? []).map(data => deserializePlacedStandardComponent(data)),
    ...(project.placedAdvancedComponents ?? []).map(data => deserializePlacedAdvancedComponent(data)),
  ];
  PartState.parts = parts.filter((part): part is Part => part !== null);
  redrawCanvas();
}
