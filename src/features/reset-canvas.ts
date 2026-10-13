import {Canvas} from "../state/Canvas";
import {activeBoardLook} from "./board-looks";

export function resetCanvas(){
  Canvas.ctx.clearRect(0, 0, Canvas.gridWidth, Canvas.gridHeight);
  activeBoardLook().paintBoard(Canvas.gridWidth, Canvas.gridHeight);
}
