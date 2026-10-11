import {Canvas} from "../state/Canvas";
import {paintBoard} from "./board-appearance";

export function resetCanvas(){
  Canvas.ctx.clearRect(0, 0, Canvas.gridWidth, Canvas.gridHeight);
  paintBoard(Canvas.gridWidth, Canvas.gridHeight);
}
