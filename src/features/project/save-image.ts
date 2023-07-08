import {Canvas} from "../../state/Canvas";
import {Utils} from "../../utils/utils";

Utils.getSafeHtmlElement<HTMLButtonElement>('downloadBtn').addEventListener('click', function() {
  const link = document.createElement('a');
  link.download = 'canvas.png';
  link.href = Canvas.c.toDataURL()
  link.click();
});
