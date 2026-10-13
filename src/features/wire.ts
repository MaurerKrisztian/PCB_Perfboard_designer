import {ToolState} from "../state/ToolState";
import {Utils} from "../utils/utils";
import {ShortcutRegistry} from "./shortcut-keys";
import {setActiveTool} from "./active-tool";

function toggleWire() {
  setActiveTool(ToolState.active.kind === "wire" ? {kind: "select"} : {kind: "wire"});
}

Utils.getSafeHtmlElement<HTMLButtonElement>('wireArmBtn').addEventListener('click', toggleWire);

ShortcutRegistry.add({
  key: "w",
  description: "Toggle wire tool.",
  event: toggleWire
});
