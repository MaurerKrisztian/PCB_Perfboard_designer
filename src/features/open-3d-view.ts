import {Utils} from "../utils/utils";
import {getSaveJson} from "./project/save-project";

// The 3D viewer only ever gets a snapshot of the project file (the same JSON "Save Project"
// writes), never live editor state, and is loaded on demand so three.js isn't part of the
// editor's own bundle.
const open3dViewBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('open3dViewBtn');
open3dViewBtn.addEventListener('click', async () => {
  const project = JSON.parse(JSON.stringify(getSaveJson()));
  const {openViewer3d} = await import("../viewer-3d/viewer-3d");
  openViewer3d(project);
});
