import {redrawCanvas} from "../draw-canvas";

interface IconCacheEntry {
  img: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
}

const cache = new Map<string, IconCacheEntry>();

export function getCachedIcon(iconPath: string): IconCacheEntry {
  let entry = cache.get(iconPath);
  if (!entry) {
    const img = new Image();
    const created: IconCacheEntry = {img, loaded: false, failed: false};
    entry = created;
    cache.set(iconPath, created);
    img.onload = () => {
      created.loaded = true;
      redrawCanvas();
    };
    img.onerror = () => {
      created.failed = true;
      redrawCanvas();
    };
    img.src = iconPath;
  }
  return entry;
}
