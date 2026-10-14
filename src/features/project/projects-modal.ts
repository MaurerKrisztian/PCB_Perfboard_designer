import {Utils} from "../../utils/utils";
import {ProjectState} from "../../state/ProjectState";
import {ProjectFile} from "../../project-file/project-file";
import {readProjectFile} from "../../project-file/read-project-file";
import {listStoredProjects, readStoredProjectFile, StoredProject, unusedProjectName} from "./project-store";
import {
  DEFAULT_PROJECT_NAME, deleteProject, duplicateProject, importProjectFile, newProject, onProjectChange,
  openProject, renameProject, saveNow,
} from "./current-project";
import {downloadProjectFile} from "./save-project";
import {drawProjectThumbnail} from "./project-thumbnail";

// The File menu's project items, the open project's name in the header, and the Projects dialog:
// a card per project stored in this browser, with a thumbnail of its board. Naming, renaming and
// confirming a delete happen in the card itself rather than in browser prompts. Cards are built
// with DOM calls rather than an HTML string: project names are the user's own text and must never
// be parsed as markup.

const modal = Utils.getSafeHtmlElement('projectsModal');
const grid = Utils.getSafeHtmlElement<HTMLUListElement>('projectsList');
const countBadge = Utils.getSafeHtmlElement('projectsCount');
const searchInput = Utils.getSafeHtmlElement<HTMLInputElement>('projectsSearch');
const currentProjectBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('currentProjectBtn');
const fileInput = Utils.getSafeHtmlElement<HTMLInputElement>('loadProjectBtn');

// The search box appears once there are this many projects to look through.
const SEARCH_FROM = 7;

// What the dialog is in the middle of, beyond listing. One thing at a time; render() shows it.
type Mode =
  | {kind: "list"}
  | {kind: "new"}
  | {kind: "rename"; id: string}
  | {kind: "confirm-delete"; id: string};
let mode: Mode = {kind: "list"};

function showCurrentProject() {
  const name = ProjectState.current?.name;
  currentProjectBtn.textContent = name ?? "Not saved";
  currentProjectBtn.title = name
    ? "Saved in this browser as you edit. Click to see all projects."
    : "This board isn't being saved in this browser.";
}

onProjectChange(showCurrentProject);

function pickProjectFile() {
  fileInput.click();
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  // Cleared so picking the same file again still fires 'change'.
  fileInput.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importProjectFile(String(reader.result), file.name);
  reader.readAsText(file);
});

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function editedAgo(time: number): string {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `on ${new Date(time).toLocaleDateString()}`;
}

function readStoredFile(id: string): ProjectFile | undefined {
  try {
    return readProjectFile(JSON.parse(readStoredProjectFile(id) ?? "null")).project;
  } catch {
    return undefined;
  }
}

// "26×31 perfboard · 5 parts · 8 wires"
function describe(file: ProjectFile | undefined): string {
  if (!file) return "Can't be read by this version";
  const parts = file.placedIcs.length + file.placedStandardComponents.length + file.placedAdvancedComponents.length;
  return `${file.board.cols}×${file.board.rows} ${file.board.type} · ${plural(parts, "part")} · ${plural(file.wires.length, "wire")}`;
}

function setMode(next: Mode) {
  mode = next;
  render();
}

function openFromCard(project: StoredProject) {
  if (project.id === ProjectState.current?.id || openProject(project.id)) closeModal();
}

function downloadStored(project: StoredProject) {
  if (project.id === ProjectState.current?.id) saveNow();
  const json = readStoredProjectFile(project.id);
  if (json !== null) downloadProjectFile(json, project.name);
}

function closeCardMenus() {
  grid.querySelectorAll<HTMLElement>('.project-menu').forEach(menu => menu.hidden = true);
  grid.querySelectorAll('.project-menu-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

function cardMenu(project: StoredProject): HTMLElement[] {
  const button = el('button', 'project-menu-btn', '⋯');
  button.title = 'More actions';
  button.setAttribute('aria-label', `More actions for "${project.name}"`);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');

  const menu = el('div', 'project-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const item = (icon: string, label: string, action: () => void, className = "") => {
    const btn = el('button', className);
    btn.setAttribute('role', 'menuitem');
    btn.append(el('span', 'project-menu-icon', icon), label);
    btn.addEventListener('click', () => {
      closeCardMenus();
      action();
    });
    return btn;
  };
  menu.append(
    item('✎', 'Rename', () => setMode({kind: "rename", id: project.id})),
    item('⧉', 'Duplicate', () => {
      duplicateProject(project.id);
      render();
    }),
    item('⤓', 'Download file', () => downloadStored(project)),
    el('div', 'menu-divider'),
    item('🗑', 'Delete', () => setMode({kind: "confirm-delete", id: project.id}), 'is-danger'),
  );

  button.addEventListener('click', e => {
    // Kept from the document listener that closes menus on any outside click.
    e.stopPropagation();
    const wasOpen = !menu.hidden;
    closeCardMenus();
    menu.hidden = wasOpen;
    button.setAttribute('aria-expanded', String(!wasOpen));
  });
  return [button, menu];
}

function renameField(project: StoredProject): HTMLInputElement {
  const input = el('input', 'project-rename-input');
  input.type = 'text';
  input.value = project.name;
  input.setAttribute('aria-label', 'Project name');
  let done = false;
  const finish = (keep: boolean) => {
    // Re-rendering removes the field, which blurs it: finish only once.
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (keep && name && name !== project.name) renameProject(project.id, name);
    setMode({kind: "list"});
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') {
      // Leaves the dialog open: Escape only cancels the rename.
      e.stopPropagation();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  return input;
}

function deleteConfirmation(project: StoredProject): HTMLElement {
  const box = el('div', 'project-confirm');
  const cancel = el('button', 'btn', 'Cancel');
  cancel.addEventListener('click', () => setMode({kind: "list"}));
  const confirmDelete = el('button', 'btn-danger', 'Delete');
  confirmDelete.addEventListener('click', () => {
    deleteProject(project.id);
    setMode({kind: "list"});
  });
  const actions = el('div', 'project-confirm-actions');
  actions.append(cancel, confirmDelete);
  box.append(
    el('strong', '', `Delete "${project.name}"?`),
    el('span', 'project-confirm-note', "It will be removed from this browser for good."),
    actions,
  );
  return box;
}

function projectCard(project: StoredProject): HTMLLIElement {
  const isOpen = project.id === ProjectState.current?.id;
  const renaming = mode.kind === "rename" && mode.id === project.id;
  const file = readStoredFile(project.id);
  const card = el('li', isOpen ? 'project-card is-open' : 'project-card');

  const thumb = el('div', 'project-thumb');
  if (file) {
    const canvas = el('canvas');
    drawProjectThumbnail(canvas, file);
    thumb.append(canvas);
  } else {
    thumb.append(el('span', 'project-thumb-missing', '?'));
  }
  if (isOpen) thumb.append(el('span', 'project-badge', 'Open'));

  const body = el('div', 'project-card-body');
  if (renaming) {
    body.append(renameField(project));
  } else {
    const name = el('span', 'project-name', project.name);
    name.title = project.name;
    body.append(name);
  }
  body.append(el('span', 'project-meta', describe(file)), el('span', 'project-edited', `Edited ${editedAgo(project.updatedAt)}`));

  // The whole card opens the project, except while its name is being edited (an input can't sit
  // inside a button).
  if (renaming) {
    card.append(thumb, body);
  } else {
    const open = el('button', 'project-open');
    open.setAttribute('aria-label', isOpen ? `"${project.name}" is open` : `Open "${project.name}"`);
    open.append(thumb, body);
    open.addEventListener('click', () => openFromCard(project));
    card.append(open);
  }
  card.append(...cardMenu(project));
  if (mode.kind === "confirm-delete" && mode.id === project.id) card.append(deleteConfirmation(project));
  return card;
}

function newProjectCard(): HTMLLIElement {
  const card = el('li', 'project-card project-new');
  if (mode.kind !== "new") {
    const start = el('button', 'project-new-btn');
    start.append(el('span', 'project-new-icon', '＋'), el('span', '', 'New project'));
    start.addEventListener('click', () => setMode({kind: "new"}));
    card.append(start);
    return card;
  }

  const form = el('form', 'project-new-form');
  const input = el('input', 'project-new-input');
  input.type = 'text';
  input.value = unusedProjectName(DEFAULT_PROJECT_NAME);
  input.setAttribute('aria-label', 'New project name');
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setMode({kind: "list"});
    }
  });
  const cancel = el('button', 'btn', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', () => setMode({kind: "list"}));
  const create = el('button', 'btn-primary', 'Create');
  create.type = 'submit';
  const actions = el('div', 'project-new-actions');
  actions.append(cancel, create);
  form.append(el('label', 'project-new-label', 'Name your new project'), input, actions);
  form.addEventListener('submit', e => {
    e.preventDefault();
    mode = {kind: "list"};
    newProject(input.value.trim() || unusedProjectName(DEFAULT_PROJECT_NAME));
    closeModal();
  });
  card.append(form);
  return card;
}

function render() {
  const projects = listStoredProjects();
  countBadge.textContent = projects.length ? String(projects.length) : "";
  searchInput.hidden = projects.length < SEARCH_FROM;
  const query = searchInput.hidden ? "" : searchInput.value.trim().toLowerCase();
  const shown = query ? projects.filter(p => p.name.toLowerCase().includes(query)) : projects;

  grid.replaceChildren(newProjectCard(), ...shown.map(projectCard));
  if (query && shown.length === 0) grid.append(el('li', 'projects-empty', `No projects match "${searchInput.value.trim()}".`));

  const field = grid.querySelector<HTMLInputElement>('.project-rename-input, .project-new-input');
  if (field) {
    field.focus();
    field.select();
  }
  grid.querySelector<HTMLButtonElement>('.project-confirm .btn')?.focus();
}

function openModal(startNew = false) {
  // So the open project's card shows what's on the board right now.
  saveNow();
  mode = startNew ? {kind: "new"} : {kind: "list"};
  searchInput.value = '';
  modal.style.display = 'flex';
  render();
}

function closeModal() {
  modal.style.display = 'none';
  mode = {kind: "list"};
}

const isModalOpen = () => modal.style.display !== 'none';

Utils.getSafeHtmlElement('newProjectBtn').addEventListener('click', () => openModal(true));
Utils.getSafeHtmlElement('openProjectBtn').addEventListener('click', () => openModal());
Utils.getSafeHtmlElement('loadProjectTrigger').addEventListener('click', pickProjectFile);
currentProjectBtn.addEventListener('click', () => openModal());

Utils.getSafeHtmlElement('closeProjectsModalBtn').addEventListener('click', closeModal);
Utils.getSafeHtmlElement('modalImportProjectBtn').addEventListener('click', () => {
  closeModal();
  pickProjectFile();
});
searchInput.addEventListener('input', render);
// A click on the dimmed backdrop, outside the dialog itself.
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});
document.addEventListener('click', e => {
  if (isModalOpen() && !(e.target as Element).closest('.project-menu')) closeCardMenus();
});
// Escape backs out one step: an open card menu, then a pending delete, then the dialog.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !isModalOpen()) return;
  if (grid.querySelector('.project-menu:not([hidden])')) closeCardMenus();
  else if (mode.kind !== "list") setMode({kind: "list"});
  else closeModal();
});
