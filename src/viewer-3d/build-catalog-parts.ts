import {Group} from "three";
import {AdvancedComponentDefinition, PinOffset} from "../features/advanced-components/advanced-component-definitions";
import {ViewerAdvancedPart} from "./project-data";
import {SceneKit} from "./scene-kit";
import {buildBuzzer} from "./parts/buzzer";
import {buildFemaleHeader} from "./parts/female-header";
import {buildJumperCap} from "./parts/jumper-cap";
import {buildPushButton} from "./parts/push-button";
import {buildRelay} from "./parts/relay";
import {buildRgbLed} from "./parts/rgb-led";
import {buildScrewTerminal} from "./parts/screw-terminal";
import {buildSlideSwitch} from "./parts/slide-switch";
import {buildTrimmer} from "./parts/trimmer";

export function buildCatalogPart(kit: SceneKit, part: ViewerAdvancedPart, definition: AdvancedComponentDefinition | undefined, offsets: PinOffset[]): Group | null {
  if (!definition) return null;
  switch (part.definitionId) {
    case "screw-terminal-2":
    case "screw-terminal-3": return buildScrewTerminal(kit, definition);
    case "push-button": return buildPushButton(kit, definition);
    case "slide-switch": return buildSlideSwitch(kit, definition);
    case "trimmer": return buildTrimmer(kit, definition, part.value);
    case "female-header": return buildFemaleHeader(kit, offsets);
    case "jumper-cap": return buildJumperCap(kit, definition);
    case "buzzer": return buildBuzzer(kit, definition);
    case "relay-dpdt": return buildRelay(kit, definition, part.value);
    case "rgb-led-cathode":
    case "rgb-led-anode": return buildRgbLed(kit, definition);
    default: return null;
  }
}
