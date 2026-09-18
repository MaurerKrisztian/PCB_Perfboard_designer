import {Canvas} from "../state/Canvas";
import {applyCanvasResolution, startDevicePixelRatioWatch} from "./canvas-sizing";
import {redrawCanvas} from "./draw-canvas";

// Fullscreen Focus Mode & Board Zoom Management
let currentZoom = 1.0;
let isFullscreenMode = false;
let isSidebarVisible = true;
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

startDevicePixelRatioWatch(getCurrentZoom, redrawCanvas);

function zoomIn() {
  applyZoom(currentZoom + 0.15);
}

function zoomOut() {
  applyZoom(currentZoom - 0.15);
}

function fitToScreen(forcefit?: boolean) {
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
  const fitScale = Math.min(scaleX, scaleY);
  applyZoom(fitScale);
  isFitMode = true;
  if (fitBtn) { fitBtn.innerText = '✕ Reset'; fitBtn.className = 'btn-danger'; }
}

function toggleSidebar(show?: boolean) {
  isSidebarVisible = show !== undefined ? show : !isSidebarVisible;
  const sidebar = document.getElementById('controls');
  const btn1 = document.getElementById('toggleSidebarBtn');

  if (sidebar) {
    if (isSidebarVisible) {
      sidebar.classList.remove('sidebar-collapsed');
      if (btn1) btn1.innerText = '◀ Sidebar';
    } else {
      sidebar.classList.add('sidebar-collapsed');
      if (btn1) btn1.innerText = '▶ Sidebar';
    }
  }
  setTimeout(() => fitToScreen(true), 80);
}

function toggleFullscreenMode(enable?: boolean) {
  isFullscreenMode = enable !== undefined ? enable : !isFullscreenMode;
  const layout = document.getElementById('mainAppLayout');
  const btn1 = document.getElementById('toggleFullscreenBtn');
  const btn2 = document.getElementById('canvasFullscreenTrigger');

  if (isFullscreenMode) {
    document.body.classList.add('fullscreen-active');
    layout?.classList.add('fullscreen-mode');
    if (btn1) btn1.innerText = '⛶ Exit Fullscreen';
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
    if (btn1) btn1.innerText = '⛶ Fullscreen';
    if (btn2) {
      btn2.innerText = '⛶ Fullscreen';
      btn2.className = 'btn';
    }
    applyZoom(1.0);
  }
}

// Bind Zoom, Sidebar & Fullscreen buttons
document.getElementById('zoomInBtn')?.addEventListener('click', zoomIn);
document.getElementById('zoomOutBtn')?.addEventListener('click', zoomOut);
document.getElementById('zoomFitBtn')?.addEventListener('click', () => fitToScreen());

document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => toggleSidebar());

document.getElementById('toggleFullscreenBtn')?.addEventListener('click', () => toggleFullscreenMode());
document.getElementById('canvasFullscreenTrigger')?.addEventListener('click', () => toggleFullscreenMode());

// Mouse Wheel Zoom on canvas (coalesced to at most one resize+redraw per frame)
let pendingWheelZoom: number | null = null;
Canvas.c?.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const base = pendingWheelZoom ?? currentZoom;
  pendingWheelZoom = base + (e.deltaY < 0 ? 0.15 : -0.15);
  requestAnimationFrame(() => {
    if (pendingWheelZoom !== null) {
      applyZoom(pendingWheelZoom);
      pendingWheelZoom = null;
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
  title.addEventListener('click', (e) => {
    const targetId = (title as HTMLElement).getAttribute('data-collapse');
    if (!targetId) return;
    const body = document.getElementById(targetId);
    if (!body) return;
    body.classList.toggle('collapsed');
    title.classList.toggle('section-collapsed');
  });
});
