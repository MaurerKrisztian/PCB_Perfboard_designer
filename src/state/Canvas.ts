import {Utils} from "../utils/utils";

export class Canvas {
  static c =Utils.getSafeHtmlElement<HTMLCanvasElement>("myCanvas");
  static ctx = Canvas.c.getContext("2d") as CanvasRenderingContext2D;
  static gridWidth = Canvas.c.width;
  static gridHeight = Canvas.c.height;

  static toDrawingCoordinates(e: MouseEvent): {x: number, y: number} {
    const rect = Canvas.c.getBoundingClientRect();
    const scaleX = Canvas.gridWidth / rect.width;
    const scaleY = Canvas.gridHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }
}
