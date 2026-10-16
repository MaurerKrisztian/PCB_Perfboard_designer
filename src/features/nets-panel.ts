import {Utils} from "../utils/utils";
import {onRedraw, redrawCanvas} from "./draw-canvas";
import {getSaveJson} from "./project/save-project";
import {onProjectChange} from "./project/current-project";
import {comparePins, computeNets, isPowerNet, Net, NetPin, pinId} from "../project-file/nets";
import {GridPos} from "../project-file/grid";
import {ProjectFile, SavedWire} from "../project-file/project-file";
import {NetHighlightState} from "../state/NetHighlightState";
import {ProjectState} from "../state/ProjectState";

// The right sidebar's Nets section: which pins the board connects, kept up to date as it changes.
// Worked out from the project file, the same snapshot autosave writes, by nets.ts, so it matches
// what any program reading that file works out. Clicking a net, an unconnected pin or wires
// connecting no pins lights it up on the board (NetHighlightState) until it's clicked again; the
// light follows the net as it's edited.

const netsEl = Utils.getSafeHtmlElement("nets");
const countEl = Utils.getSafeHtmlElement("netsCount");

// Every change ends in a redraw, but so does hovering: refresh shortly after the first redraw of a
// stream, and only re-render when the board changed.
const REFRESH_DELAY_MS = 100;
let pendingRefresh: number | undefined;
let lastJson: string | undefined;
// Which folds are open, kept across re-renders, which rebuild the list.
const foldOpen = {unconnected: false, stray: false};

let project: ProjectFile | undefined;
let nets: Net[] = [];
let highlighted: Net | undefined;

const pinKey = (pin: NetPin) => `${pin.ref}.${pin.pin}`;
const hole = ([c, r]: GridPos) => `${c},${r}`;
const wireKey = (wire: SavedWire) => `${hole(wire.from)}-${hole(wire.to)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setHighlight(net: Net | undefined) {
  highlighted = net;
  const wires = project?.wires ?? [];
  NetHighlightState.current = net && {pins: net.pins.map(pinKey), holes: net.holes, wires: net.wires.map(i => wires[i])};
}

function toggleHighlight(net: Net) {
  setHighlight(net === highlighted ? undefined : net);
  render();
  redrawCanvas();
}

// After a change, the highlighted net is the one now holding most of its pins (none if they're
// all gone), or for wires that connected no pins, most of its wires.
function followHighlight() {
  const previous = NetHighlightState.current;
  const pins = new Set(previous?.pins ?? []);
  const wires = new Set(previous?.wires.map(wireKey) ?? []);
  const projectWires = project?.wires ?? [];
  const sharedWith = pins.size
    ? (net: Net) => net.pins.filter(pin => pins.has(pinKey(pin))).length
    : (net: Net) => net.wires.filter(i => wires.has(wireKey(projectWires[i]))).length;
  let best: Net | undefined;
  let bestShared = 0;
  for (const net of nets) {
    const shared = sharedWith(net);
    if (shared > bestShared) [best, bestShared] = [net, shared];
  }
  setHighlight(best);
}

// Makes a net's row or chip pick the net with a click, or Enter/Space when focused.
function makePickable(element: HTMLElement, net: Net) {
  element.tabIndex = 0;
  element.setAttribute("role", "button");
  element.setAttribute("aria-pressed", String(net === highlighted));
  element.classList.toggle("selected", net === highlighted);
  element.addEventListener("click", () => toggleHighlight(net));
  element.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggleHighlight(net);
  });
}

// "D1.K" or "U1.8", with a chip's pin name ("VCC") shown beside it.
function pinChip(pin: NetPin): HTMLElement {
  const chip = el("span", "net-pin", pinId(pin));
  chip.title = `${pin.ref} pin ${pin.pin}${pin.label ? ` (${pin.label})` : ""}`;
  if (pin.label && pin.kind !== "standard-component") chip.append(el("span", "net-pin-label", pin.label));
  return chip;
}

// Wires connecting no pins, by where the first one runs ("4,2–7,2"), with how many more are
// joined to it.
function wireChip(net: Net): HTMLElement {
  const {from, to} = (project?.wires ?? [])[net.wires[0]];
  const chip = el("span", "net-pin", `${hole(from)}–${hole(to)}`);
  const more = net.wires.length - 1;
  chip.title = `A wire from column ${from[0]}, row ${from[1]} to column ${to[0]}, row ${to[1]} (counted from 0 at the top-left hole)`
    + (more ? `, joined to ${plural(more, "more wire")} but to no pin` : ", connected to no pin");
  if (more) chip.append(el("span", "net-pin-label", `+${more}`));
  return chip;
}

function renderNet(net: Net): HTMLElement {
  const row = el("div", isPowerNet(net) ? "net power" : "net");
  row.title = net === highlighted ? "Click to stop showing it on the board" : "Click to show it on the board";
  makePickable(row, net);
  const head = el("div", "net-head");
  head.append(
    net.name ? el("span", "net-name", net.name) : el("span", "net-name unnamed", `Net (${pinId(net.pins[0])})`),
    el("span", "net-size", `${net.pins.length} pins`),
  );
  const pins = el("div", "net-pins");
  pins.append(...net.pins.map(pinChip));
  row.append(head, pins);
  return row;
}

// A fold of chips, one per net, each picking its net; open while one of them is lit.
function renderFold(fold: keyof typeof foldOpen, summary: string, chips: [Net, HTMLElement][]): HTMLElement {
  const details = el("details", "nets-fold");
  details.open = foldOpen[fold] || chips.some(([net]) => net === highlighted);
  details.addEventListener("toggle", () => foldOpen[fold] = details.open);
  const list = el("div", "net-pins");
  for (const [net, chip] of chips) {
    chip.title += " · click to show it on the board";
    makePickable(chip, net);
    list.append(chip);
  }
  details.append(el("summary", "", summary), list);
  return details;
}

function render() {
  const connected = nets.filter(net => net.pins.length > 1);
  const unconnected = nets.filter(net => net.pins.length === 1).sort((a, b) => comparePins(a.pins[0], b.pins[0]));
  const stray = nets.filter(net => !net.pins.length);

  // The folds come first: they're likely mistakes, and below a long list of nets they'd be
  // scrolled out of sight.
  const folds: HTMLElement[] = [];
  if (unconnected.length) {
    folds.push(renderFold("unconnected", `Not connected · ${plural(unconnected.length, "pin")}`, unconnected.map(net => [net, pinChip(net.pins[0])])));
  }
  if (stray.length) {
    const wires = stray.reduce((n, net) => n + net.wires.length, 0);
    folds.push(renderFold("stray", `Connecting no pins · ${plural(wires, "wire")}`, stray.map(net => [net, wireChip(net)])));
  }

  countEl.textContent = connected.length ? String(connected.length) : "";
  netsEl.replaceChildren(...folds, ...connected.map(renderNet));
  if (!connected.length) netsEl.append(el("div", "nets-empty", "No pins are connected yet. Wire two pins together and their net shows up here."));
}

function refresh() {
  pendingRefresh = undefined;
  const snapshot = getSaveJson();
  const json = JSON.stringify(snapshot);
  if (json === lastJson) return;
  lastJson = json;
  project = snapshot;
  nets = computeNets(snapshot).nets;
  const wasHighlighting = !!NetHighlightState.current;
  if (wasHighlighting) followHighlight();
  render();
  // The board was drawn with the net as it was before the change.
  if (wasHighlighting) redrawCanvas();
}

onRedraw(() => {
  if (pendingRefresh === undefined) pendingRefresh = window.setTimeout(refresh, REFRESH_DELAY_MS);
});

// Another project's pins may share the old one's names; don't carry the light over (a rename
// keeps it).
let openProjectId = ProjectState.current?.id;
onProjectChange(() => {
  const changed = ProjectState.current?.id !== openProjectId;
  openProjectId = ProjectState.current?.id;
  if (!changed || !NetHighlightState.current) return;
  setHighlight(undefined);
  render();
  redrawCanvas();
});
