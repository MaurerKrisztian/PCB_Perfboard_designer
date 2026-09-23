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
    entry = {img, loaded: false, failed: false};
    cache.set(iconPath, entry);
    img.onload = () => {
      entry!.loaded = true;
      redrawCanvas();
    };
    img.onerror = () => {
      entry!.failed = true;
      redrawCanvas();
    };
    img.src = iconPath;
  }
  return entry;
}
