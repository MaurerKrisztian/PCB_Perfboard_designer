import {Utils} from "../utils/utils";

window.addEventListener('keypress', (event) => {
  console.log(event);
  for (const shortcut of ShortcutRegistry.sohortcuts) {
    if (event.key == shortcut.key){
      shortcut.event(event);
    }
  }
});

export interface IShortcut {
  key: string, event: (e: KeyboardEvent)=>void, description?: string
}
export class ShortcutRegistry {
  static sohortcuts:  IShortcut[] = [];
  static add(shortcut: IShortcut){
    if (this.sohortcuts.find((s)=>shortcut.key == s.key ) !== undefined){
      console.warn(`Shortcut key: ${shortcut.key} already exists`)
    }
    this.sohortcuts.push(shortcut)
    this.show()
  }

  static show(){
    Utils.getSafeHtmlElement("shortcuts").innerHTML = "<b>Shortcuts:</b> <br>" + this.sohortcuts.map(s=> `key: <b>${s.key}</b> - ${s.description}`).join("<br>")
  }
}
