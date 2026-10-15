// Everything this server takes from the editor (../../src): its project file format, parts
// definitions and the shared code that reads a board (pins, nets, wire crossings, share links).
// The only file here that imports the editor's source, so the dependency is one-way and in one
// place: the editor never imports the server. Only pure modules (no DOM, no editor state) belong
// here; esbuild bundles them into dist/server.js.

export type {GridPos} from "../../src/project-file/grid";
export {
  PROJECT_FILE_VERSION, type ProjectFile, type Rotation, type SavedIc, type SavedWire,
} from "../../src/project-file/project-file";
export {ProjectFileError, readProjectFile} from "../../src/project-file/read-project-file";
export {BoardRefs, isValidRef, type PartKind} from "../../src/project-file/part-refs";
export {isModuleCategory, isModulePart} from "../../src/project-file/ic-package";
export {type Box, partPins, type PartPins, type PlacedPin} from "../../src/project-file/pin-positions";
export {
  boardPins, comparePins, computeNets, isPowerNet, type Net, type Netlist, type NetPin, pinId, pinName,
} from "../../src/project-file/nets";
export {holesAlong, layoutProjectWires, type WireLayout} from "../../src/project-file/wire-crossings";
export {
  decodeEmbeddedProject, makeShareFragment, MAX_SHARED_PROJECT_BYTES, readShareFragment,
} from "../../src/project-file/share-link";

// The parts catalog, as the editor's Components panel lists it.
export {COMPONENT_DEFINITIONS, type ComponentDefinition} from "../../src/features/standard-components/component-definitions";
export {
  ADVANCED_COMPONENT_DEFINITIONS, type AdvancedComponentDefinition, type PinOffset,
} from "../../src/features/advanced-components/advanced-component-definitions";
export {IC_DEFINITIONS, type IcDefinition} from "../../src/features/ic-definitions";
export {CATALOG_CATEGORIES, type CategoryId, getCategoryPath} from "../../src/features/catalog/catalog-categories";
