import {Utils} from "../../utils/utils";
import {getSaveJson} from "./save-project";

const saveProgressBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('saveProgressBtn');
saveProgressBtn.addEventListener('click', function() {
  localStorage.setItem('save', JSON.stringify(getSaveJson()));
  alert('Project saved to local storage.');
});
