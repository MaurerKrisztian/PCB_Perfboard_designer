import {DotState} from "../state/DotState";
import {IDot} from "../interfaces/dot.interface";
import {ShortcutRegistry} from "./shortcut-keys";
import {redrawCanvas} from "./draw-canvas";
import {Rotation, ToolState} from "../state/ToolState";
import {SelectionState} from "../state/SelectionState";
import {setActiveTool} from "./active-tool";
import {findNearestDot} from "./dot-lookup";
import {findPartAt} from "./placed-parts";
import {GridConfig} from "../state/GridConfig";
import {isRotatable, PlacedPart} from "../interfaces/placed-part.interface";
import {Point} from "../interfaces/point.interface";
import {SavedCustomIc, SavedIc} from "../project-file/project-file";
import {gridToPx, toGridPos} from "../project-file/grid";
import {readCustomIcs} from "../project-file/read-project-file";
import {isModuleCategory} from "../parts/ic-package";
import {DIP_OVERHANG, MODULE_EDGE, MODULE_END} from "../board-render";
import {icPins} from "../parts/part-geometry";
import {IC_DEFINITIONS} from "../parts/ic-definitions";
import {CategoryId, isCategoryId} from "../parts/catalog-categories";
import {notifyCatalogChanged} from "./catalog/catalog-events";


// Both a catalog entry (IC_CONTAINER, the clone armed for placement) and a chip placed on the
// board; only the latter has a topLeftDot and a ref. `id` identifies the catalog entry, not the
// placed chip. Catalog entries are saved through customIcEntries, which picks its fields.
export class Ic implements PlacedPart {
  static IC_CONTAINER: Ic[] = [];

  public id = Math.random() * 100;
  public ref = "";
  public isCustom?: boolean = false;
  // Where a catalog template is listed in the Components panel tree.
  public category: CategoryId = "ics.custom";
  // The IC_DEFINITIONS entry a built-in template came from; undefined for custom parts.
  public definitionId?: string;
  // Set on the armed copy of a catalog template (see selectIc); undefined everywhere else.
  public armedFrom?: Ic;
  public rotationAngle = 0; // 0, 90, 180, 270
  topLeftDot: IDot | null = null;

  constructor(
    public widthPin: number, 
    public heightPin: number, 
    public pinDescription: Record<number, string>,
    public name: string,
    isCustom = false
  ) {
    this.isCustom = isCustom;
  }

  // Getters rather than fields so they stay out of the saved catalog (see above).
  get kind(): "ic" { return "ic"; }
  get layer(): "under-board" { return "under-board"; }

  // Parts in the Modules category (dev boards…) are drawn as a board; every other chip is a DIP.
  get isModule(): boolean { return isModuleCategory(this.category); }

  static add(ic: Ic, saveToStorage = false){
    this.IC_CONTAINER.push(ic);
    if (saveToStorage) {
      this.saveCustomIcsToLocalStorage();
    }
    notifyCatalogChanged();
  }

  // The catalog's custom ICs, in the shape localStorage and project files store them.
  static customIcEntries(): SavedCustomIc[] {
    return Ic.IC_CONTAINER.filter(ic => ic.isCustom).map(ic => ({
      id: ic.id,
      name: ic.name,
      widthPin: ic.widthPin,
      heightPin: ic.heightPin,
      pinDescription: ic.pinDescription,
      category: ic.category,
    }));
  }

  static saveCustomIcsToLocalStorage() {
    try {
      localStorage.setItem('custom_ics', JSON.stringify(Ic.customIcEntries()));
    } catch (e) {
      console.error("Failed to save custom ICs to localStorage", e);
    }
  }

  // Adds custom ICs to the catalog, skipping any whose id it already has. Returns how many were new.
  static addCustomIcs(entries: SavedCustomIc[]): number {
    let added = 0;
    for (const data of entries) {
      if (data.id !== undefined && Ic.IC_CONTAINER.some(ic => String(ic.id) === String(data.id))) continue;
      const newIc = new Ic(data.widthPin, data.heightPin, {...data.pinDescription}, data.name, true);
      if (data.id !== undefined) newIc.id = data.id;
      // Entries saved before categories existed have none, and land in ICs > Custom.
      newIc.category = isCategoryId(data.category) ? data.category : "ics.custom";
      Ic.IC_CONTAINER.push(newIc);
      added++;
    }
    notifyCatalogChanged();
    return added;
  }

  static loadCustomIcsFromLocalStorage() {
    try {
      const stored = localStorage.getItem('custom_ics');
      if (!stored) return;
      Ic.addCustomIcs(readCustomIcs(JSON.parse(stored)));
    } catch (e) {
      console.error("Failed to load custom ICs from localStorage", e);
    }
  }

  updatePosition(x: number, y: number){
    this.topLeftDot = findNearestDot(x, y) ?? null;
  }

  // Pin rows run along y at 0°/180° and along x at 90°/270°; the body sticks out past the end pins.
  private get overhang(): number {
    return this.isModule ? MODULE_END : DIP_OVERHANG;
  }

  // A module's board also runs past the pin rows on the outside; a DIP's body stays inside them.
  private get sideOverhang(): number {
    return this.isModule ? MODULE_EDGE : 0;
  }

  // Each pin's number and hole, in drawing px, numbered as everywhere else (icPins).
  getRealPinPositions(): {pin: number, x: number, y: number}[] {
    if (!this.topLeftDot) return [];
    const placement = {at: toGridPos(this.topLeftDot), widthPin: this.widthPin, heightPin: this.heightPin, rotation: this.rotationAngle as Rotation};
    return icPins(placement).map(({pin, at}) => ({pin, x: gridToPx(at[0]), y: gridToPx(at[1])}));
  }

  getPinPositions(): Point[] {
    return this.getRealPinPositions();
  }

  getOccupiedPositions(): Point[] {
    const topLeft = this.topLeftDot;
    if (!topLeft) return [];
    // The grid is regular, so the footprint's four corners standing on dots implies the rest do.
    const w = GridConfig.dotSpace * (this.widthPin - 1);
    const h = GridConfig.dotSpace * (this.heightPin - 1);
    return [
      {x: topLeft.x, y: topLeft.y},
      {x: topLeft.x + w, y: topLeft.y},
      {x: topLeft.x, y: topLeft.y + h},
      {x: topLeft.x + w, y: topLeft.y + h},
    ];
  }

  getAnchorDots(): IDot[] {
    return this.topLeftDot ? [this.topLeftDot] : [];
  }

  setAnchorDots(dots: IDot[]) {
    if (dots[0]) this.topLeftDot = dots[0];
  }

  // Only called for placed chips, which always have a topLeftDot.
  serialize(): SavedIc {
    return {
      ref: this.ref,
      name: this.name,
      widthPin: this.widthPin,
      heightPin: this.heightPin,
      rotation: (this.rotationAngle || 0) as Rotation,
      pinDescription: this.pinDescription || {},
      at: toGridPos(this.topLeftDot ?? {x: 0, y: 0}),
      category: this.category,
    };
  }

  containsPoint(x: number, y: number): boolean {
    if (!this.topLeftDot) return false;
    const w = 50 * (this.widthPin - 1);
    const h = 50 * (this.heightPin - 1);
    // The body runs past the end pins, along the pin rows (and a board past the rows too).
    const sideways = this.rotationAngle === 90 || this.rotationAngle === 270;
    const padX = sideways ? this.overhang : this.sideOverhang;
    const padY = sideways ? this.sideOverhang : this.overhang;
    return (
      x >= this.topLeftDot.x - padX &&
      x <= this.topLeftDot.x + w + padX &&
      y >= this.topLeftDot.y - padY &&
      y <= this.topLeftDot.y + h + padY
    );
  }

  clone(): Ic {
    const copy = new Ic(this.widthPin, this.heightPin, { ...this.pinDescription }, this.name, this.isCustom);
    copy.rotationAngle = this.rotationAngle;
    copy.category = this.category;
    copy.definitionId = this.definitionId;
    return copy;
  }

  rotate(){
    this.rotationAngle = ((this.rotationAngle + 90) % 360) as 0 | 90 | 180 | 270;
    const tmp = this.widthPin;
    this.widthPin = this.heightPin;
    this.heightPin = tmp;
  }
}

// Built-in catalog templates, then the user's custom ones from localStorage
for (const def of IC_DEFINITIONS) {
  const ic = new Ic(def.widthPin, def.heightPin, {...def.pinDescription}, def.name);
  ic.category = def.category;
  ic.definitionId = def.id;
  Ic.IC_CONTAINER.push(ic);
}

// Load custom ICs from localStorage on load
Ic.loadCustomIcsFromLocalStorage();

export function deleteCustomIc(id: number | string) {
  const index = Ic.IC_CONTAINER.findIndex(ic => String(ic.id) === String(id));
  if (index > -1) {
    const [removed] = Ic.IC_CONTAINER.splice(index, 1);
    const active = ToolState.active;
    if (active.kind === "ic" && active.template.armedFrom === removed) setActiveTool({kind: "select"});
    Ic.saveCustomIcsToLocalStorage();
    notifyCatalogChanged();
  }
}

export function selectIc(id: number | string){
  const ic = Ic.IC_CONTAINER.find(ic => String(ic.id) === String(id));
  if (!ic){
    console.error(`Ic with id: ${id} not found`);
    return;
  }
  // Arm a copy so rotating while armed never changes the catalog template. `armedFrom` lets the
  // panel highlight the template, and clicking it again disarms it.
  const active = ToolState.active;
  if (active.kind === "ic" && active.template.armedFrom === ic) {
    setActiveTool({kind: "select"});
    return;
  }
  const template = ic.clone();
  template.armedFrom = ic;
  setActiveTool({kind: "ic", template});
}

export function rotateSelectedIc() {
  const selected = SelectionState.part;
  if (selected && isRotatable(selected)) {
    selected.rotate();
    redrawCanvas();
    return;
  }
  const active = ToolState.active;
  if (active.kind === "ic") {
    active.template.rotate();
    redrawCanvas();
    return;
  }
  if (active.kind === "advanced-component") {
    active.rotation = ((active.rotation + 90) % 360) as Rotation;
    redrawCanvas();
    return;
  }
  if (DotState.hoverDot) {
    // Topmost rotatable part under the cursor; standard components have no rotation.
    const hovered = findPartAt(DotState.hoverDot.x, DotState.hoverDot.y, isRotatable);
    if (hovered && isRotatable(hovered)) {
      hovered.rotate();
      SelectionState.current = {kind: "part", part: hovered};
      redrawCanvas();
    }
  }
}

ShortcutRegistry.add({
  key: "r",
  description: "Rotate selected IC component.",
  event: rotateSelectedIc
});
