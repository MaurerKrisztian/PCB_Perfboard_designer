import {CategoryId} from "./catalog/catalog-categories";

// Built-in dual-row parts placed through the IC system (ic.ts): DIP chips and dev boards/modules
// whose pins sit in two parallel rows. Pins are numbered DIP-style: 1..N down the left row,
// then N+1..2N back up the right row.
export interface IcDefinition {
  id: string;
  // Where the part is listed in the Components panel tree (see catalog-categories.ts).
  category: CategoryId;
  name: string;
  // Extra search terms (abbreviations, part families) that don't appear in `name`.
  keywords?: string[];
  // Holes spanned across the part, rows included: row spacing in 0.1" steps + 1
  // (a 0.3" DIP is 4, a 0.6" Arduino Nano is 7).
  widthPin: number;
  // Pins per row.
  heightPin: number;
  pinDescription: Record<number, string>;
}

// Builds DIP-numbered pin labels from both rows as a pinout diagram lists them: each row read
// top to bottom. Saves hand-reversing the right row, which is where transcription errors creep in.
function dualRowPins(leftTopToBottom: string[], rightTopToBottom: string[]): Record<number, string> {
  const pins: Record<number, string> = {};
  const perSide = leftTopToBottom.length;
  leftTopToBottom.forEach((label, i) => { pins[i + 1] = label; });
  rightTopToBottom.forEach((label, i) => { pins[perSide * 2 - i] = label; });
  return pins;
}

export const IC_DEFINITIONS: IcDefinition[] = [
  {
    id: "ne555", category: "ics.timers", name: "NE555 Timer", keywords: ["555", "timer", "oscillator"],
    widthPin: 4, heightPin: 4,
    pinDescription: {1: "GND", 2: "TRIG", 3: "OUT", 4: "RESET", 5: "CTRL", 6: "THRESH", 7: "DISCH", 8: "VCC"}
  },
  {
    id: "dip-14-logic", category: "ics.logic", name: "DIP-14 Logic", keywords: ["74hc", "7400", "gate"],
    widthPin: 4, heightPin: 7,
    pinDescription: {1: "1A", 2: "1B", 3: "1Y", 4: "2A", 5: "2B", 6: "2Y", 7: "GND", 14: "VCC"}
  },
  {
    id: "dip-16-logic", category: "ics.logic", name: "DIP-16 Logic", keywords: ["74hc", "shift register", "595"],
    widthPin: 4, heightPin: 8,
    pinDescription: {1: "EN", 2: "1D", 3: "1Q", 4: "2D", 5: "2Q", 8: "GND", 16: "VCC"}
  },
  {
    id: "atmega328p", category: "ics.microcontrollers", name: "ATmega328P", keywords: ["avr", "arduino", "328"],
    widthPin: 4, heightPin: 14,
    pinDescription: {1: "RESET", 2: "RX", 3: "TX", 7: "VCC", 8: "GND", 22: "GND", 20: "AVCC"}
  },
  // Arduino Nano: 0.6" between header rows, 15 pins per side. Labels as silkscreened on the board.
  {
    id: "arduino-nano", category: "modules.dev-boards", name: "Arduino Nano", keywords: ["nano", "atmega328p", "avr"],
    widthPin: 7, heightPin: 15,
    pinDescription: {
      1: "D13", 2: "3V3", 3: "REF", 4: "A0", 5: "A1", 6: "A2", 7: "A3", 8: "A4",
      9: "A5", 10: "A6", 11: "A7", 12: "5V", 13: "RST", 14: "GND", 15: "VIN",
      16: "TX1", 17: "RX0", 18: "RST", 19: "GND", 20: "D2", 21: "D3", 22: "D4",
      23: "D5", 24: "D6", 25: "D7", 26: "D8", 27: "D9", 28: "D10", 29: "D11", 30: "D12"
    }
  },
  // DOIT ESP32 DevKit V1, 30-pin: 0.9" between rows (some clones are 1.0" - check yours).
  // Antenna at the top, USB at the bottom.
  {
    id: "esp32-devkit-v1-30", category: "modules.dev-boards", name: "ESP32 DevKit V1 (30-pin)",
    keywords: ["esp32", "esp", "doit", "wifi", "bluetooth"],
    widthPin: 10, heightPin: 15,
    pinDescription: dualRowPins(
      ["EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"],
      ["D23", "D22", "TX0", "RX0", "D21", "D19", "D18", "D5", "TX2", "RX2", "D4", "D2", "D15", "GND", "3V3"]
    )
  },
  // Espressif ESP32-DevKitC V4, 38-pin: 1.0" between rows. Antenna at the top, USB at the bottom.
  {
    id: "esp32-devkitc-38", category: "modules.dev-boards", name: "ESP32 DevKitC (38-pin)",
    keywords: ["esp32", "esp", "espressif", "wroom", "wifi", "bluetooth"],
    widthPin: 11, heightPin: 19,
    pinDescription: dualRowPins(
      ["3V3", "EN", "VP", "VN", "IO34", "IO35", "IO32", "IO33", "IO25", "IO26", "IO27", "IO14", "IO12", "GND", "IO13", "SD2", "SD3", "CMD", "5V"],
      ["GND", "IO23", "IO22", "TX", "RX", "IO21", "GND", "IO19", "IO18", "IO5", "IO17", "IO16", "IO4", "IO0", "IO2", "IO15", "SD1", "SD0", "CLK"]
    )
  },
  // Raspberry Pi Pico: 0.7" between rows, 20 pins per side. USB at the top (pin 1 = GP0).
  {
    id: "raspberry-pi-pico", category: "modules.dev-boards", name: "Raspberry Pi Pico",
    keywords: ["pico", "rp2040", "raspberry", "rpi"],
    widthPin: 8, heightPin: 20,
    pinDescription: dualRowPins(
      ["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7", "GP8", "GP9", "GND", "GP10", "GP11", "GP12", "GP13", "GND", "GP14", "GP15"],
      ["VBUS", "VSYS", "GND", "3V3_EN", "3V3", "ADC_VREF", "GP28", "AGND", "GP27", "GP26", "RUN", "GP22", "GND", "GP21", "GP20", "GP19", "GP18", "GND", "GP17", "GP16"]
    )
  },
  // Wemos / LOLIN D1 Mini: 0.9" between rows, 8 pins per side. Antenna at the top, USB at the bottom.
  {
    id: "wemos-d1-mini", category: "modules.dev-boards", name: "Wemos D1 Mini",
    keywords: ["d1 mini", "lolin", "esp8266", "wifi"],
    widthPin: 10, heightPin: 8,
    pinDescription: dualRowPins(
      ["RST", "A0", "D0", "D5", "D6", "D7", "D8", "3V3"],
      ["TX", "RX", "D1", "D2", "D3", "D4", "GND", "5V"]
    )
  },
];

export function getIcDefinition(id: string): IcDefinition | undefined {
  return IC_DEFINITIONS.find(def => def.id === id);
}
