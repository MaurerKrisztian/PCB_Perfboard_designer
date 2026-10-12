import {Utils} from "../utils/utils";

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return;
  }

  // Keys compare case-insensitively (so Caps Lock doesn't matter); Shift is its own modifier.
  const keyLower = event.key.toLowerCase();
  for (const shortcut of ShortcutRegistry.shortcuts) {
    if (keyLower === shortcut.key.toLowerCase() && event.ctrlKey === !!shortcut.ctrl && event.shiftKey === !!shortcut.shift){
      shortcut.event(event);
    }
  }
});

export interface IShortcut {
  key: string, ctrl?: boolean, shift?: boolean, event: (e: KeyboardEvent)=>void, description?: string
}
export class ShortcutRegistry {
  static shortcuts:  IShortcut[] = [];
  static add(shortcut: IShortcut){
    const clash = this.shortcuts.find((s) => s.key.toLowerCase() === shortcut.key.toLowerCase()
      && !!s.ctrl === !!shortcut.ctrl && !!s.shift === !!shortcut.shift);
    if (clash !== undefined){
      console.warn(`Shortcut key: ${shortcut.key} already exists`)
    }
    this.shortcuts.push(shortcut)
    this.show()
  }

  static show(){
    Utils.getSafeHtmlElement("shortcuts").innerHTML = "<b>Shortcuts:</b> <br>" + this.shortcuts.map(s=> `key: <b>${s.ctrl ? "ctrl + ":""}${s.shift ? "shift + ":""} ${s.key} </b> - ${s.description}`).join("<br>")
  }
}
