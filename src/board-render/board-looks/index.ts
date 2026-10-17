import {BoardType} from "../../project-file/project-file";
import {BoardLook} from "./board-look";
import {perfboardLook} from "./perfboard-look";
import {stripboardLook} from "./stripboard-look";

// A new board type is a new look here, plus its BoardType in the project file.
const LOOKS: Record<BoardType, BoardLook> = {
  "perfboard": perfboardLook,
  "stripboard": stripboardLook,
};

export function boardLookFor(type: BoardType): BoardLook {
  return LOOKS[type];
}
