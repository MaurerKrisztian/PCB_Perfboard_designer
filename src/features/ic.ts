import {fillCrispText} from "../utils/crisp-text";
import {Canvas} from "../state/Canvas";
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
import {toGridPos} from "../project-file/grid";
import {readCustomIcs} from "../project-file/read-project-file";
import {ViewState} from "../state/ViewState";
import {isModuleName} from "../project-file/ic-package";
import {DIP_INSET, DIP_OVERHANG, drawDip} from "./ic-package/dip-shape";
import {MODULE_EDGE, MODULE_END, drawModule} from "./ic-package/module-shape";
import {IC_DEFINITIONS} from "./ic-definitions";
import {CategoryId, isCategoryId} from "./catalog/catalog-categories";
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
  public rotationAngle: number = 0; // 0, 90, 180, 270
  topLeftDot: IDot | null = null;

  constructor(
    public widthPin: number, 
    public heightPin: number, 
    public pinDescription: Record<number, string>,
    public name: string,
    isCustom: boolean = false
  ) {
    this.isCustom = isCustom;
  }

  // Getters rather than fields so they stay out of the saved catalog (see above).
  get kind(): "ic" { return "ic"; }
  get layer(): "under-board" { return "under-board"; }

  // Boards on header pins (Arduino Nano…) are drawn as a dev board; every other chip is a DIP.
  get isModule(): boolean { return isModuleName(this.name); }

  static add(ic: Ic, saveToStorage: boolean = false){
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

  private get title(): string {
    return ViewState.showPartLabels && this.ref ? `${this.ref} ${this.name}` : this.name;
  }

  // Pin rows run along y at 0°/180° and along x at 90°/270°; the body sticks out past the end pins.
  private get overhang(): number {
    return this.isModule ? MODULE_END : DIP_OVERHANG;
  }

  // A module's board also runs past the pin rows on the outside; a DIP's body stays inside them.
  private get sideOverhang(): number {
    return this.isModule ? MODULE_EDGE : 0;
  }

  drawBody(isSelected: boolean){
    if (!this.topLeftDot) return;
    const paint = {
      x: this.topLeftDot.x,
      y: this.topLeftDot.y,
      widthPin: this.widthPin,
      heightPin: this.heightPin,
      rotation: this.rotationAngle as Rotation,
      selected: isSelected,
      title: this.title,
    };
    if (this.isModule) drawModule(Canvas.ctx, paint);
    else drawDip(Canvas.ctx, paint);
  }

  drawPinLabels() {
    if (!this.topLeftDot) return;
    Canvas.ctx.save();
    Canvas.ctx.font = "600 9px monospace, sans-serif";
    Canvas.ctx.fillStyle = "#cbd5e1";

    // A DIP's body starts DIP_INSET inside the pin rows, so its labels start inside that.
    const side = this.isModule ? 10 : DIP_INSET + 4;
    const end = this.isModule ? 16 : DIP_INSET + 11;
    const endBottom = this.isModule ? 10 : DIP_INSET + 2;
    // Keep each side's labels on its half of the body, clear of the name printed down the middle.
    const sideMax = this.isModule ? 1e6 : Math.max(20, (50 * (this.widthPin - 1)) / 2 - side - 12);
    const endMax = this.isModule ? 1e6 : 46;

    if (this.rotationAngle === 0) {
      // 0°: Vertical (Left: 1..N, Right: 2N..N+1)
      const pinsPerSide = this.heightPin;
      const rightX = this.topLeftDot.x + 50 * (this.widthPin - 1);
      for (let i = 0; i < pinsPerSide; i++) {
        const py = this.topLeftDot.y + i * 50;
        const leftPinNum = i + 1;
        const leftDesc = this.pinDescription[leftPinNum];
        Canvas.ctx.textAlign = "left";
        fillCrispText(Canvas.ctx, leftDesc ? `${leftPinNum}:${leftDesc}` : `${leftPinNum}`, this.topLeftDot.x + side, py + 3, sideMax);

        const rightPinNum = pinsPerSide * 2 - i;
        const rightDesc = this.pinDescription[rightPinNum];
        Canvas.ctx.textAlign = "right";
        fillCrispText(Canvas.ctx, rightDesc ? `${rightDesc}:${rightPinNum}` : `${rightPinNum}`, rightX - side, py + 3, sideMax);
      }
    } else if (this.rotationAngle === 90) {
      // 90°: Top: 1..N, Bottom: 2N..N+1
      const pinsPerSide = this.widthPin;
      const bottomY = this.topLeftDot.y + 50 * (this.heightPin - 1);
      for (let i = 0; i < pinsPerSide; i++) {
        const px = this.topLeftDot.x + i * 50;
        const topPinNum = i + 1;
        const topDesc = this.pinDescription[topPinNum];
        Canvas.ctx.textAlign = "center";
        fillCrispText(Canvas.ctx, topDesc ? `${topPinNum}:${topDesc}` : `${topPinNum}`, px, this.topLeftDot.y + end, endMax);

        const bottomPinNum = pinsPerSide * 2 - i;
        const bottomDesc = this.pinDescription[bottomPinNum];
        Canvas.ctx.textAlign = "center";
        fillCrispText(Canvas.ctx, bottomDesc ? `${bottomDesc}:${bottomPinNum}` : `${bottomPinNum}`, px, bottomY - endBottom, endMax);
      }
    } else if (this.rotationAngle === 180) {
      // 180°: Left: 2N..N+1, Right: 1..N
      const pinsPerSide = this.heightPin;
      const rightX = this.topLeftDot.x + 50 * (this.widthPin - 1);
      for (let i = 0; i < pinsPerSide; i++) {
        const py = this.topLeftDot.y + i * 50;
        const leftPinNum = pinsPerSide * 2 - i;
        const leftDesc = this.pinDescription[leftPinNum];
        Canvas.ctx.textAlign = "left";
        fillCrispText(Canvas.ctx, leftDesc ? `${leftPinNum}:${leftDesc}` : `${leftPinNum}`, this.topLeftDot.x + side, py + 3, sideMax);

        const rightPinNum = i + 1;
        const rightDesc = this.pinDescription[rightPinNum];
        Canvas.ctx.textAlign = "right";
        fillCrispText(Canvas.ctx, rightDesc ? `${rightDesc}:${rightPinNum}` : `${rightPinNum}`, rightX - side, py + 3, sideMax);
      }
    } else if (this.rotationAngle === 270) {
      // 270°: Top: 2N..N+1, Bottom: 1..N
      const pinsPerSide = this.widthPin;
      const bottomY = this.topLeftDot.y + 50 * (this.heightPin - 1);
      for (let i = 0; i < pinsPerSide; i++) {
        const px = this.topLeftDot.x + i * 50;
        const topPinNum = pinsPerSide * 2 - i;
        const topDesc = this.pinDescription[topPinNum];
        Canvas.ctx.textAlign = "center";
        fillCrispText(Canvas.ctx, topDesc ? `${topPinNum}:${topDesc}` : `${topPinNum}`, px, this.topLeftDot.y + end, endMax);

        const bottomPinNum = i + 1;
        const bottomDesc = this.pinDescription[bottomPinNum];
        Canvas.ctx.textAlign = "center";
        fillCrispText(Canvas.ctx, bottomDesc ? `${bottomDesc}:${bottomPinNum}` : `${bottomPinNum}`, px, bottomY - endBottom, endMax);
      }
    }

    Canvas.ctx.restore();
  }

  getRealPinPositions(): {pin: number, x: number, y: number}[] {
    if (!this.topLeftDot) return [];
    const positions: {pin: number, x: number, y: number}[] = [];

    if (this.rotationAngle === 0 || this.rotationAngle === 180) {
      const pinsPerSide = this.heightPin;
      const leftX = this.topLeftDot.x;
      const rightX = this.topLeftDot.x + 50 * (this.widthPin - 1);
      for (let i = 0; i < pinsPerSide; i++) {
        const py = this.topLeftDot.y + i * 50;
        const leftPinNum = this.rotationAngle === 0 ? (i + 1) : (pinsPerSide * 2 - i);
        const rightPinNum = this.rotationAngle === 0 ? (pinsPerSide * 2 - i) : (i + 1);
        positions.push({pin: leftPinNum, x: leftX, y: py});
        positions.push({pin: rightPinNum, x: rightX, y: py});
      }
    } else {
      const pinsPerSide = this.widthPin;
      const topY = this.topLeftDot.y;
      const bottomY = this.topLeftDot.y + 50 * (this.heightPin - 1);
      for (let i = 0; i < pinsPerSide; i++) {
        const px = this.topLeftDot.x + i * 50;
        const topPinNum = this.rotationAngle === 90 ? (i + 1) : (pinsPerSide * 2 - i);
        const bottomPinNum = this.rotationAngle === 90 ? (pinsPerSide * 2 - i) : (i + 1);
        positions.push({pin: topPinNum, x: px, y: topY});
        positions.push({pin: bottomPinNum, x: px, y: bottomY});
      }
    }

    return positions;
  }

  drawPinMarkers() {
    const positions = this.getRealPinPositions();
    Canvas.ctx.save();
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = 1.5;
    for (const {x, y} of positions) {
      Canvas.ctx.beginPath();
      Canvas.ctx.arc(x, y, 5, 0, Math.PI * 2);
      Canvas.ctx.stroke();
    }
    Canvas.ctx.restore();
  }

  drawLabel(){
    if (!this.topLeftDot) return;
    // Chips and boards print their name on the package itself (see drawBody) instead of a badge.
    this.drawPinMarkers();
    this.drawPinLabels();
  }

  // The body goes under the holes; the name badge and pin labels go on top of everything.
  draw(selected: boolean){
    this.drawBody(selected);
  }

  drawOverlay(){
    this.drawLabel();
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
    return copy;
  }

  getPinPositionOnIC(dot: IDot) {
    if (this.topLeftDot == null) {
      return null;
    }

    if (this.rotationAngle === 0) {
      // 0°: Vertical (Side A = Left: 1..N, Side B = Right: 2N..N+1)
      const isOnLeftSide = dot.x === this.topLeftDot.x && dot.y >= this.topLeftDot.y && dot.y <= this.topLeftDot.y + ((this.heightPin - 1) * 50);
      const isOnRightSide = dot.x === this.topLeftDot.x + 50 * (this.widthPin - 1) && dot.y >= this.topLeftDot.y && dot.y <= this.topLeftDot.y + ((this.heightPin - 1) * 50);
      if (!(isOnLeftSide || isOnRightSide)) return null;

      const relativeY = dot.y - this.topLeftDot.y;
      const i = Math.round(relativeY / 50);
      if (i >= 0 && i < this.heightPin) {
        const pinNbr = isOnLeftSide ? (i + 1) : (this.heightPin * 2 - i);
        return { pin: pinNbr, info: this.pinDescription[pinNbr] };
      }
    } else if (this.rotationAngle === 90) {
      // 90°: Horizontal (Side A = Top: 1..N, Side B = Bottom: 2N..N+1)
      const isOnTopSide = dot.y === this.topLeftDot.y && dot.x >= this.topLeftDot.x && dot.x <= this.topLeftDot.x + ((this.widthPin - 1) * 50);
      const isOnBottomSide = dot.y === this.topLeftDot.y + 50 * (this.heightPin - 1) && dot.x >= this.topLeftDot.x && dot.x <= this.topLeftDot.x + ((this.widthPin - 1) * 50);
      if (!(isOnTopSide || isOnBottomSide)) return null;

      const relativeX = dot.x - this.topLeftDot.x;
      const i = Math.round(relativeX / 50);
      if (i >= 0 && i < this.widthPin) {
        const pinNbr = isOnTopSide ? (i + 1) : (this.widthPin * 2 - i);
        return { pin: pinNbr, info: this.pinDescription[pinNbr] };
      }
    } else if (this.rotationAngle === 180) {
      // 180°: Vertical (Side A = Right: 1..N, Side B = Left: 2N..N+1)
      const isOnLeftSide = dot.x === this.topLeftDot.x && dot.y >= this.topLeftDot.y && dot.y <= this.topLeftDot.y + ((this.heightPin - 1) * 50);
      const isOnRightSide = dot.x === this.topLeftDot.x + 50 * (this.widthPin - 1) && dot.y >= this.topLeftDot.y && dot.y <= this.topLeftDot.y + ((this.heightPin - 1) * 50);
      if (!(isOnLeftSide || isOnRightSide)) return null;

      const relativeY = dot.y - this.topLeftDot.y;
      const i = Math.round(relativeY / 50);
      if (i >= 0 && i < this.heightPin) {
        const pinNbr = isOnRightSide ? (i + 1) : (this.heightPin * 2 - i);
        return { pin: pinNbr, info: this.pinDescription[pinNbr] };
      }
    } else if (this.rotationAngle === 270) {
      // 270°: Horizontal (Side A = Bottom: 1..N, Side B = Top: 2N..N+1)
      const isOnTopSide = dot.y === this.topLeftDot.y && dot.x >= this.topLeftDot.x && dot.x <= this.topLeftDot.x + ((this.widthPin - 1) * 50);
      const isOnBottomSide = dot.y === this.topLeftDot.y + 50 * (this.heightPin - 1) && dot.x >= this.topLeftDot.x && dot.x <= this.topLeftDot.x + ((this.widthPin - 1) * 50);
      if (!(isOnTopSide || isOnBottomSide)) return null;

      const relativeX = dot.x - this.topLeftDot.x;
      const i = Math.round(relativeX / 50);
      if (i >= 0 && i < this.widthPin) {
        const pinNbr = isOnBottomSide ? (i + 1) : (this.widthPin * 2 - i);
        return { pin: pinNbr, info: this.pinDescription[pinNbr] };
      }
    }
    return null;
  }

  getPinNumber(dot: IDot){
    if (!this.getPinPositionOnIC(dot) || !this.topLeftDot){
      return null;
    }

    const relativeY = dot.y - this.topLeftDot.y;
    const pinNumber = Math.floor(relativeY / 50) + 1;

    if (pinNumber > 0 && pinNumber <= this.widthPin) {
      return { pin: pinNumber, info: this.pinDescription[pinNumber]};
    }
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
