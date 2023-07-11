import {resetCanvas} from "./reset-canvas";
import {State} from "../state/State";
import {Canvas} from "../state/Canvas";
import {Ic} from "./ic";
import {IDot} from "../interfaces/dot.interface";
import {ILine} from "../interfaces/line.interface";

function drawDot(dot: IDot){
  Canvas.ctx.beginPath();
  Canvas.ctx.arc(dot.x, dot.y, State.dotRadius, 0, Math.PI*2);
  Canvas.ctx.fillStyle = dot.color;
  Canvas.ctx.fill();
  if(dot == State.selectedDot){
    Canvas.ctx.strokeStyle = "#00f";
    Canvas.ctx.lineWidth = 5;
    Canvas.ctx.stroke();
  }
  if(dot == State.hoverDot){
    Canvas.ctx.strokeStyle = "#8a8a8a";
    Canvas.ctx.lineWidth = 5;
    Canvas.ctx.stroke();
  }

  for (const ic of Ic.IC_CONTAINER) {
    if (ic.getPinPositionOnIC(dot)){
      const pin = ic.getPinPositionOnIC(dot)
      Canvas.ctx.fillStyle = "#e8b0b0";
      Canvas.ctx.font = "10px Arial";
      Canvas.ctx.fillText(((pin?.pin + " " + (pin?.info || "")) || "n").substring(0, 5), dot.x, dot.y + State.dotRadius + 10);
      // dot.color = "white"
      Canvas.ctx.fill();
    }
  }

  if(dot.description){
    Canvas.ctx.font = "10px Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.fillStyle = dot.color;
    if (dot == State.hoverDot){
      Canvas.ctx.fillText(dot.description, dot.x, dot.y + State.dotRadius + 10);
    }else {
      Canvas.ctx.fillText(dot.description.substring(0, 5), dot.x, dot.y + State.dotRadius + 10);
    }
  }
}

function drawLine(line: ILine){
  Canvas.ctx.beginPath();
  Canvas.ctx.moveTo(line.start.x, line.start.y);
  Canvas.ctx.lineTo(line.end.x, line.end.y);
  Canvas.ctx.strokeStyle = line?.color || "#777676";
  Canvas.ctx.lineWidth = (line == State.selectedLine) ? 5 : (line == State.hoverLine) ? 4 : 3;
  Canvas.ctx.stroke();
}
export function redrawCanvas() {
  // Clear canvas
  resetCanvas()
  for (const ic of Ic.IC_CONTAINER) {
    ic.draw();
  }
  // Draw dots
  for(let i = 0; i < State.dots.length; i++) {
    drawDot(State.dots[i])
  }

  // Draw lines
  for(let i = 0; i < State.lines.length; i++) {
    drawLine(State.lines[i])
  }
}
