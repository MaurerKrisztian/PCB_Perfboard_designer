import {Canvas} from "../state/Canvas";
import {GridConfig} from "../state/GridConfig";

export function resetCanvas(){
  Canvas.ctx.fillStyle = GridConfig.canvasBackgroundColor
  Canvas.ctx.clearRect(0, 0, Canvas.c.width, Canvas.c.height);
  Canvas.ctx.fillRect(0, 0, Canvas.c.width, Canvas.c.height);
  Canvas.ctx.fill()
}
