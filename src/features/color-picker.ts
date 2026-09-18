import {ToolState} from "../state/ToolState";
import {LineState} from "../state/LineState";
import {DotState} from "../state/DotState";
import {setDotColor} from "./dot";
import {setLineColor} from "./line";
import {updateSelectionStatus} from "./selection-status";

// Custom Colors Palette & LocalStorage Persistence
let customColors: string[] = [];

function saveCustomColorsToLocalStorage() {
  try {
    localStorage.setItem('custom_colors', JSON.stringify(customColors));
  } catch (e) {
    console.error("Failed to save custom colors to localStorage", e);
  }
}

function loadCustomColorsFromLocalStorage() {
  try {
    const stored = localStorage.getItem('custom_colors');
    if (stored) {
      customColors = JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load custom colors from localStorage", e);
  }
}

function renderSwatches() {
  const container = document.getElementById('quickSwatches');
  if (!container) return;
  const defaultColors = ["#ef4444", "#3b82f6", "#10b981", "#eab308", "#f97316", "#a855f7", "#ffffff", "#1e293b"];

  let html = defaultColors.map(c =>
    `<button class="color-swatch" data-color="${c}" style="background:${c};" title="${c}"></button>`
  ).join('');

  html += customColors.map(c =>
    `<button class="color-swatch" data-color="${c}" data-custom="true" style="background:${c}; position:relative; border-color:#38bdf8;" title="${c} (Right-click to delete)"></button>`
  ).join('');

  container.innerHTML = html;

  container.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', (e) => {
      const color = (e.currentTarget as HTMLElement).getAttribute('data-color');
      if (!color) return;
      ToolState.activeWireColor = color;
      const badge = document.getElementById('activeColorBadge');
      if (badge) {
        badge.style.background = color;
        badge.style.boxShadow = `0 0 6px ${color}`;
      }
      if (LineState.selectedLine) {
        setLineColor(color);
      } else if (DotState.selectedDot) {
        setDotColor(color);
      }
      updateSelectionStatus();
    });

    swatch.addEventListener('contextmenu', (e) => {
      const target = e.currentTarget as HTMLElement;
      if (target.getAttribute('data-custom') === 'true') {
        e.preventDefault();
        const color = target.getAttribute('data-color');
        if (color) {
          customColors = customColors.filter(c => c !== color);
          saveCustomColorsToLocalStorage();
          renderSwatches();
        }
      }
    });
  });
}

loadCustomColorsFromLocalStorage();
renderSwatches();

// Mouse-Interactive 2D Color Spectrum Selector Handlers
const spectrumCanvas = document.getElementById('colorSpectrumCanvas') as HTMLCanvasElement;
const hueBar = document.getElementById('hueBar') as HTMLInputElement;
const spectrumHandle = document.getElementById('spectrumHandle');
const hexInput = document.getElementById('hexColorInput') as HTMLInputElement;
const previewBox = document.getElementById('colorPreviewBox');
const togglePanelBtn = document.getElementById('toggleCustomColorPanelBtn');
const panel = document.getElementById('customColorPanel');

let currentHue = 195;
let isMouseDownOnSpectrum = false;

togglePanelBtn?.addEventListener('click', () => {
  if (panel) {
    const isOpen = panel.style.display === 'flex';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
      setTimeout(() => {
        drawColorSpectrum();
      }, 50);
    }
  }
});

function drawColorSpectrum() {
  if (!spectrumCanvas) return;
  const ctx = spectrumCanvas.getContext('2d');
  if (!ctx) return;
  const w = spectrumCanvas.width;
  const h = spectrumCanvas.height;

  // 1. Draw base Hue color background
  ctx.fillStyle = `hsl(${currentHue}, 100%, 50%)`;
  ctx.fillRect(0, 0, w, h);

  // 2. Horizontal gradient: White to transparent
  const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
  whiteGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = whiteGrad;
  ctx.fillRect(0, 0, w, h);

  // 3. Vertical gradient: Transparent to Black
  const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
  blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  blackGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = blackGrad;
  ctx.fillRect(0, 0, w, h);
}

function updatePickedColorFromMouse(clientX: number, clientY: number) {
  if (!spectrumCanvas) return;
  const rect = spectrumCanvas.getBoundingClientRect();
  let x = Math.max(0, Math.min(rect.width, clientX - rect.left));
  let y = Math.max(0, Math.min(rect.height, clientY - rect.top));

  if (spectrumHandle) {
    spectrumHandle.style.left = `${x}px`;
    spectrumHandle.style.top = `${y}px`;
  }

  // Sample exact pixel color from canvas
  const ctx = spectrumCanvas.getContext('2d');
  if (ctx) {
    const canvasX = Math.min(spectrumCanvas.width - 1, Math.max(0, Math.round((x / rect.width) * spectrumCanvas.width)));
    const canvasY = Math.min(spectrumCanvas.height - 1, Math.max(0, Math.round((y / rect.height) * spectrumCanvas.height)));
    const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

    if (hexInput) hexInput.value = hex;
    if (previewBox) previewBox.style.background = hex;
    ToolState.activeWireColor = hex;
    const badge = document.getElementById('activeColorBadge');
    if (badge) {
      badge.style.background = hex;
      badge.style.boxShadow = `0 0 6px ${hex}`;
    }
  }
}

hueBar?.addEventListener('input', () => {
  currentHue = parseInt(hueBar.value || "0");
  drawColorSpectrum();
  if (spectrumHandle && spectrumCanvas) {
    const rect = spectrumCanvas.getBoundingClientRect();
    const handleX = parseFloat(spectrumHandle.style.left) || rect.width / 2;
    const handleY = parseFloat(spectrumHandle.style.top) || rect.height / 2;
    updatePickedColorFromMouse(rect.left + handleX, rect.top + handleY);
  }
});

spectrumCanvas?.addEventListener('mousedown', (e) => {
  isMouseDownOnSpectrum = true;
  updatePickedColorFromMouse(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
  if (isMouseDownOnSpectrum) {
    updatePickedColorFromMouse(e.clientX, e.clientY);
  }
});

window.addEventListener('mouseup', () => {
  isMouseDownOnSpectrum = false;
});

document.getElementById('addCustomColorToPaletteBtn')?.addEventListener('click', () => {
  const hex = hexInput?.value.trim();
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    if (!customColors.includes(hex)) {
      customColors.push(hex);
      saveCustomColorsToLocalStorage();
      renderSwatches();
    }
    ToolState.activeWireColor = hex;
    const badge = document.getElementById('activeColorBadge');
    if (badge) badge.style.background = hex;
    if (LineState.selectedLine) {
      setLineColor(hex);
    } else if (DotState.selectedDot) {
      setDotColor(hex);
    }
  }
});
