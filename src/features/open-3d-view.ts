import {getSaveJson} from "./project/save-project";

// The 3D viewer only ever gets a snapshot of the project file (the same JSON "Save Project"
// writes), never live editor state, and is loaded on demand so three.js isn't part of the
// editor's own bundle.
// Every `data-open-3d` element (the header button and the View menu item) opens it.
async function open3dView() {
  const project = JSON.parse(JSON.stringify(getSaveJson()));
  const {openViewer3d} = await import("../viewer-3d/viewer-3d");
  openViewer3d(project);
}

document.querySelectorAll('[data-open-3d]').forEach(el => el.addEventListener('click', open3dView));
