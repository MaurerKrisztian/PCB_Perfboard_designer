import {BoardType} from "../../project-file/project-file";
import {BoardState} from "../../state/BoardState";
import {BoardLook} from "./board-look";
import {perfboardLook} from "./perfboard-look";
import {stripboardLook} from "./stripboard-look";

const LOOKS: Record<BoardType, BoardLook> = {
  "perfboard": perfboardLook,
  "stripboard": stripboardLook,
};

export function activeBoardLook(): BoardLook {
  return LOOKS[BoardState.setup.type];
}
