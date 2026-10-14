import {ExtrudeGeometry, Group, Mesh, Path, Shape, Vector3} from "three";
import {PITCH, SceneKit, textPlane} from "../scene-kit";
import {addLeads} from "./part-geometry";

export function buildTo220(kit: SceneKit, value?: string): Group {
  const group = new Group();
  const width = 10, plasticHeight = 9.2, thickness = 4.5, bottom = 3.5;
  const cx = PITCH;
  const plasticTop = bottom + plasticHeight;
  const tabThickness = 1.3, tabWidth = width - 0.2;
  const back = -thickness / 2;
  const plasticBack = back + tabThickness / 2;
  group.add(kit.box(
    width, plasticHeight, thickness / 2 - plasticBack,
    kit.standard("to220-body", {color: "#26292d", roughness: 0.5}),
    new Vector3(cx, bottom + plasticHeight / 2, (plasticBack + thickness / 2) / 2),
  ));

  const tabBottom = bottom + 0.8, tabHeight = plasticTop + 6.5 - tabBottom;
  const tab = new Shape();
  tab.moveTo(-tabWidth / 2, 0);
  tab.lineTo(tabWidth / 2, 0);
  tab.lineTo(tabWidth / 2, tabHeight - 0.8);
  tab.lineTo(tabWidth / 2 - 0.8, tabHeight);
  tab.lineTo(-tabWidth / 2 + 0.8, tabHeight);
  tab.lineTo(-tabWidth / 2, tabHeight - 0.8);
  tab.lineTo(-tabWidth / 2, 0);
  const hole = new Path();
  hole.absarc(0, tabHeight - 3.2, 1.8, 0, Math.PI * 2, true);
  tab.holes.push(hole);
  const tabMesh = new Mesh(
    new ExtrudeGeometry(tab, {depth: tabThickness, bevelEnabled: false, curveSegments: 24}),
    kit.standard("to220-tab", {color: "#b9c2cc", metalness: 1, roughness: 0.28}),
  );
  tabMesh.position.set(cx, tabBottom, back);
  tabMesh.castShadow = true;
  group.add(tabMesh);

  const leads = new Group();
  addLeads(leads, kit, [{dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 2, dy: 0}], bottom + 0.3, 0.8, 0.5);
  group.add(leads);
  if (value) {
    const label = textPlane(value, width * 0.8, 1.6, "#c7ced6");
    label.position.set(cx, bottom + plasticHeight * 0.55, thickness / 2 + 0.01);
    group.add(label);
  }
  return group;
}
