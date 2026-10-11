import {Group, Material, Mesh} from "three";
import {BoardFrame, SceneKit} from "./scene-kit";
import {ViewerProject} from "./project-data";
import {buildBoard, buildSolderJoints, buildWires} from "./build-board";
import {buildStandardPart} from "./build-standard-parts";
import {buildAdvancedPart} from "./build-advanced-parts";
import {buildIc} from "./build-ics";

export interface BuiltBoard {
  root: Group;
  frame: BoardFrame;
  partCount: number;
  wireCount: number;
}

/** Builds the whole board - perfboard, wires, every placed part and the solder joints under
 *  it - from a parsed project file. */
export function buildBoardScene(project: ViewerProject): BuiltBoard {
  const frame = new BoardFrame(project.canvasWidth, project.canvasHeight);
  const kit = new SceneKit(frame);
  const root = new Group();

  root.add(buildBoard(kit, project.dots));
  root.add(buildWires(kit, project.wires));

  let partCount = 0;
  const parts = [
    ...project.ics.map(ic => buildIc(kit, ic)),
    ...project.standardParts.map(part => buildStandardPart(kit, part)),
    ...project.advancedParts.map(part => buildAdvancedPart(kit, part)),
  ];
  for (const part of parts) {
    if (!part) continue;
    part.traverse(child => {
      // Transparent label planes would otherwise cast solid rectangular shadows.
      const material = (child as Mesh).material as Material | Material[] | undefined;
      child.castShadow = !(material && !Array.isArray(material) && material.transparent);
    });
    root.add(part);
    partCount++;
  }

  // Last, so it sees every hole the wires and parts above registered.
  const joints = buildSolderJoints(kit);
  if (joints) root.add(joints);

  return {root, frame, partCount, wireCount: project.wires.length};
}
