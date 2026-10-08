// How the rest of the app tells the Components panel something changed, without importing it.
// Kept import-free on purpose, and only index.ts may import components-panel.ts: the panel imports
// every part source (ic.ts, the arm-* modules...), so any of those importing the panel back forms
// a cycle in which the panel can run before the classes it reads exist - which crashes startup.
let catalogChangedListener: (() => void) | undefined;
let armedPartChangedListener: (() => void) | undefined;

export function onCatalogChanged(fn: () => void) {
  catalogChangedListener = fn;
}

export function onArmedPartChanged(fn: () => void) {
  armedPartChangedListener = fn;
}

// A catalog source changed (custom ICs added, deleted or merged in from a loaded project).
export function notifyCatalogChanged() {
  catalogChangedListener?.();
}

// A different part (or none) is now armed for placement, so the highlight needs refreshing.
export function notifyArmedPartChanged() {
  armedPartChangedListener?.();
}
