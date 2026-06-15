import type { PhotoFilter } from "../model/types";

// CSS filter strings for each photo preset.
// Used in both the live canvas (via offscreen canvas drawImage) and export renderer (ctx.filter).
// Values tuned for natural-looking analog aesthetics, not gimmicky over-processing.
export const FILTER_PRESETS: Record<PhotoFilter, string> = {
  none:        "none",
  film:        "sepia(0.18) saturate(0.82) contrast(1.08) brightness(0.95)",
  vintage:     "sepia(0.45) saturate(0.65) contrast(0.90) brightness(0.88) hue-rotate(-8deg)",
  modern:      "saturate(1.18) contrast(1.12) brightness(1.03)",
  clean:       "brightness(1.06) contrast(1.04) saturate(1.02)",
  minimalism:  "saturate(0.45) brightness(1.06) contrast(0.90)",
  airy:        "brightness(1.22) saturate(0.72) contrast(0.86)",
};

export const FILTER_LABELS: Record<PhotoFilter, string> = {
  none:       "None",
  film:       "Film",
  vintage:    "Vintage",
  modern:     "Modern",
  clean:      "Clean",
  minimalism: "Minimal",
  airy:       "Airy",
};

export const FILTER_ORDER: PhotoFilter[] = [
  "none", "film", "vintage", "modern", "clean", "minimalism", "airy",
];

/**
 * Applies a CSS filter to a source image/canvas by drawing it onto an offscreen canvas.
 * Returns the source unchanged when filter is "none" (avoids unnecessary allocation).
 */
export function applyFilterToImage(
  src: HTMLImageElement | HTMLCanvasElement,
  filter: PhotoFilter,
): HTMLImageElement | HTMLCanvasElement {
  if (!filter || filter === "none") return src;
  const filterStr = FILTER_PRESETS[filter];
  if (!filterStr || filterStr === "none") return src;

  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  if (w === 0 || h === 0) return src;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.filter = filterStr;
  ctx.drawImage(src, 0, 0);
  return canvas;
}
