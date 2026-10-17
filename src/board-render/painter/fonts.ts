import {Font} from "./painter";

// The font stacks behind Font's families, as the editor has always drawn its text.
const FAMILIES: Record<Font["family"], string> = {
  mono: "monospace, sans-serif",
  sans: "Inter, Arial, sans-serif",
};

export function fontFamily(font: Font): string {
  return FAMILIES[font.family];
}

// A CSS font shorthand, e.g. "700 11px monospace, sans-serif".
export function cssFont(font: Font): string {
  return `${font.weight ?? 400} ${font.size}px ${fontFamily(font)}`;
}

// About how wide a line of text is, for painters that can't measure it (SVG has no measureText):
// a monospace glyph is 0.6em wide, a sans one about 0.55em (a little more when bold).
export function estimateTextWidth(text: string, font: Font): number {
  const em = font.family === "mono" ? 0.6 : (font.weight ?? 400) >= 600 ? 0.6 : 0.55;
  return [...text].length * font.size * em;
}
