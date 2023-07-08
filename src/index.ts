import "./style.css";
import "./features/save-image"
import "./features/save-progress"
import "./features/save-project"
import "./features/select"
import "./features/load-project"
import "./features/hover"
import "./features/description"
import "./features/line"
import "./features/undo-redo"
import "./features/load-from-local-storage"
import {resetCanvas} from "./features/reset-canvas";
import {createDotGrid, heightInput, widthInput} from "./features/resize-grid";
import {redrawCanvas} from "./features/draw-canvas";


createDotGrid(parseInt(widthInput.value || "10"), parseInt(heightInput.value || "10"));
resetCanvas()
redrawCanvas()

