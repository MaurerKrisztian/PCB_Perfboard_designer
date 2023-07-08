import {Utils} from "../utils/utils";

export class Canvas {
  static c =Utils.getSafeHtmlElement<HTMLCanvasElement>("myCanvas");
  static ctx = Canvas.c.getContext("2d") as CanvasRenderingContext2D;
}
