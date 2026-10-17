import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";
import {buildCatalog, CatalogItem} from "./catalog";
import {CatalogCategory, getCategoryPath, getChildCategories} from "../../parts/catalog-categories";
import {CatalogSearchResult, searchCatalog} from "./catalog-search";
import {onArmedPartChanged, onCatalogChanged, onRecentChanged} from "./catalog-events";
import {getRecentKeys} from "./recent-components";

// The sidebar's Components section: a search box over a category tree. While the box has a
// query, the tree is swapped for a flat list of ranked results.
//
// Only index.ts may import this module - everything else reaches it through catalog-events.ts
// (see there for why).

const SECTION_BODY_ID = "componentsSection";
const COLLAPSED_STORAGE_KEY = "catalog_collapsed";
// Shares the collapsed-categories store; not a real category, so it can't clash with one.
const RECENT_NODE_ID = "recent";

const searchInput = Utils.getSafeHtmlElement<HTMLInputElement>("catalogSearch");
const treeEl = Utils.getSafeHtmlElement("catalog-tree");
const resultsEl = Utils.getSafeHtmlElement("catalog-results");

// Categories start expanded, so only the ones the user folded away are remembered.
const collapsedCategories = loadCollapsedCategories();

let itemsByKey = new Map<string, CatalogItem>();
let items: CatalogItem[] = [];
let results: CatalogSearchResult[] = [];
let activeResultIndex = 0;

function loadCollapsedCategories(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    return new Set(stored ? JSON.parse(stored) as string[] : []);
  } catch (e) {
    console.error("Failed to load collapsed catalog categories from localStorage", e);
    return new Set();
  }
}

function saveCollapsedCategories() {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(collapsedCategories)));
  } catch (e) {
    console.error("Failed to save collapsed catalog categories to localStorage", e);
  }
}

function createItemIcon(item: CatalogItem): HTMLElement {
  const emoji = document.createElement("span");
  emoji.className = "catalog-icon";
  emoji.textContent = item.emoji;
  if (!item.iconPath) return emoji;

  const img = document.createElement("img");
  img.className = "catalog-icon";
  img.src = item.iconPath;
  img.alt = "";
  img.onerror = () => img.replaceWith(emoji);
  return img;
}

function createTextSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function setDepth(el: HTMLElement, depth: number) {
  el.style.setProperty("--depth", String(depth));
}

function createItemRow(item: CatalogItem, depth: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "catalog-item";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = item.isAction ? "catalog-row catalog-item-btn catalog-action" : "catalog-row catalog-item-btn";
  btn.dataset.itemKey = item.key;
  setDepth(btn, depth);
  btn.append(createItemIcon(item), createTextSpan("catalog-name", item.name));
  btn.addEventListener("click", () => item.activate());
  row.appendChild(btn);

  if (item.edit) {
    const edit = item.edit;
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "catalog-edit-btn";
    editBtn.title = "Edit custom part";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => edit());
    row.appendChild(editBtn);
  }

  if (item.remove) {
    const remove = item.remove;
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "catalog-delete-btn";
    deleteBtn.title = "Delete custom part";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Delete custom part "${item.name}"?`)) remove();
    });
    row.appendChild(deleteBtn);
  }
  return row;
}

// Renders a category and everything under it: subcategories first, then its own items.
// Returns null for categories with nothing in them, which are left out of the tree.
function renderCategoryNode(category: CatalogCategory, depth: number): {el: HTMLElement; count: number} | null {
  const childNodes = getChildCategories(category.id)
    .map(child => renderCategoryNode(child, depth + 1))
    .filter((node): node is {el: HTMLElement; count: number} => node !== null);
  const ownItems = items.filter(item => item.categoryId === category.id);
  if (!childNodes.length && !ownItems.length) return null;

  const count = childNodes.reduce((sum, node) => sum + node.count, 0)
    + ownItems.filter(item => !item.isAction).length;

  const node = document.createElement("div");
  node.className = "catalog-category";
  node.dataset.categoryId = category.id;
  node.classList.toggle("collapsed", collapsedCategories.has(category.id));

  const header = document.createElement("button");
  header.type = "button";
  header.className = "catalog-row catalog-category-row";
  setDepth(header, depth);
  header.appendChild(createTextSpan("catalog-chevron", "▾"));
  if (category.icon) header.appendChild(createTextSpan("catalog-icon", category.icon));
  header.appendChild(createTextSpan("catalog-name", category.name));
  if (count > 0) header.appendChild(createTextSpan("catalog-count", String(count)));
  header.addEventListener("click", () => toggleCategory(category.id));

  const children = document.createElement("div");
  children.className = "catalog-children";
  childNodes.forEach(child => children.appendChild(child.el));
  ownItems.forEach(item => children.appendChild(createItemRow(item, depth + 1)));

  node.append(header, children);
  return {el: node, count};
}

// A submenu under the top-level Custom… entry, listing the components most recently placed on the
// board. Entries whose part no longer exists (a deleted custom part) are left out.
function renderRecentNode(): HTMLElement | null {
  const recent = getRecentKeys()
    .map(key => itemsByKey.get(key))
    .filter((item): item is CatalogItem => item !== undefined);
  if (!recent.length) return null;

  const node = document.createElement("div");
  node.className = "catalog-category";
  node.dataset.categoryId = RECENT_NODE_ID;
  node.classList.toggle("collapsed", collapsedCategories.has(RECENT_NODE_ID));

  const header = document.createElement("button");
  header.type = "button";
  header.className = "catalog-row catalog-category-row";
  setDepth(header, 0);
  header.append(
    createTextSpan("catalog-chevron", "▾"),
    createTextSpan("catalog-icon", "🕘"),
    createTextSpan("catalog-name", "Recently used…"),
    createTextSpan("catalog-count", String(recent.length))
  );
  header.addEventListener("click", () => toggleCategory(RECENT_NODE_ID));

  const children = document.createElement("div");
  children.className = "catalog-children";
  recent.forEach(item => children.appendChild(createItemRow(item, 1)));

  node.append(header, children);
  return node;
}

function renderTree() {
  treeEl.innerHTML = "";
  // Top-level entries (the Custom… action) sit above every category
  items.filter(item => !item.categoryId).forEach(item => treeEl.appendChild(createItemRow(item, 0)));
  const recentNode = renderRecentNode();
  if (recentNode) treeEl.appendChild(recentNode);
  for (const category of getChildCategories()) {
    const node = renderCategoryNode(category, 0);
    if (node) treeEl.appendChild(node.el);
  }
}

function findCategoryNode(categoryId: string): HTMLElement | null {
  return treeEl.querySelector<HTMLElement>(`.catalog-category[data-category-id="${categoryId}"]`);
}

function toggleCategory(categoryId: string) {
  if (collapsedCategories.has(categoryId)) {
    collapsedCategories.delete(categoryId);
  } else {
    collapsedCategories.add(categoryId);
  }
  saveCollapsedCategories();
  findCategoryNode(categoryId)?.classList.toggle("collapsed", collapsedCategories.has(categoryId));
}

function expandComponentsSection() {
  Utils.getSafeHtmlElement(SECTION_BODY_ID).classList.remove("collapsed");
  document.querySelector(`.section-title[data-collapse="${SECTION_BODY_ID}"]`)?.classList.remove("section-collapsed");
}

// Clears the search and scrolls the tree to a category, unfolding it and its ancestors.
function revealCategory(categoryId: CatalogCategory["id"]) {
  clearSearch();
  expandComponentsSection();
  for (const category of getCategoryPath(categoryId)) {
    collapsedCategories.delete(category.id);
    findCategoryNode(category.id)?.classList.remove("collapsed");
  }
  saveCollapsedCategories();

  const header = findCategoryNode(categoryId)?.querySelector<HTMLElement>(".catalog-category-row");
  if (!header) return;
  header.scrollIntoView({block: "nearest", behavior: "smooth"});
  // Restart the flash animation even if it's still running from a previous reveal
  header.classList.remove("catalog-flash");
  void header.offsetWidth;
  header.classList.add("catalog-flash");
}

function createResultRow(result: CatalogSearchResult, index: number): HTMLElement {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "catalog-row catalog-result-row";
  row.dataset.resultIndex = String(index);

  const text = document.createElement("span");
  text.className = "catalog-result-text";
  if (result.type === "item") {
    row.dataset.itemKey = result.item.key;
    row.appendChild(createItemIcon(result.item));
    text.append(
      createTextSpan("catalog-name", result.item.name),
      createTextSpan("catalog-breadcrumb", result.item.categoryId
        ? getCategoryPath(result.item.categoryId).map(c => c.name).join(" › ")
        : "Create your own part")
    );
  } else {
    const parentPath = getCategoryPath(result.category.id).slice(0, -1).map(c => c.name).join(" › ");
    row.appendChild(createTextSpan("catalog-icon", result.category.icon ?? "📁"));
    text.append(
      createTextSpan("catalog-name", result.category.name),
      createTextSpan("catalog-breadcrumb", parentPath ? `Category in ${parentPath}` : "Category")
    );
  }
  row.appendChild(text);

  row.addEventListener("click", () => activateResult(result));
  row.addEventListener("mouseenter", () => {
    activeResultIndex = index;
    updateActiveResult();
  });
  return row;
}

function renderResults() {
  resultsEl.innerHTML = "";
  if (!results.length) {
    resultsEl.appendChild(createTextSpan("catalog-empty", `No components match "${searchInput.value.trim()}"`));
    return;
  }
  results.forEach((result, index) => resultsEl.appendChild(createResultRow(result, index)));
  updateActiveResult();
}

function updateActiveResult() {
  resultsEl.querySelectorAll<HTMLElement>("[data-result-index]").forEach(row => {
    const isActive = Number(row.dataset.resultIndex) === activeResultIndex;
    row.classList.toggle("catalog-result-active", isActive);
    if (isActive) row.scrollIntoView({block: "nearest"});
  });
}

function activateResult(result: CatalogSearchResult) {
  if (result.type === "category") {
    revealCategory(result.category.id);
    return;
  }
  // Hand the keyboard back to the canvas shortcuts (R to rotate, Esc to cancel...), which
  // ignore key presses while the search box has focus.
  searchInput.blur();
  result.item.activate();
}

function updateSearch() {
  const searching = searchInput.value.trim() !== "";
  results = searching ? searchCatalog(searchInput.value, items) : [];
  activeResultIndex = 0;
  treeEl.hidden = searching;
  resultsEl.hidden = !searching;
  if (searching) {
    renderResults();
    updateCatalogHighlight();
  }
}

function clearSearch() {
  searchInput.value = "";
  updateSearch();
}

// Marks whichever part is armed for placement, in both the tree and the results list.
function updateCatalogHighlight() {
  document.querySelectorAll<HTMLElement>(`#${SECTION_BODY_ID} [data-item-key]`).forEach(el => {
    const item = itemsByKey.get(el.dataset.itemKey ?? "");
    el.classList.toggle("active-mode", !!item && item.isArmed());
  });
}

function renderComponentsPanel() {
  items = buildCatalog();
  itemsByKey = new Map(items.map(item => [item.key, item]));
  renderTree();
  updateSearch();
  updateCatalogHighlight();
}

searchInput.addEventListener("input", updateSearch);

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!results.length) return;
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    activeResultIndex = (activeResultIndex + step + results.length) % results.length;
    updateActiveResult();
  } else if (e.key === "Enter") {
    const result = results[activeResultIndex];
    if (!result) return;
    e.preventDefault();
    activateResult(result);
  } else if (e.key === "Escape") {
    // Keep Escape local to the search box rather than also cancelling canvas state
    e.stopPropagation();
    if (searchInput.value) {
      clearSearch();
    } else {
      searchInput.blur();
    }
  }
});

ShortcutRegistry.add({
  key: "/",
  description: "Search components.",
  event: (e) => {
    // Otherwise the "/" lands in the search box once it has focus
    e.preventDefault();
    expandComponentsSection();
    searchInput.focus();
    searchInput.select();
  }
});

onCatalogChanged(renderComponentsPanel);
onArmedPartChanged(updateCatalogHighlight);
onRecentChanged(() => {
  renderTree();
  updateCatalogHighlight();
});
renderComponentsPanel();
