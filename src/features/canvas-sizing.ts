import {Canvas} from "../state/Canvas";

export function applyCanvasResolution(zoom: number): void {
  const dpr = window.devicePixelRatio || 1;
  const effectiveScale = dpr * zoom;
  const targetW = Math.round(Canvas.gridWidth * effectiveScale);
  const targetH = Math.round(Canvas.gridHeight * effectiveScale);

  Canvas.c.width = targetW;
  Canvas.c.height = targetH;
  Canvas.c.style.width = `${Canvas.gridWidth * zoom}px`;
  Canvas.c.style.height = `${Canvas.gridHeight * zoom}px`;
  Canvas.ctx.setTransform(effectiveScale, 0, 0, effectiveScale, 0, 0);
}

function watchDevicePixelRatio(onChange: () => void): void {
  const mql = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mql.addEventListener('change', () => {
    onChange();
    watchDevicePixelRatio(onChange);
  }, { once: true });
}

export function startDevicePixelRatioWatch(getCurrentZoom: () => number, redrawCanvas: () => void): void {
  watchDevicePixelRatio(() => {
    applyCanvasResolution(getCurrentZoom());
    redrawCanvas();
  });
}
