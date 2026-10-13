import {Utils} from "../utils/utils";
import {BoardSetup, BoardState} from "../state/BoardState";
import {HistoryState} from "../state/HistoryState";
import {ToolState} from "../state/ToolState";
import {BoardType, StripDirection} from "../project-file/project-file";
import {redrawCanvas} from "./draw-canvas";
import {updateSelectionStatus} from "./selection-status";

// The Board section's perfboard / stripboard switch, and the strip direction switch shown for a
// stripboard. Switching only changes how the board is drawn and saved: wires, parts, marked holes
// and strip cuts all stay where they are.

const boardTypeButtons = document.querySelectorAll<HTMLButtonElement>('#boardTypeSelector [data-board-type]');
const stripDirectionButtons = document.querySelectorAll<HTMLButtonElement>('#stripDirectionSelector [data-strips]');
const stripDirectionSelector = Utils.getSafeHtmlElement('stripDirectionSelector');
const cutToolButton = Utils.getSafeHtmlElement('cutToolBtn');

function syncBoardControls() {
  const {type, strips} = BoardState.setup;
  boardTypeButtons.forEach(btn => btn.classList.toggle('active-mode', btn.dataset.boardType === type));
  stripDirectionButtons.forEach(btn => btn.classList.toggle('active-mode', btn.dataset.strips === strips));
  stripDirectionSelector.hidden = type !== "stripboard";
  cutToolButton.hidden = type !== "stripboard";
}

// Puts the board into this setup, without recording history: for loading and undo/redo. The
// caller redraws.
export function setBoardSetup(setup: BoardSetup) {
  BoardState.setup = {...setup};
  syncBoardControls();
  if (!BoardState.isStripboard && ToolState.active.kind === "cut") {
    ToolState.active = {kind: "select"};
    updateSelectionStatus();
  }
}

function switchBoard(change: Partial<BoardSetup>) {
  const from = BoardState.setup;
  const to = {...from, ...change};
  if (to.type === from.type && to.strips === from.strips) return;
  setBoardSetup(to);
  HistoryState.record({type: "set", kind: "board", from, to});
  redrawCanvas();
}

boardTypeButtons.forEach(btn => btn.addEventListener('click', () => {
  switchBoard({type: btn.dataset.boardType as BoardType});
}));
stripDirectionButtons.forEach(btn => btn.addEventListener('click', () => {
  switchBoard({strips: btn.dataset.strips as StripDirection});
}));

syncBoardControls();
