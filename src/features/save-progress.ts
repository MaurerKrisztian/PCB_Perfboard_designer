import {State} from "../state/State";
import {Utils} from "../utils/utils";

const saveProgressBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('saveProgressBtn');
saveProgressBtn.addEventListener('click', function() {
  localStorage.setItem('canvasDots', JSON.stringify(State.dots));
  localStorage.setItem('canvasLines', JSON.stringify(State.lines));
  alert('Project saved to local storage.');
});
