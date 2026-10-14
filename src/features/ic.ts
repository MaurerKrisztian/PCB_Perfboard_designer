import {Canvas} from "../state/Canvas";
import {DotState} from "../state/DotState";
import {IDot} from "../interfaces/dot.interface";
import {ShortcutRegistry} from "./shortcut-keys";
import {Utils} from "../utils/utils";
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
import {DIP_INSET, DIP_OVERHANG, dipIconSvg, drawDip} from "./ic-package/dip-shape";


// Both a catalog entry (IC_CONTAINER, the clone armed for placement) and a chip placed on the
// board; only the latter has a topLeftDot and a ref. `id` identifies the catalog entry, not the
// placed chip. Catalog entries are saved through customIcEntries, which picks its fields.
export class Ic implements PlacedPart {
  static IC_CONTAINER: Ic[] = [];

  public id = Math.random() * 100;
  public ref = "";
  public isCustom?: boolean = false;
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

  // Boards on header pins (Arduino Nano…) keep a plain box; every other chip is drawn as a DIP.
  get isModule(): boolean { return isModuleName(this.name); }

  static add(ic: Ic, saveToStorage: boolean = false){
    this.IC_CONTAINER.push(ic);
    if (saveToStorage) {
      this.saveCustomIcsToLocalStorage();
    }
    this.showICs();
  }

  // Opens the custom IC editor for a catalog entry. Set by ic-editor-modal, which imports this
  // module, so importing it back here would be a cycle.
  static onEditCustomIc?: (ic: Ic) => void;

  // Built with DOM calls rather than an HTML string: names and ids come from project files and
  // localStorage, so they must never be parsed as markup.
  static showICs(){
    const container = Utils.getSafeHtmlElement("ic-items");
    container.replaceChildren();
    Ic.IC_CONTAINER.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-accent";
      btn.style.cssText = "padding:0.3rem 0.6rem; font-size:0.75rem;";
      if (item.isModule) {
        btn.textContent = `📦 ${item.name}`;
      } else {
        // The icon is a fixed string with no catalog data in it, so it is safe as markup.
        const icon = document.createElement("span");
        icon.innerHTML = dipIconSvg();
        btn.append(icon, ` ${item.name}`);
      }
      btn.addEventListener("click", () => selectIc(item.id));
      if (item.isCustom) {
        btn.appendChild(Ic.catalogAction("✎", "Edit custom component", "#38bdf8", () => Ic.onEditCustomIc?.(item)));
        btn.appendChild(Ic.catalogAction("✕", "Delete custom component", "#f87171", () => deleteCustomIc(item.id)));
      }
      // Matches the whitespace the old space-joined markup left between buttons.
      if (i > 0) container.appendChild(document.createTextNode(" "));
      container.appendChild(btn);
    });
  }

  private static catalogAction(icon: string, title: string, color: string, onClick: () => void): HTMLSpanElement {
    const span = document.createElement("span");
    span.textContent = icon;
    span.title = title;
    span.style.cssText = `margin-left:6px;cursor:pointer;color:${color};font-weight:bold;`;
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return span;
  }

  // The catalog's custom ICs, in the shape localStorage and project files store them.
  static customIcEntries(): SavedCustomIc[] {
    return Ic.IC_CONTAINER.filter(ic => ic.isCustom).map(ic => ({
      id: ic.id,
      name: ic.name,
      widthPin: ic.widthPin,
      heightPin: ic.heightPin,
      pinDescription: ic.pinDescription,
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
      Ic.IC_CONTAINER.push(newIc);
      added++;
    }
    Ic.showICs();
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

  // Pin rows run along y at 0°/180° and along x at 90°/270°; a DIP's body sticks out past the end pins.
  private get overhang(): number {
    return this.isModule ? 0 : DIP_OVERHANG;
  }

  drawBody(isSelected: boolean){
    if (!this.topLeftDot) return;
    if (!this.isModule) {
      drawDip(Canvas.ctx, {
        x: this.topLeftDot.x,
        y: this.topLeftDot.y,
        widthPin: this.widthPin,
        heightPin: this.heightPin,
        rotation: this.rotationAngle as Rotation,
        selected: isSelected,
        title: this.title,
      });
      return;
    }
    Canvas.ctx.beginPath();
    
    Canvas.ctx.fillStyle = isSelected ? "rgba(30,58,138,0.9)" : "rgba(17,24,39,0.85)";
    Canvas.ctx.strokeStyle = isSelected ? "#38bdf8" : "#475569";
    Canvas.ctx.lineWidth = isSelected ? 3 : 2;

    const w = 50 * (this.widthPin - 1);
    const h = 50 * (this.heightPin - 1);
    Canvas.ctx.rect(this.topLeftDot.x, this.topLeftDot.y, w, h);
    Canvas.ctx.stroke();
    Canvas.ctx.fill();

    // Draw Pin 1 orientation notch
    const notchRadius = 6;
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = "#38bdf8";
    if (this.rotationAngle === 0) {
      Canvas.ctx.arc(this.topLeftDot.x + (w / 2), this.topLeftDot.y, notchRadius, 0, Math.PI);
    } else if (this.rotationAngle === 90) {
      Canvas.ctx.arc(this.topLeftDot.x + w, this.topLeftDot.y + (h / 2), notchRadius, 0.5 * Math.PI, 1.5 * Math.PI);
    } else if (this.rotationAngle === 180) {
      Canvas.ctx.arc(this.topLeftDot.x + (w / 2), this.topLeftDot.y + h, notchRadius, Math.PI, 2 * Math.PI);
    } else if (this.rotationAngle === 270) {
      Canvas.ctx.arc(this.topLeftDot.x, this.topLeftDot.y + (h / 2), notchRadius, 1.5 * Math.PI, 0.5 * Math.PI);
    }
    Canvas.ctx.fill();
    Canvas.ctx.stroke();

    // Draw Pin 1 dot marker
    Canvas.ctx.beginPath();
    let p1x = this.topLeftDot.x + 10;
    let p1y = this.topLeftDot.y + 10;
    if (this.rotationAngle === 90) {
      p1x = this.topLeftDot.x + w - 10;
      p1y = this.topLeftDot.y + 10;
    } else if (this.rotationAngle === 180) {
      p1x = this.topLeftDot.x + w - 10;
      p1y = this.topLeftDot.y + h - 10;
    } else if (this.rotationAngle === 270) {
      p1x = this.topLeftDot.x + 10;
      p1y = this.topLeftDot.y + h - 10;
    }
    Canvas.ctx.arc(p1x, p1y, 3, 0, Math.PI * 2);
    Canvas.ctx.fillStyle = "#38bdf8";
    Canvas.ctx.fill();

    if (isSelected) {
      // Draw selection corner handles
      Canvas.ctx.fillStyle = "#38bdf8";
      Canvas.ctx.fillRect(this.topLeftDot.x - 4, this.topLeftDot.y - 4, 8, 8);
      Canvas.ctx.fillRect(this.topLeftDot.x + w - 4, this.topLeftDot.y - 4, 8, 8);
      Canvas.ctx.fillRect(this.topLeftDot.x - 4, this.topLeftDot.y + h - 4, 8, 8);
      Canvas.ctx.fillRect(this.topLeftDot.x + w - 4, this.topLeftDot.y + h - 4, 8, 8);
    }
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
        Canvas.ctx.fillText(leftDesc ? `${leftPinNum}:${leftDesc}` : `${leftPinNum}`, this.topLeftDot.x + side, py + 3, sideMax);

        const rightPinNum = pinsPerSide * 2 - i;
        const rightDesc = this.pinDescription[rightPinNum];
        Canvas.ctx.textAlign = "right";
        Canvas.ctx.fillText(rightDesc ? `${rightDesc}:${rightPinNum}` : `${rightPinNum}`, rightX - side, py + 3, sideMax);
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
        Canvas.ctx.fillText(topDesc ? `${topPinNum}:${topDesc}` : `${topPinNum}`, px, this.topLeftDot.y + end, endMax);

        const bottomPinNum = pinsPerSide * 2 - i;
        const bottomDesc = this.pinDescription[bottomPinNum];
        Canvas.ctx.textAlign = "center";
        Canvas.ctx.fillText(bottomDesc ? `${bottomDesc}:${bottomPinNum}` : `${bottomPinNum}`, px, bottomY - endBottom, endMax);
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
        Canvas.ctx.fillText(leftDesc ? `${leftPinNum}:${leftDesc}` : `${leftPinNum}`, this.topLeftDot.x + side, py + 3, sideMax);

        const rightPinNum = i + 1;
        const rightDesc = this.pinDescription[rightPinNum];
        Canvas.ctx.textAlign = "right";
        Canvas.ctx.fillText(rightDesc ? `${rightDesc}:${rightPinNum}` : `${rightPinNum}`, rightX - side, py + 3, sideMax);
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
        Canvas.ctx.fillText(topDesc ? `${topPinNum}:${topDesc}` : `${topPinNum}`, px, this.topLeftDot.y + end, endMax);

        const bottomPinNum = i + 1;
        const bottomDesc = this.pinDescription[bottomPinNum];
        Canvas.ctx.textAlign = "center";
        Canvas.ctx.fillText(bottomDesc ? `${bottomDesc}:${bottomPinNum}` : `${bottomPinNum}`, px, bottomY - endBottom, endMax);
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

  drawLabel(isSelected: boolean){
    if (!this.topLeftDot) return;
    // A DIP prints its name on the package itself (see drawBody) instead of a badge.
    if (!this.isModule) {
      this.drawPinMarkers();
      this.drawPinLabels();
      return;
    }
    const w = 50 * (this.widthPin - 1);
    const h = 50 * (this.heightPin - 1);
    const centerX = this.topLeftDot.x + (w / 2);
    const centerY = this.topLeftDot.y + (h / 2);

    const title = this.title;

    Canvas.ctx.save();
    Canvas.ctx.font = "bold 15px Inter, Arial";
    const textWidth = Canvas.ctx.measureText(title).width;
    const badgeW = textWidth + 20;
    const badgeH = 26;

    // Draw background badge pill behind label
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = "#0f172a";
    Canvas.ctx.strokeStyle = isSelected ? "#38bdf8" : "#334155";
    Canvas.ctx.lineWidth = 1.5;
    const rectX = centerX - (badgeW / 2);
    const rectY = centerY - (badgeH / 2);
    Canvas.ctx.rect(rectX, rectY, badgeW, badgeH);
    Canvas.ctx.fill();
    Canvas.ctx.stroke();

    // Draw high-contrast text
    Canvas.ctx.fillStyle = isSelected ? "#38bdf8" : "#ffffff";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.textBaseline = "middle";
    Canvas.ctx.fillText(title, centerX, centerY + 1);
    Canvas.ctx.restore();

    this.drawPinMarkers();
    this.drawPinLabels();
  }

  // The body goes under the holes; the name badge and pin labels go on top of everything.
  draw(selected: boolean){
    this.drawBody(selected);
  }

  drawOverlay(selected: boolean){
    this.drawLabel(selected);
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
    // A DIP's body runs past the end pins, along the pin rows.
    const alongX = this.rotationAngle === 90 || this.rotationAngle === 270 ? this.overhang : 0;
    const alongY = this.overhang - alongX;
    return (
      x >= this.topLeftDot.x - alongX &&
      x <= this.topLeftDot.x + w + alongX &&
      y >= this.topLeftDot.y - alongY &&
      y <= this.topLeftDot.y + h + alongY
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

// Predefined IC components
Ic.add(new Ic(4, 4, {1: "GND", 2: "TRIG", 3: "OUT", 4: "RESET", 5: "CTRL", 6: "THRESH", 7: "DISCH", 8: "VCC"}, "NE555 Timer"));
Ic.add(new Ic(4, 7, {1: "1A", 2: "1B", 3: "1Y", 4: "2A", 5: "2B", 6: "2Y", 7: "GND", 14: "VCC"}, "DIP-14 Logic"));
Ic.add(new Ic(4, 8, {1: "EN", 2: "1D", 3: "1Q", 4: "2D", 5: "2Q", 8: "GND", 16: "VCC"}, "DIP-16 Logic"));
Ic.add(new Ic(4, 14, {1: "RESET", 2: "RX", 3: "TX", 7: "VCC", 8: "GND", 22: "GND", 20: "AVCC"}, "ATmega328P"));
// Arduino Nano: 0.6" between header rows, 15 pins per side. Labels as silkscreened on the board.
Ic.add(new Ic(7, 15, {
  1: "D13", 2: "3V3", 3: "REF", 4: "A0", 5: "A1", 6: "A2", 7: "A3", 8: "A4",
  9: "A5", 10: "A6", 11: "A7", 12: "5V", 13: "RST", 14: "GND", 15: "VIN",
  16: "TX1", 17: "RX0", 18: "RST", 19: "GND", 20: "D2", 21: "D3", 22: "D4",
  23: "D5", 24: "D6", 25: "D7", 26: "D8", 27: "D9", 28: "D10", 29: "D11", 30: "D12"
}, "Arduino Nano"));

// Load custom ICs from localStorage on load
Ic.loadCustomIcsFromLocalStorage();

export function deleteCustomIc(id: number | string) {
  const index = Ic.IC_CONTAINER.findIndex(ic => String(ic.id) === String(id));
  if (index > -1) {
    Ic.IC_CONTAINER.splice(index, 1);
    Ic.saveCustomIcsToLocalStorage();
    Ic.showICs();
  }
}

export function selectIc(id: number | string){
  const ic = Ic.IC_CONTAINER.find(ic => String(ic.id) === String(id));
  if (!ic){
    console.error(`Ic with id: ${id} not found`);
    return;
  }
  setActiveTool({kind: "ic", template: ic.clone()});
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
