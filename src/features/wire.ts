import {ToolState} from "../state/ToolState";
import {Utils} from "../utils/utils";
import {ShortcutRegistry} from "./shortcut-keys";
import {arm} from "./armed-tool";

export function armWire() {
  ToolState.activeToolMode = 'select';
  arm({kind: "wire"});
}

function toggleWire() {
  if (ToolState.armed?.kind === "wire") {
    arm();
  } else {
    armWire();
  }
}

Utils.getSafeHtmlElement<HTMLButtonElement>('wireArmBtn').addEventListener('click', toggleWire);

ShortcutRegistry.add({
  key: "w",
  description: "Toggle wire tool.",
  event: toggleWire
});
