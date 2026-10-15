import {Utils} from "../utils/utils";
import {onRedraw, redrawCanvas} from "./draw-canvas";
import {getSaveJson} from "./project/save-project";
import {onProjectChange} from "./project/current-project";
import {comparePins, computeNets, isPowerNet, Net, NetPin, pinId} from "../project-file/nets";
import {ProjectFile} from "../project-file/project-file";
import {NetHighlightState} from "../state/NetHighlightState";
import {ProjectState} from "../state/ProjectState";

// The right sidebar's Nets section: which pins the board connects, kept up to date as it changes.
// Worked out from the project file, the same snapshot autosave writes, by the shared nets.ts, so
// it matches what the MCP server reports. Clicking a net, or an unconnected pin, lights it up on
// the board (NetHighlightState) until it's clicked again; the light follows the net as it's
// edited.

const netsEl = Utils.getSafeHtmlElement("nets");
const countEl = Utils.getSafeHtmlElement("netsCount");

// Every change ends in a redraw, but so does hovering: refresh shortly after the first redraw of a
// stream, and only re-render when the board changed.
const REFRESH_DELAY_MS = 100;
let pendingRefresh: number | undefined;
let lastJson: string | undefined;
// Kept across re-renders, which rebuild the list.
let unconnectedOpen = false;

let project: ProjectFile | undefined;
let nets: Net[] = [];
let highlighted: Net | undefined;

const pinKey = (pin: NetPin) => `${pin.ref}.${pin.pin}`;

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
// all gone).
function followHighlight() {
  const previous = new Set(NetHighlightState.current?.pins ?? []);
  let best: Net | undefined;
  let bestShared = 0;
  for (const net of nets) {
    const shared = net.pins.filter(pin => previous.has(pinKey(pin))).length;
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

function render() {
  const connected = nets.filter(net => net.pins.length > 1);
  const unconnected = nets.filter(net => net.pins.length === 1).sort((a, b) => comparePins(a.pins[0], b.pins[0]));

  countEl.textContent = connected.length ? String(connected.length) : "";
  netsEl.replaceChildren(...connected.map(renderNet));
  if (!connected.length) netsEl.append(el("div", "nets-empty", "No pins are connected yet. Wire two pins together and their net shows up here."));

  if (unconnected.length) {
    const details = el("details", "nets-unconnected");
    details.open = unconnectedOpen || (!!highlighted && unconnected.includes(highlighted));
    details.addEventListener("toggle", () => unconnectedOpen = details.open);
    const pins = el("div", "net-pins");
    for (const net of unconnected) {
      const chip = pinChip(net.pins[0]);
      chip.title += " · click to show it on the board";
      makePickable(chip, net);
      pins.append(chip);
    }
    details.append(el("summary", "", `Not connected · ${unconnected.length} pin${unconnected.length === 1 ? "" : "s"}`), pins);
    netsEl.append(details);
  }
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
