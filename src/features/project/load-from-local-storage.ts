import {redrawCanvas} from "../draw-canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
import {loadProject} from "./load-project";

window.addEventListener('DOMContentLoaded', () => {
  if(localStorage.getItem('canvasDots') !== null && localStorage.getItem('canvasLines') !== null) {
    try {
      const save: IProjectSave = JSON.parse(localStorage.getItem('save') as any) as IProjectSave
      loadProject(save);
      redrawCanvas();
    }catch (e){
      console.error(e)
      console.log("Cant load save from local storage.")
    }

  }
});
