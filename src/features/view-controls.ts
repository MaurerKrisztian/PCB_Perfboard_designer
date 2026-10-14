import {Canvas} from "../state/Canvas";
import {applyCanvasResolution, startDevicePixelRatioWatch} from "./canvas-sizing";
import {redrawCanvas} from "./draw-canvas";
import {ViewState} from "../state/ViewState";

// Fullscreen Focus Mode & Board Zoom Management
let currentZoom = 1.0;
let isFullscreenMode = false;
let isFitMode = false;

export function getCurrentZoom(): number {
  return currentZoom;
}

function applyZoom(zoom: number) {
  currentZoom = Math.min(3.0, Math.max(0.2, zoom));
  applyCanvasResolution(currentZoom);
  redrawCanvas();
  const zoomText = `${Math.round(currentZoom * 100)}%`;
  const text1 = document.getElementById('zoomLevelText');
  const text2 = document.getElementById('fsZoomText');
  if (text1) text1.innerText = zoomText;
  if (text2) text2.innerText = zoomText;
}

// Zooms while keeping the content point under (anchorClientX, anchorClientY) fixed on screen,
// so zoom expands around that point instead of always growing toward the container's bottom-right.
function applyZoomAnchored(zoom: number, anchorClientX: number, anchorClientY: number) {
  const container = document.getElementById('canvas-container');
  const beforeRect = Canvas.c.getBoundingClientRect();
  const fracX = beforeRect.width > 0 ? (anchorClientX - beforeRect.left) / beforeRect.width : 0.5;
  const fracY = beforeRect.height > 0 ? (anchorClientY - beforeRect.top) / beforeRect.height : 0.5;

  applyZoom(zoom);

  if (!container) return;
  const afterRect = Canvas.c.getBoundingClientRect();
  const currentX = afterRect.left + fracX * afterRect.width;
  const currentY = afterRect.top + fracY * afterRect.height;
  container.scrollLeft += currentX - anchorClientX;
  container.scrollTop += currentY - anchorClientY;
}

function getContainerCenterClientPoint(): {x: number, y: number} | null {
  const container = document.getElementById('canvas-container');
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
}

startDevicePixelRatioWatch(getCurrentZoom, redrawCanvas);

function zoomIn() {
  const center = getContainerCenterClientPoint();
  if (center) {
    applyZoomAnchored(currentZoom + 0.15, center.x, center.y);
  } else {
    applyZoom(currentZoom + 0.15);
  }
}

function zoomOut() {
  const center = getContainerCenterClientPoint();
  if (center) {
    applyZoomAnchored(currentZoom - 0.15, center.x, center.y);
  } else {
    applyZoom(currentZoom - 0.15);
  }
}

export function fitToScreen(forcefit?: boolean) {
  const fitBtn = document.getElementById('zoomFitBtn');
  if (!forcefit && isFitMode) {
    isFitMode = false;
    applyZoom(1.0);
    if (fitBtn) { fitBtn.innerText = '🎯 Fit'; fitBtn.className = 'btn-accent'; }
    return;
  }
  const container = document.getElementById('canvas-container');
  if (!container || !Canvas.c) return;
  const rect = container.getBoundingClientRect();
  const availableWidth = rect.width - 20;
  const availableHeight = rect.height - 20;
  const canvasW = Canvas.gridWidth;
  const canvasH = Canvas.gridHeight;

  if (availableWidth <= 0 || availableHeight <= 0) return;

  const scaleX = availableWidth / canvasW;
  const scaleY = availableHeight / canvasH;
  const fitScale = Math.min(scaleX, scaleY) * 0.95;
  applyZoom(fitScale);
  isFitMode = true;
  if (fitBtn) { fitBtn.innerText = '✕ Reset'; fitBtn.className = 'btn-danger'; }
}

// Whether the tools sidebar (left) and the Keyboard Shortcuts panel (right) are shown; remembered
// between visits. Both are View menu checkboxes backed by the same helpers.
const SIDEBAR_STORAGE_KEY = 'show_tools_sidebar';
const SHORTCUTS_PANEL_STORAGE_KEY = 'show_shortcuts_panel';

function setPanelVisible(panelId: string, menuItemId: string, show: boolean) {
  document.getElementById(panelId)?.classList.toggle('sidebar-collapsed', !show);
  const item = document.getElementById(menuItemId);
  item?.setAttribute('aria-checked', String(show));
  const check = item?.querySelector('.menu-check');
  if (check) check.textContent = show ? '✓' : '';
}

function togglePanel(panelId: string, menuItemId: string, storageKey: string) {
  const show = document.getElementById(panelId)?.classList.contains('sidebar-collapsed') ?? false;
  setPanelVisible(panelId, menuItemId, show);
  try {
    localStorage.setItem(storageKey, String(show));
  } catch (e) {
    console.error("Failed to save panel visibility to localStorage", e);
  }
  setTimeout(() => fitToScreen(true), 80);
}

function restorePanel(panelId: string, menuItemId: string, storageKey: string) {
  try {
    setPanelVisible(panelId, menuItemId, localStorage.getItem(storageKey) !== 'false');
  } catch (e) {
    console.error("Failed to load panel visibility from localStorage", e);
  }
}

restorePanel('controls', 'toggleSidebarBtn', SIDEBAR_STORAGE_KEY);
restorePanel('shortcutsPanel', 'toggleShortcutsBtn', SHORTCUTS_PANEL_STORAGE_KEY);

function toggleFullscreenMode(enable?: boolean) {
  isFullscreenMode = enable !== undefined ? enable : !isFullscreenMode;
  const layout = document.getElementById('mainAppLayout');
  const btn1 = document.getElementById('toggleFullscreenBtn');
  const btn2 = document.getElementById('canvasFullscreenTrigger');

  if (isFullscreenMode) {
    document.body.classList.add('fullscreen-active');
    layout?.classList.add('fullscreen-mode');
    if (btn1) btn1.innerText = 'Exit Fullscreen';
    if (btn2) {
      btn2.innerText = '✕ Exit Fullscreen';
      btn2.className = 'btn-danger';
    }
    setTimeout(() => {
      fitToScreen(true);
    }, 50);
  } else {
    document.body.classList.remove('fullscreen-active');
    layout?.classList.remove('fullscreen-mode');
    if (btn1) btn1.innerText = 'Fullscreen';
    if (btn2) {
      btn2.innerText = '⛶ Fullscreen';
      btn2.className = 'btn';
    }
    applyZoom(1.0);
  }
}

// Named from when the labels showed values only; kept so the remembered preference carries over.
const PART_LABELS_STORAGE_KEY = 'show_component_values';

function setPartLabelsVisible(show: boolean) {
  ViewState.showPartLabels = show;
  const btn = document.getElementById('toggleValuesBtn');
  if (btn) {
    btn.innerText = show ? '🏷 Labels: On' : '🏷 Labels';
    btn.className = show ? 'btn-accent' : 'btn';
  }
}

function togglePartLabels() {
  setPartLabelsVisible(!ViewState.showPartLabels);
  try {
    localStorage.setItem(PART_LABELS_STORAGE_KEY, String(ViewState.showPartLabels));
  } catch (e) {
    console.error("Failed to save part label visibility to localStorage", e);
  }
  redrawCanvas();
}

// Restore the remembered preference; index.ts does the initial redraw after all imports.
try {
  setPartLabelsVisible(localStorage.getItem(PART_LABELS_STORAGE_KEY) === 'true');
} catch (e) {
  console.error("Failed to load part label visibility from localStorage", e);
}

// Bind Zoom, Part labels & Fullscreen buttons
document.getElementById('zoomInBtn')?.addEventListener('click', zoomIn);
document.getElementById('zoomOutBtn')?.addEventListener('click', zoomOut);
document.getElementById('zoomFitBtn')?.addEventListener('click', () => fitToScreen());
document.getElementById('toggleValuesBtn')?.addEventListener('click', togglePartLabels);

document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => togglePanel('controls', 'toggleSidebarBtn', SIDEBAR_STORAGE_KEY));
document.getElementById('toggleShortcutsBtn')?.addEventListener('click', () => togglePanel('shortcutsPanel', 'toggleShortcutsBtn', SHORTCUTS_PANEL_STORAGE_KEY));

document.getElementById('toggleFullscreenBtn')?.addEventListener('click', () => toggleFullscreenMode());
document.getElementById('canvasFullscreenTrigger')?.addEventListener('click', () => toggleFullscreenMode());

// Mouse Wheel Zoom on canvas (coalesced to at most one resize+redraw per frame),
// anchored to the cursor position so the point under the mouse stays fixed.
let pendingWheelZoom: number | null = null;
let pendingWheelAnchor: {x: number, y: number} | null = null;
Canvas.c?.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const base = pendingWheelZoom ?? currentZoom;
  pendingWheelZoom = base + (e.deltaY < 0 ? 0.15 : -0.15);
  pendingWheelAnchor = {x: e.clientX, y: e.clientY};
  requestAnimationFrame(() => {
    if (pendingWheelZoom !== null && pendingWheelAnchor !== null) {
      applyZoomAnchored(pendingWheelZoom, pendingWheelAnchor.x, pendingWheelAnchor.y);
      pendingWheelZoom = null;
      pendingWheelAnchor = null;
    }
  });
}, { passive: false });

window.addEventListener('resize', () => {
  if (isFullscreenMode) {
    fitToScreen(true);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isFullscreenMode) {
    toggleFullscreenMode(false);
  }
  if ((e.key === 'f' || e.key === 'F') && (e.target === document.body || e.target === Canvas.c)) {
    toggleFullscreenMode();
  }
});

// Collapsible sidebar sections
document.querySelectorAll('.section-title[data-collapse]').forEach(title => {
  title.addEventListener('click', () => {
    const targetId = (title as HTMLElement).getAttribute('data-collapse');
    if (!targetId) return;
    const body = document.getElementById(targetId);
    if (!body) return;
    body.classList.toggle('collapsed');
    title.classList.toggle('section-collapsed');
  });
});
