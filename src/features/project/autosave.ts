import {onRedraw} from "../draw-canvas";
import {getSaveJson} from "./save-project";
import {loadProject} from "./load-project";

// Keeps the board in localStorage as it's edited, and restores it on the next visit. Every change
// to the board ends in a redraw, so a redraw is what schedules a save. Hovering redraws too, so a
// save only writes when the project differs from what it last stored.

const SAVE_KEY = "save";
// Where a stored board this version can't read is moved to, so autosaving the empty board doesn't
// destroy it. It may be from a newer version of the app, open in another tab.
const UNREADABLE_SAVE_KEY = "save-unreadable";
const SAVE_DELAY_MS = 500;

// Until the stored board is restored, the board on screen is the empty startup grid, and saving
// it would overwrite the user's work.
let restored = false;
let pendingSave: number | undefined;
let lastSaved: string | undefined;

function saveNow() {
  window.clearTimeout(pendingSave);
  pendingSave = undefined;
  if (!restored) return;
  const json = JSON.stringify(getSaveJson());
  if (json === lastSaved) return;
  try {
    localStorage.setItem(SAVE_KEY, json);
    lastSaved = json;
  } catch (e) {
    console.error("Can't autosave the board to local storage.", e);
  }
}

// Timed from the first redraw after a save rather than the last, so a stream of redraws (moving
// the mouse, dragging a part) can't keep putting the save off.
function scheduleSave() {
  if (pendingSave === undefined) pendingSave = window.setTimeout(saveNow, SAVE_DELAY_MS);
}

onRedraw(scheduleSave);

// A tab being closed or sent to the background may never get to run the pending save.
window.addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
});

// Restores the stored board (any file version). Waits for DOMContentLoaded because index.ts lays
// out a fresh grid after importing the feature modules, which would replace it.
window.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem(SAVE_KEY);
  if (stored !== null) {
    try {
      const {skipped} = loadProject(JSON.parse(stored));
      if (skipped > 0) console.warn(`Saved board: ${skipped} item(s) couldn't be read and were left out.`);
    } catch (e) {
      console.error("Can't load the saved board from local storage.", e);
      // If even this fails, `restored` stays false and nothing is autosaved over it.
      localStorage.setItem(UNREADABLE_SAVE_KEY, stored);
    }
  }
  restored = true;
});
