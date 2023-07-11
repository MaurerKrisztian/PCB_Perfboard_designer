import {Canvas} from "../../state/Canvas";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";

Utils.getSafeHtmlElement<HTMLButtonElement>('downloadBtn').addEventListener('click', function() {
 downloadAsImage()
});

export function downloadAsImage(){
  const link = document.createElement('a');
  link.download = 'canvas.png';
  link.href = Canvas.c.toDataURL()
  link.click();
}

ShortcutRegistry.add({key: "p", description: "download as image", event: downloadAsImage})
