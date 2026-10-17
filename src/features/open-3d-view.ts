import {getSaveJson} from "./project/save-project";

// The 3D viewer only ever gets a snapshot of the project file (the same JSON "Save Project"
// writes), never live editor state, and is loaded on demand so three.js isn't part of the
// editor's own bundle.
// Every `data-open-3d` element (the header button and the View menu item) opens it.
async function open3dView() {
  const project = JSON.parse(JSON.stringify(getSaveJson()));
  const viewer = await import("../viewer-3d/viewer-3d").catch((err: unknown) => {
    console.error(err);
    return undefined;
  });
  if (!viewer) {
    alert("Couldn't load the 3D view. Check your connection and try again.");
    return;
  }
  try {
    viewer.openViewer3d(project);
  } catch (err) {
    // Almost always WebGL: turned off, blocked, or not supported by this browser or device.
    console.error(err);
    alert("Couldn't start the 3D view. It needs WebGL, which this browser has turned off or doesn't support: try turning on hardware acceleration in its settings, or another browser.");
  }
}

document.querySelectorAll('[data-open-3d]').forEach(el => el.addEventListener('click', open3dView));
