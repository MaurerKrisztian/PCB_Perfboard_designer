import "./style.css";
import "./features/project/save-image"
import "./features/project/save-progress"
import "./features/project/save-project"
import "./features/select"
import "./features/project/load-project"
import "./features/hover"
import "./features/description"
import "./features/line"
import "./features/project/undo-redo"
import "./features/project/load-from-local-storage"
import "./features/shortcut-keys"
import "./features/dot"
import "./features/project/reset-project"
import {resetCanvas} from "./features/reset-canvas";
import {createDotGrid, heightInput, widthInput} from "./features/project/resize-grid";
import {redrawCanvas} from "./features/draw-canvas";


createDotGrid(parseInt(widthInput.value || "10"), parseInt(heightInput.value || "10"));
resetCanvas()
redrawCanvas()

