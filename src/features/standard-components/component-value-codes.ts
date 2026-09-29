// Shared "D1 D2 * 10^E" normalization used by both the resistor 4-band code and the
// ceramic capacitor 3-digit EIA code. Returns undefined if the value can't be represented
// with a 2-significant-digit mantissa within [minExponent, maxExponent].
interface MantissaCode {
  digit1: number; // 1-9
  digit2: number; // 0-9
  exponent: number;
}

function normalizeToMantissaExponent(value: number, minExponent: number, maxExponent: number): MantissaCode | undefined {
  if (!isFinite(value) || value <= 0) return undefined;

  let exponent = Math.floor(Math.log10(value)) - 1;
  let mantissa = Math.round(value / Math.pow(10, exponent));

  // Rounding can push the mantissa just outside [10,99] at the boundaries (e.g. 999.6 rounds to 100).
  if (mantissa >= 100) { mantissa = Math.round(mantissa / 10); exponent += 1; }
  if (mantissa < 10) { mantissa = Math.round(mantissa * 10); exponent -= 1; }
  if (mantissa >= 100) { mantissa = Math.round(mantissa / 10); exponent += 1; }

  if (exponent < minExponent || exponent > maxExponent) return undefined;

  const digit1 = Math.floor(mantissa / 10);
  const digit2 = mantissa % 10;
  if (digit1 < 1 || digit1 > 9) return undefined;

  return {digit1, digit2, exponent};
}

// --- Resistor 4-band color code ---

const RESISTOR_MIN_EXPONENT = -2; // silver, x0.01
const RESISTOR_MAX_EXPONENT = 9; // white, x10^9

const RESISTOR_DIGIT_COLORS: string[] = [
  "#111111", // 0 Black
  "#7b4a24", // 1 Brown
  "#d4291f", // 2 Red
  "#e8781f", // 3 Orange
  "#f2d024", // 4 Yellow
  "#2e8b3d", // 5 Green
  "#2255c4", // 6 Blue
  "#8446c6", // 7 Violet
  "#8c8c8c", // 8 Gray
  "#f5f5f0", // 9 White
];

const RESISTOR_MULTIPLIER_GOLD = "#c9a227"; // exponent -1
const RESISTOR_MULTIPLIER_SILVER = "#c8c8c8"; // exponent -2

// No tolerance data is stored anywhere in the app, so the 4th band always shows Gold (+/-5%),
// the most common default for generic through-hole resistors. This is a cosmetic assumption,
// not derived from anything the user entered.
const RESISTOR_TOLERANCE_COLOR = "#c9a227";

function getMultiplierColor(exponent: number): string {
  if (exponent === -1) return RESISTOR_MULTIPLIER_GOLD;
  if (exponent === -2) return RESISTOR_MULTIPLIER_SILVER;
  return RESISTOR_DIGIT_COLORS[exponent];
}

export interface ResistorBandColors {
  digit1: string;
  digit2: string;
  multiplier: string;
  tolerance: string;
}

/** Given a resistance in ohms, returns the 4 band colors in draw order, or undefined if the
 *  value falls outside the range representable by standard single-band colors. */
export function getResistorBandColors(ohms: number): ResistorBandColors | undefined {
  const code = normalizeToMantissaExponent(ohms, RESISTOR_MIN_EXPONENT, RESISTOR_MAX_EXPONENT);
  if (!code) return undefined;
  return {
    digit1: RESISTOR_DIGIT_COLORS[code.digit1],
    digit2: RESISTOR_DIGIT_COLORS[code.digit2],
    multiplier: getMultiplierColor(code.exponent),
    tolerance: RESISTOR_TOLERANCE_COLOR,
  };
}

// --- Ceramic capacitor 3-digit EIA code ---

const CERAMIC_MIN_EXPONENT = 0; // the 3rd digit is always a single 0-9 digit, never gold/silver
const CERAMIC_MAX_EXPONENT = 9;

/** Given a capacitance in farads, returns the 3-character EIA code (e.g. "104"), or undefined
 *  if it can't be represented this way (< 10pF, since real sub-10pF ceramics are printed with
 *  their literal value, not a 3-digit code) - caller should fall back to the plain value text. */
export function getCeramicCapacitorCode(farads: number): string | undefined {
  const picofarads = farads * 1e12;
  const code = normalizeToMantissaExponent(picofarads, CERAMIC_MIN_EXPONENT, CERAMIC_MAX_EXPONENT);
  if (!code) return undefined;
  return `${code.digit1}${code.digit2}${code.exponent}`;
}
