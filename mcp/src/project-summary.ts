import {ProjectFile} from "./editor";

// A project in a few words, for the top of replies.

export const boardSummary = (board: ProjectFile["board"]) => `${board.cols}×${board.rows} ${board.type}`;

export const partCount = (project: ProjectFile) =>
  project.placedIcs.length + project.placedStandardComponents.length + project.placedAdvancedComponents.length;
