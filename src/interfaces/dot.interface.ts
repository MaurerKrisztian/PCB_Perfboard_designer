export interface IDot {
  color?: string;
  description?: string | null;
  // Stripboard only: the strip is cut (drilled through) at this hole. See SavedStripboard.cuts.
  cut?: boolean;
  x: number,
  y: number,
}
