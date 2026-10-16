import {comparePins, Net, Netlist, NetPin, pinId, pinName} from "./editor";
import {joinList} from "./text";

// validate_project's expectNets: the nets an agent meant to make, compared with the ones the board
// makes (worked out by the editor's nets.ts). Every net listed should be one net on the board, and nothing else
// should be joined to it: a pin in no listed net should connect to nothing.

// Signs written either way: a battery's "−" is also "-".
const norm = (text: string) => text.trim().replace(/[−–]/g, "-").toLowerCase();

// The board's pins by ref, for findPin.
export function pinsByRef(pins: NetPin[]): Map<string, NetPin[]> {
  const byRef = new Map<string, NetPin[]>();
  for (const pin of [...pins].sort(comparePins)) byRef.set(norm(pin.ref), [...(byRef.get(norm(pin.ref)) ?? []), pin]);
  return byRef;
}

// A pin by any name an agent may write it: "U1.8", "U1.8 VCC", "U1.VCC", "D1.K", "D1.1", "C1.+".
// Returns why not when it can't be found.
export function findPin(name: string, pinsByRef: Map<string, NetPin[]>): NetPin | string {
  const dot = name.indexOf(".");
  if (dot < 1) return `"${name}" isn't a pin: write REF.pin, e.g. "U1.8", "R1.1" or "D1.K"`;
  const ref = name.slice(0, dot).trim();
  const rest = name.slice(dot + 1).trim();
  const pins = pinsByRef.get(norm(ref));
  if (!pins) return `"${name}": there's no part ${ref}`;

  const [first, ...more] = rest.split(/\s+/);
  const label = more.join(" ");
  const numbered = /^\d+$/.test(first) ? pins.find(p => p.pin === Number(first)) : undefined;
  if (numbered && (!label || norm(label) === norm(numbered.label ?? ""))) return numbered;
  const named = pins.filter(p => p.label && norm(p.label) === norm(rest));
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    return `"${name}": ${named[0].ref} has ${named.length} pins named ${named[0].label} (${named.map(p => p.pin).join(", ")}), so give the number, e.g. "${named[0].ref}.${named[0].pin}"`;
  }
  if (numbered) return `"${name}": ${pinId(numbered)} is ${numbered.label ? `${numbered.label}, not ${label}` : "unnamed"}`;
  const last = Math.max(...pins.map(p => p.pin));
  if (/^\d+$/.test(first)) return `"${name}": ${pins[0].ref} has no pin ${first} (its pins are 1-${last})`;
  return `"${name}": ${pins[0].ref} has no pin named ${rest} (its pins: ${pins.map(pinName).join(", ")})`;
}

const pinSet = (pins: NetPin[]) => `{${pins.map(pinName).join(", ")}}`;

export function checkExpectedNets(netlist: Netlist, expected: string[][], error: (message: string) => void): void {
  const netOf = new Map<NetPin, Net>();
  for (const net of netlist.nets) {
    for (const pin of net.pins) netOf.set(pin, net);
  }
  const byRef = pinsByRef([...netOf.keys()]);

  // Which listed net each pin is in.
  const listedIn = new Map<NetPin, number>();
  let unreadable = 0;
  const listed = expected.map((names, i) => {
    const pins: NetPin[] = [];
    names.forEach((name, j) => {
      const pin = findPin(name, byRef);
      if (typeof pin === "string") {
        unreadable++;
        error(`expectNets[${i}][${j}] ${pin}.`);
        return;
      }
      const before = listedIn.get(pin);
      if (before === i) return;
      if (before !== undefined) {
        unreadable++;
        error(`expectNets[${i}][${j}]: ${pinName(pin)} is in expectNets[${before}] too. A pin is on one net: merge the two if they're meant to be connected.`);
        return;
      }
      listedIn.set(pin, i);
      pins.push(pin);
    });
    return pins;
  });
  // The rest would be compared against a list that isn't what was meant.
  if (unreadable) {
    error(`expectNets wasn't compared with the board: fix the ${unreadable === 1 ? "entry" : `${unreadable} entries`} above first.`);
    return;
  }

  listed.forEach((pins, i) => {
    const apart = groupBy(pins, pin => netOf.get(pin));
    if (apart.length < 2) return;
    error(`Missing connection: expectNets[${i}] should be one net, but on the board ${joinList(apart.map(pinSet))} aren't connected to each other.`);
  });

  for (const net of netlist.nets) {
    if (net.pins.length < 2) continue;
    const together = groupBy(net.pins.filter(pin => listedIn.has(pin)), pin => listedIn.get(pin));
    const unlisted = net.pins.filter(pin => !listedIn.has(pin));
    if (together.length + unlisted.length < 2) continue;
    const groups = [
      ...together.map(pins => `${pinSet(pins)} (expectNets[${listedIn.get(pins[0])}])`),
      ...(unlisted.length ? [`${pinSet(unlisted)} (in no expected net)`] : []),
    ];
    error(`Extra connection: on the board, ${net.name ? `net ${net.name}` : "one net"} joins ${joinList(groups)}.`);
  }
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): T[][] {
  const groups = new Map<K, T[]>();
  for (const item of items) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  return [...groups.values()];
}
