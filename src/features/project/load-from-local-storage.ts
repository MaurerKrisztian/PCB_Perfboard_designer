import {loadProject} from "./load-project";

// Restores the board last stored with "Save progress" (any file version).
window.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('save');
  if (stored === null) return;
  try {
    const {skipped} = loadProject(JSON.parse(stored));
    if (skipped > 0) console.warn(`Saved board: ${skipped} item(s) couldn't be read and were left out.`);
  } catch (e) {
    console.error("Can't load the saved board from local storage.", e);
  }
});
