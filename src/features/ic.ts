import {Canvas} from "../state/Canvas";
import {State} from "../state/State";
import {IDot} from "../interfaces/dot.interface";
import {ShortcutRegistry} from "./shortcut-keys";
import {Utils} from "../utils/utils";


export class Ic{
  static IC_CONTAINER: Ic[] = []

  public id = Math.random() *  100;
  topLeftDot: IDot | null = null;
  constructor(public widthPin: number, public heightPin: number, public pinDescription: Record<number, string>,public name:string) {
  }


  static add(ic: Ic){
    this.IC_CONTAINER.push(ic);
    this.showICs()
  }
  static showICs(){
    console.log("draw", Ic.IC_CONTAINER)
    Utils.getSafeHtmlElement("ic-items").innerHTML = Ic.IC_CONTAINER.map((item)=>{return `<button onclick='selectIc(${item.id})'> ${item.name}</button>, `}).join(" ")
  console.log(Utils.getSafeHtmlElement("ic-items").innerHTML)
  }

  updatePosition(x:number,y:number){
    const w = 50 * (this.widthPin - 1)
    const h = 50 * (this.heightPin - 1)
    const xPoz = x - (w / 2)
    const yPoz = y - (h / 2)

    let minDistance: number|null = null
    let minDot: IDot|null = null
    for (const dot of State.dots) {
      const distance = this.calculateDistance(dot.x, dot.y, xPoz, yPoz);
      if (minDistance == null){
        minDistance = distance;
      }
      if (distance < minDistance){
        minDistance = distance
        minDot = dot;
      }
    }
    this.topLeftDot = minDot;
  }

  draw(){
    if (!this.topLeftDot) return;
    // Canvas.ctx.clearRect(0, 0, Canvas.c.width, Canvas.c.height);
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = "rgba(49,45,45,0.62)";

    const w = 50 * (this.widthPin - 1)
    const h = 50 * (this.heightPin - 1)
    Canvas.ctx.rect(this.topLeftDot?.x, this.topLeftDot?.y, w, h);
    Canvas.ctx.stroke();
    Canvas.ctx.fill();
  }

  getPinPositionOnIC(dot: IDot) {
    if (this.topLeftDot == null){
      return false;
    }
    // return dot == this.topLeftDot;
    const isOnLeftSide = dot.x == this.topLeftDot.x && dot.y >= this.topLeftDot.y && dot.y <= this.topLeftDot.y + ((this.heightPin-1)*50 ) ;
    const isOnRightSide = dot.x == this.topLeftDot.x + 50 * (this.widthPin-1) && dot.y >= this.topLeftDot.y && dot.y <= this.topLeftDot.y + ((this.heightPin-1)*50 ) ;
    if (!( isOnLeftSide || isOnRightSide)){
      return null;
    }

      const pinHeight = ((this.heightPin - 1) * 50);
      const relativeY = dot.y - this.topLeftDot.y;
      const pinNumber = Math.floor(relativeY / 50) + 1;

      if (pinNumber > 0 && pinNumber <= this.heightPin) {
        // return pinNumber;
        if (isOnRightSide){
          console.log("rightttttt", pinNumber, pinNumber + this.heightPin)
          const pinNbr = (this.heightPin * 2 - pinNumber + 1)
          return { pin: pinNbr, info: this.pinDescription[pinNbr]};
        }
        console.log(this.pinDescription)
        return { pin: pinNumber, info: this.pinDescription[pinNumber]};
      }
  }
  getPinNumber(dot: IDot){
    if (!this.getPinPositionOnIC(dot) || !this.topLeftDot){
      return null;
    }

    // const pinHeight = ((this.heightPin - 1) * 50);
    const relativeY = dot.y - this.topLeftDot.y;
    const pinNumber = Math.floor(relativeY / 50) + 1;

    if (pinNumber > 0 && pinNumber <= this.widthPin) {
      return { pin: pinNumber, info: this.pinDescription[pinNumber]};
    }
  }

  calculateDistance(x1, y1, x2, y2) {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    return distance;
  }

  rotate(){
    const tmp = this.widthPin;
    this.widthPin = this.heightPin;
    this.heightPin = tmp;
  }
}

// Todo just for the demo.

Ic.add(new Ic(4, 8, {}, "IC-8Pin"));
Ic.add(new Ic(4, 12, {}, "IC-12Pin"));
Ic.add(new Ic(4, 14,{}, "IC-14Pin"));
Ic.add(new Ic(4, 16, {}, "IC-16Pin"));
Ic.add(new Ic(4, 18,{}, "IC-18Pin"));
export const myIc = new Ic(3,6,{1: "Vcc", 2: "Gnd", 3: "input", 4: "output"}, "Demo" )
Ic.add(myIc);
export function selectIc(id: string){
  const ic = Ic.IC_CONTAINER.find(ic=>ic.id==id);
  if (!ic){
    console.error(`Ic with id: ${id}not found`)
  }
  console.log("selected ic is", ic);
  State.selectedIc = ic;
}

window.selectIc = selectIc


ShortcutRegistry.add({key: "n", event: ()=>{
    Ic.showICs();
  }})
