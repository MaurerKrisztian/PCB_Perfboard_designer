import {Canvas} from "../state/Canvas";
import {State} from "../state/State";

export function resetCanvas(){
  Canvas.ctx.fillStyle = State.canvasBackgroundColor
  Canvas.ctx.clearRect(0, 0, Canvas.c.width, Canvas.c.height);
  Canvas.ctx.fillRect(0, 0, Canvas.c.width, Canvas.c.height);
  Canvas.ctx.fill()
}
