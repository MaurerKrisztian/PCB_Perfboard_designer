import {ProjectFile, readProjectFile} from "./editor";

// Example projects, served as resources and as new_project's `example`. Their files come from
// ../examples, baked in by build.mjs (which lists the same ids).

export const EXAMPLES: Record<string, {title: string; description: string}> = {
  "555-led-blinker": {
    title: "555 LED blinker (perfboard)",
    description: "An NE555 astable flashing an LED about once a second, on a perfboard: chip, two timing resistors, timing and control capacitors, LED with its resistor, and a power header, all joined by wires.",
  },
  "555-led-blinker-stripboard": {
    title: "555 LED blinker (stripboard)",
    description: "The same 555 LED blinker on a stripboard with horizontal strips: the strips do most of the wiring, with cuts under the chip so its two pin rows aren't shorted, and a few wire links.",
  },
};

export const EXAMPLE_IDS = Object.keys(EXAMPLES) as [string, ...string[]];

export function exampleProject(id: string): ProjectFile | undefined {
  const text = EXAMPLE_PROJECTS[id];
  return text === undefined ? undefined : readProjectFile(JSON.parse(text)).project;
}
