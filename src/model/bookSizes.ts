import type { BookSize } from "./types";

// Square is the most forgiving for mixed portrait/landscape shoots (R-O6),
// so 21×21 cm is the default offered first.
export const BOOK_SIZES: BookSize[] = [
  { id: "square-21", label: "21 × 21 cm Square", pageWidthMm: 210, pageHeightMm: 210, orientation: "square" },
  { id: "square-30", label: "30 × 30 cm Square", pageWidthMm: 300, pageHeightMm: 300, orientation: "square" },
  { id: "a4-landscape", label: "A4 Landscape (29.7 × 21 cm)", pageWidthMm: 297, pageHeightMm: 210, orientation: "landscape" },
  { id: "a4-portrait", label: "A4 Portrait (21 × 29.7 cm)", pageWidthMm: 210, pageHeightMm: 297, orientation: "portrait" },
];

export const DEFAULT_SIZE_ID = "square-21";

export function getBookSize(sizeId: string): BookSize {
  const size = BOOK_SIZES.find((s) => s.id === sizeId);
  if (!size) throw new Error(`Unknown book size: ${sizeId}`);
  return size;
}
