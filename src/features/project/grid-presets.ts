export interface GridPreset {
  label: string;
  w: number;
  h: number;
}

export const GRID_PRESETS: GridPreset[] = [
  {label: "2x8", w: 6, h: 29},
  {label: "3x7", w: 10, h: 25},
  {label: "4x6", w: 14, h: 20},
  {label: "5x7", w: 18, h: 25},
  {label: "7x9", w: 26, h: 31},
  {label: "8x12", w: 29, h: 43},
];
