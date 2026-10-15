import {Group} from "three";
import {AdvancedComponentDefinition, PinOffset} from "../features/advanced-components/advanced-component-definitions";
import {ViewerAdvancedPart} from "./project-data";
import {SceneKit} from "./scene-kit";
import {buildAudioJack} from "./parts/audio-jack";
import {buildBuzzer} from "./parts/buzzer";
import {buildCellHolder} from "./parts/cell-holder";
import {buildCeramicResonator} from "./parts/ceramic-resonator";
import {buildCoinCellHolder} from "./parts/coin-cell-holder";
import {buildCrystal} from "./parts/crystal";
import {buildDcBarrelJack} from "./parts/dc-barrel-jack";
import {buildDhtSensor} from "./parts/dht-sensor";
import {buildDipSwitch} from "./parts/dip-switch";
import {buildElectretMic} from "./parts/electret-mic";
import {buildFemaleHeader} from "./parts/female-header";
import {buildFilmCapacitor} from "./parts/film-capacitor";
import {buildFuseHolder} from "./parts/fuse-holder";
import {buildIrReceiver} from "./parts/ir-receiver";
import {buildJstXh} from "./parts/jst-xh";
import {buildJumperCap} from "./parts/jumper-cap";
import {buildLatchingSwitch} from "./parts/latching-switch";
import {buildLdr} from "./parts/ldr";
import {buildLedBargraph} from "./parts/led-bargraph";
import {buildPushButton} from "./parts/push-button";
import {buildRelay} from "./parts/relay";
import {buildRgbLed} from "./parts/rgb-led";
import {buildRotaryEncoder} from "./parts/rotary-encoder";
import {buildScrewTerminal} from "./parts/screw-terminal";
import {buildSevenSegment} from "./parts/seven-segment";
import {buildSlideSwitch} from "./parts/slide-switch";
import {buildThermistor} from "./parts/thermistor";
import {buildToggleSwitch} from "./parts/toggle-switch";
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
    case "crystal-hc49": return buildCrystal(kit, definition, part.value);
    case "ceramic-resonator": return buildCeramicResonator(kit, definition, part.value);
    case "ldr": return buildLdr(kit, definition);
    case "thermistor": return buildThermistor(kit, definition);
    case "film-capacitor": return buildFilmCapacitor(kit, definition, part.value);
    case "dip-switch-2":
    case "dip-switch-4":
    case "dip-switch-8": return buildDipSwitch(kit, definition);
    case "seven-segment-cc":
    case "seven-segment-ca": return buildSevenSegment(kit, definition);
    case "fuse-holder": return buildFuseHolder(kit, definition, part.value);
    case "rotary-encoder": return buildRotaryEncoder(kit, definition);
    case "dc-barrel-jack": return buildDcBarrelJack(kit, definition);
    case "tactile-6x6": return buildPushButton(kit, definition);
    case "latching-switch": return buildLatchingSwitch(kit, definition);
    case "toggle-spdt":
    case "toggle-dpdt": return buildToggleSwitch(kit, definition);
    case "led-bargraph-10": return buildLedBargraph(kit, definition);
    case "seven-segment-4-cc":
    case "seven-segment-4-ca": return buildSevenSegment(kit, definition, 4);
    case "ir-receiver": return buildIrReceiver(kit, definition);
    case "dht22": return buildDhtSensor(kit, definition, "#f1f2f0", 25, "DHT22");
    case "dht11": return buildDhtSensor(kit, definition, "#3d8fd1", 15.5, "DHT11");
    case "electret-mic": return buildElectretMic(kit, definition);
    case "audio-jack-3-5mm": return buildAudioJack(kit, definition);
    case "jst-xh-2":
    case "jst-xh-3":
    case "jst-xh-4": return buildJstXh(kit, definition);
    case "coin-cell-holder": return buildCoinCellHolder(kit, definition);
    case "battery-2xaa": return buildCellHolder(kit, definition, {diameter: 14.5, length: 50.5, wrap: "#2f7d4a", plusTowardRight: [false, true]});
    case "battery-18650": return buildCellHolder(kit, definition, {diameter: 18.6, length: 65, wrap: "#2563a6", plusTowardRight: [false]});
    default: return null;
  }
}
