import {IDot} from "../interfaces/dot.interface";

export class ToolState {
  static activeToolMode: 'select' | 'eraser' | 'note' | 'ic' = 'select';
  static armedWire: boolean = false;
  static wireStartDot?: IDot;
  static selectedWireWidth: number = 4;
  static activeWireColor: string = "#3b82f6";
}
