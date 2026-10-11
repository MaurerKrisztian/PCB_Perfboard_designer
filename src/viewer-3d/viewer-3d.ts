import "./viewer-3d.css";
import {
  ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, Material, Mesh, Object3D,
  PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Scene, Texture, Vector3, WebGLRenderer,
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {readProject} from "./project-data";
import {buildBoardScene, BuiltBoard} from "./build-scene";

// Read-only 3D view of a perfboard project. It only ever receives project-file data (the
// same JSON "Save Project" writes) - never the editor's live state - and is loaded on demand,
// so three.js stays out of the editor's main bundle.

type ViewName = "angled" | "top" | "bottom";

const VIEW_DIRECTIONS: Record<ViewName, Vector3> = {
  angled: new Vector3(0.35, 0.82, 0.75).normalize(),
  // A hair off the pole so OrbitControls keeps a stable "up" when looking straight down/up.
  top: new Vector3(0, 1, 0.02).normalize(),
  bottom: new Vector3(0, -1, 0.02).normalize(),
};

const TWEEN_MS = 450;

function disposeTree(root: Object3D) {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) {
    const slots = material as unknown as Record<string, unknown>;
    for (const key of Object.keys(slots)) {
      const value = slots[key];
      if (value instanceof Texture) textures.add(value);
    }
    material.dispose();
  }
  textures.forEach(texture => texture.dispose());
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

class Viewer3d {
  private readonly overlay = element("div", "viewer3d-overlay");
  private readonly host = element("div", "viewer3d-canvas-host");
  private readonly status = element("span", "viewer3d-status");
  private readonly renderer = new WebGLRenderer({antialias: true});
  private readonly scene = new Scene();
  // A tight near/far range keeps depth precision high enough for the thin printed-on layers
  // (bands, stripes, pads) not to flicker against what they sit on; far is refit per board.
  private readonly camera = new PerspectiveCamera(38, 1, 2, 2000);
  private readonly controls: OrbitControls;
  private readonly sun = new DirectionalLight("#ffffff", 2.4);
  private readonly resizeObserver: ResizeObserver;
  private board?: BuiltBoard;
  private frameId = 0;
  private needsRender = true;
  private readonly previousBodyOverflow = document.body.style.overflow;
  private tween?: {fromPos: Vector3; toPos: Vector3; fromTarget: Vector3; toTarget: Vector3; start: number};

  constructor(private readonly onClosed: () => void) {
    this.buildDom();

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new Color("#0b1220");
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new HemisphereLight("#dfe9ff", "#1a2230", 0.7));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // Soft light from underneath so the solder side isn't pitch black in the bottom view.
    const under = new DirectionalLight("#cfd8e6", 0.8);
    under.position.set(-0.4, -1, -0.3);
    this.scene.add(under);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener("start", () => { this.tween = undefined; });
    this.controls.addEventListener("change", () => { this.needsRender = true; });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("keyup", this.swallowKey, true);

    this.loop();
  }

  private buildDom() {
    const toolbar = element("div", "viewer3d-toolbar");
    const title = element("div", "viewer3d-title", "3D View");
    title.appendChild(this.status);
    toolbar.appendChild(title);

    const actions = element("div", "viewer3d-actions");
    const button = (label: string, onClick: () => void, extraClass = "") => {
      const btn = element("button", `viewer3d-btn ${extraClass}`.trim(), label);
      btn.type = "button";
      btn.addEventListener("click", onClick);
      actions.appendChild(btn);
      return btn;
    };
    button("Angled", () => this.setView("angled"));
    button("Top", () => this.setView("top"));
    button("Bottom", () => this.setView("bottom"));
    button("Screenshot", () => this.screenshot());

    const fileInput = element("input", "viewer3d-file");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      file.text().then(text => this.load(JSON.parse(text))).catch(() => this.showError("Couldn't read that file as a project."));
    });
    actions.appendChild(fileInput);
    button("Open file…", () => fileInput.click());
    button("✕ Close", () => this.close(), "viewer3d-btn-close");
    toolbar.appendChild(actions);

    const hint = element("div", "viewer3d-hint", "Drag to orbit · Right-drag to pan · Scroll to zoom · Esc to close");
    this.overlay.append(toolbar, this.host, hint);
    document.body.appendChild(this.overlay);
    document.body.style.overflow = "hidden";
  }

  load(raw: unknown) {
    let built: BuiltBoard;
    try {
      built = buildBoardScene(readProject(raw));
    } catch (e) {
      this.showError(e instanceof Error ? e.message : "Couldn't open that project.");
      return;
    }
    if (this.board) {
      this.scene.remove(this.board.root);
      disposeTree(this.board.root);
    }
    this.board = built;
    this.scene.add(built.root);
    this.status.classList.remove("viewer3d-status-error");
    this.status.textContent = `${built.partCount} part${built.partCount === 1 ? "" : "s"} · ${built.wireCount} wire${built.wireCount === 1 ? "" : "s"}`;

    const radius = this.boardRadius();
    const shadow = this.sun.shadow.camera;
    shadow.left = shadow.bottom = -radius * 1.15;
    shadow.right = shadow.top = radius * 1.15;
    shadow.near = 1;
    shadow.far = radius * 6;
    shadow.updateProjectionMatrix();
    this.sun.position.set(radius * 0.6, radius * 2.2, radius * 1.1);
    this.controls.maxDistance = radius * 8;
    this.camera.far = radius * 12;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = 8;
    this.setView("angled", false);
  }

  private boardRadius(): number {
    if (!this.board) return 50;
    // Parts stand up to ~20mm proud of the board, so leave room above it too.
    return Math.hypot(this.board.frame.width, this.board.frame.depth) / 2 + 12;
  }

  private viewPosition(view: ViewName): Vector3 {
    const fov = this.camera.fov * Math.PI / 180;
    const fitHeight = this.boardRadius() / Math.sin(fov / 2);
    const fitWidth = fitHeight / Math.max(0.6, Math.min(1, this.camera.aspect));
    return VIEW_DIRECTIONS[view].clone().multiplyScalar(Math.max(fitHeight, fitWidth) * 0.62);
  }

  setView(view: ViewName, animate = true) {
    const target = new Vector3(0, 0, 0);
    const position = this.viewPosition(view);
    if (!animate) {
      this.tween = undefined;
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      this.needsRender = true;
      return;
    }
    this.tween = {fromPos: this.camera.position.clone(), toPos: position, fromTarget: this.controls.target.clone(), toTarget: target, start: performance.now()};
  }

  private screenshot() {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement("a");
    link.download = "perfboard-3d.png";
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }

  private showError(message: string) {
    this.status.classList.add("viewer3d-status-error");
    this.status.textContent = message;
  }

  private resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  private loop = () => {
    this.frameId = requestAnimationFrame(this.loop);
    if (this.tween) {
      const t = Math.min(1, (performance.now() - this.tween.start) / TWEEN_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, eased);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, eased);
      if (t >= 1) this.tween = undefined;
      this.needsRender = true;
    }
    // update() applies damping and reports whether the camera actually moved.
    if (this.controls.update()) this.needsRender = true;
    if (!this.needsRender) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.camera);
  };

  // While the viewer is open, keys must not reach the editor's shortcuts underneath it.
  private onKey = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    if (e.key === "Escape") this.close();
  };

  private swallowKey = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
  };

  close() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("keyup", this.swallowKey, true);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.board) disposeTree(this.board.root);
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.overlay.remove();
    document.body.style.overflow = this.previousBodyOverflow;
    this.onClosed();
  }
}

let active: Viewer3d | undefined;

/** Opens the viewer on a project (the parsed JSON of a project file), or shows that project
 *  in the viewer if it's already open. */
export function openViewer3d(project: unknown) {
  if (!active) active = new Viewer3d(() => { active = undefined; });
  active.load(project);
}
