import {ComponentUnit} from "./component-definitions";

interface Prefix {
  symbols: string[];
  factor: number;
}

// Ordered ascending by factor; used for both parsing (matching a typed prefix letter)
// and formatting (picking the best-fit prefix for a given magnitude).
const SI_PREFIXES: Prefix[] = [
  {symbols: ["p"], factor: 1e-12},
  {symbols: ["n"], factor: 1e-9},
  {symbols: ["u", "µ", "μ"], factor: 1e-6},
  {symbols: ["m"], factor: 1e-3},
  {symbols: ["k", "K"], factor: 1e3},
  {symbols: ["M"], factor: 1e6},
  {symbols: ["G", "g"], factor: 1e9},
];

const DISPLAY_PREFIXES: {symbol: string; factor: number}[] = [
  {symbol: "p", factor: 1e-12},
  {symbol: "n", factor: 1e-9},
  {symbol: "µ", factor: 1e-6},
  {symbol: "m", factor: 1e-3},
  {symbol: "", factor: 1},
  {symbol: "k", factor: 1e3},
  {symbol: "M", factor: 1e6},
  {symbol: "G", factor: 1e9},
];

const UNIT_ALIASES: Record<ComponentUnit, string[]> = {
  "Ω": ["ohm", "ohms", "r"],
  "F": ["farad", "farads", "f"],
  "H": ["henry", "henries", "h"],
};

function isUnitToken(token: string, unit: ComponentUnit): boolean {
  if (token === unit) return true;
  return UNIT_ALIASES[unit].indexOf(token.toLowerCase()) !== -1;
}

// Resolves a suffix (whatever follows the digits) to a multiplier. Handles a bare unit
// ("Ω", "ohms"), a bare SI prefix ("k", "M"), a prefix + unit ("pF", "uF"), or nothing at all.
function resolvePrefixFactor(token: string, unit: ComponentUnit): number | undefined {
  if (!token) return 1;
  if (isUnitToken(token, unit)) return 1;
  for (const {symbols, factor} of SI_PREFIXES) {
    for (const symbol of symbols) {
      if (token.startsWith(symbol)) {
        const rest = token.slice(symbol.length);
        if (rest === "" || isUnitToken(rest, unit)) return factor;
      }
    }
  }
  return undefined;
}

/**
 * Parses flexible component value notations into a number expressed in the base unit
 * (ohms, farads, or henries). Accepts a bare number ("22"), a trailing SI-prefixed unit
 * ("4.7k", "100pF", "10uF", "1M"), and shorthand where the prefix letter stands in for
 * the decimal point ("4k7" -> 4.7k, "4R7" -> 4.7Ω).
 */
export function parseComponentValue(input: string, unit: ComponentUnit): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const shorthand = trimmed.match(/^(\d+)([a-zA-ZΩµμ]+)(\d+)$/);
  if (shorthand) {
    const [, intPart, token, fracPart] = shorthand;
    const factor = resolvePrefixFactor(token, unit);
    if (factor === undefined) return undefined;
    return parseFloat(`${intPart}.${fracPart}`) * factor;
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-ZΩµμ]*)$/);
  if (!match) return undefined;
  const [, numStr, suffix] = match;
  const factor = resolvePrefixFactor(suffix, unit);
  if (factor === undefined) return undefined;
  return parseFloat(numStr) * factor;
}

function roundSignificant(num: number, digits: number): number {
  return parseFloat(num.toPrecision(digits));
}

/** Formats a base-unit value (e.g. ohms) back into a normalized display string, e.g. 4700 -> "4.7kΩ". */
export function formatComponentValue(value: number, unit: ComponentUnit): string {
  if (value === 0) return `0${unit}`;
  const abs = Math.abs(value);
  let chosen = DISPLAY_PREFIXES[0];
  for (const prefix of DISPLAY_PREFIXES) {
    if (abs / prefix.factor >= 1) chosen = prefix;
  }
  const scaled = roundSignificant(value / chosen.factor, 6);
  return `${scaled}${chosen.symbol}${unit}`;
}
