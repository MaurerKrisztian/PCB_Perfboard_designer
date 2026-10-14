import {Canvas} from "../state/Canvas";

export function applyCanvasResolution(zoom: number): void {
  const dpr = window.devicePixelRatio || 1;
  const effectiveScale = dpr * zoom;
  const targetW = Math.round(Canvas.gridWidth * effectiveScale);
  const targetH = Math.round(Canvas.gridHeight * effectiveScale);

  Canvas.c.width = targetW;
  Canvas.c.height = targetH;
  // Size the element to a whole number of device pixels, so the browser shows the backing store
  // 1:1 instead of resampling it (which blurs it whenever zoom x dpr is fractional, e.g. 63%).
  Canvas.c.style.width = `${targetW / dpr}px`;
  Canvas.c.style.height = `${targetH / dpr}px`;
  Canvas.ctx.setTransform(targetW / Canvas.gridWidth, 0, 0, targetH / Canvas.gridHeight, 0, 0);
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
