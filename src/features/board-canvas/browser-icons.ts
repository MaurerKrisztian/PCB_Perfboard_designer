import {COMPONENT_ICON_DIR} from "../../parts/component-definitions";

// Part artwork for canvas painters, loaded from the site's icon folder by file name ("resistor.svg").
// The first ask starts the load and gets nothing; once it's loaded, the icon is there for every
// later draw, and the listeners hear about it so they can draw again.

interface Entry {
  img: HTMLImageElement;
  loaded: boolean;
  done: Promise<void>;
}

const entries = new Map<string, Entry>();
const loadListeners: (() => void)[] = [];

function entryFor(icon: string): Entry {
  let entry = entries.get(icon);
  if (!entry) {
    const img = new Image();
    const created: Entry = {
      img,
      loaded: false,
      done: new Promise<void>(resolve => {
        img.onload = () => {
          created.loaded = true;
          resolve();
          for (const listener of loadListeners) listener();
        };
        // A missing icon stays missing: the renderer draws its stand-in.
        img.onerror = () => resolve();
      }),
    };
    entry = created;
    entries.set(icon, entry);
    img.src = `${COMPONENT_ICON_DIR}${icon}`;
  }
  return entry;
}

export const browserIcons = {
  // The icon once it has loaded, else undefined (and the load is started).
  image(icon: string): HTMLImageElement | undefined {
    const entry = entryFor(icon);
    return entry.loaded ? entry.img : undefined;
  },

  // Resolves once every one of these has loaded or failed, for one-off drawings (thumbnails,
  // exports) that can't wait for a redraw.
  async ready(icons: string[]): Promise<void> {
    await Promise.all(icons.map(icon => entryFor(icon).done));
  },

  onLoad(listener: () => void) {
    loadListeners.push(listener);
  },
};
