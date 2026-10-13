import {BoardType, StripDirection} from "../project-file/project-file";

// What kind of board the layout is on. Change it through setBoardSetup (board-type.ts), which
// also keeps the sidebar switches and the Cut tool in step. Strip cuts live on the dots
// (IDot.cut), so they survive a resize and stay put while the board is shown as a perfboard.
export interface BoardSetup {
  type: BoardType;
  // Stripboard only; kept while on a perfboard so switching back restores it.
  strips: StripDirection;
}

export class BoardState {
  static setup: BoardSetup = {type: "perfboard", strips: "horizontal"};

  static get isStripboard(): boolean {
    return BoardState.setup.type === "stripboard";
  }
}
