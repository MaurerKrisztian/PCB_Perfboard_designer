import {GridPos} from "./editor";

// Small helpers for the words and positions in replies, so every tool writes them the same way.

// A map key for a hole.
export const holeKey = ([c, r]: readonly number[]) => `${c},${r}`;

// A hole as replies show it: "[3, 4]".
export const showHole = ([c, r]: readonly number[]) => `[${c}, ${r}]`;

// A copy of a hole given as a plain number array.
export const toGridPos = (at: readonly number[]): GridPos => [at[0], at[1]];

export const sameHole = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];

// "1 wire", "2 wires".
export const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;

// "a", "a and b", "a, b and c".
export function joinList(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// A wire as replies name it, by its place in the file: "wires[3]".
export const wireName = (i: number) => `wires[${i}]`;

export const offBoard = (cols: number, rows: number) =>
  `off the ${cols}×${rows} board (columns 0-${cols - 1}, rows 0-${rows - 1})`;

export const errorMessage = (err: unknown) => err instanceof Error ? err.message : String(err);
