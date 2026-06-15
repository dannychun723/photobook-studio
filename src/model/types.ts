// Core document model. Pure, JSON-serializable data — the canvas only renders it,
// themes only re-token it (non-destructive restyle), AI only generates it.
// All geometry is in millimeters in spread coordinates: origin at the top-left of
// the LEFT page; a spread is (2 × page width) × page height. Design unit = spread (R-P3).

export type Orientation = "portrait" | "landscape" | "square";
export type Binding = "standard" | "layflat"; // gutter rules differ per R-W5
export type BorderStyle = "none" | "white" | "keyline" | "soft"; // R-W2, R-W3, R-W4
export type ThemeId =
  | "modern"
  | "minimal"
  | "warm"
  | "classic"
  | "editorial"
  | "playful"
  | "studio"
  | "heritage"
  | "noir"
  | "golden"
  | "sage"
  | "haze";

// Photo/spread filter presets — CSS-filter-based color grading
export type PhotoFilter =
  | "none"
  | "film"
  | "vintage"
  | "modern"
  | "clean"
  | "minimalism"
  | "airy";

export interface BookSize {
  id: string;
  label: string;
  pageWidthMm: number;
  pageHeightMm: number;
  orientation: Orientation;
}

export interface Project {
  id: string;
  name: string;
  sizeId: string;
  binding: Binding;
  themeId: ThemeId;
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  id: string;
  projectId: string;
  fileName: string;
  width: number; // original pixel dimensions, EXIF-orientation corrected
  height: number;
  orientation: Orientation;
  takenAt?: number; // EXIF capture time when available (drives sequencing, R-S2)
  importedAt: number;
}

// Pan/zoom crop inside a frame: offset of the visible window within the photo,
// as fractions of the photo (0–1), plus zoom ≥ 1 (1 = cover-fit).
export interface FrameCrop {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface Frame {
  id: string;
  photoId?: string; // empty frame = placeholder slot
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees, free mode only
  z: number;
  crop: FrameCrop;
  border: BorderStyle | null; // null = inherit page/theme default
  fit?: "cover" | "contain";  // "cover" (default) = fill frame; "contain" = full photo visible with letterbox
  role?: "hero" | "detail"; // pacing role from templates (R-S4)
  opacity?: number;  // 0–1, default 1 (fully opaque)
  grain?: number;    // 0–100 film-grain intensity
  softEdge?: number; // 5–50 soft-edge fade % of shortest dimension (only when border="soft")
}

// Spread background override — solid color, gradient, or photo
export interface SpreadBg {
  type: "solid" | "gradient" | "photo";
  color: string;       // CSS color (main / top) or placeholder for photo type
  colorB?: string;     // gradient bottom color (gradient only)
  photoId?: string;    // photo to use as spread background (photo type only)
  opacity?: number;    // 0–1 opacity of the photo background (photo type only, default 1)
  fit?: "cover" | "contain"; // photo fit mode (photo type only, default "cover")
  // Position/size override for the BG photo (absent = auto cover-fit)
  x?: number;          // mm from spread left edge
  y?: number;          // mm from spread top edge
  w?: number;          // mm width
  h?: number;          // mm height
}

// One photo layer in a multi-photo background stack
export interface SpreadBgLayer {
  id: string;
  photoId: string;
  opacity?: number;    // 0–1, default 0.85
  x?: number;          // mm from spread left (absent = auto cover-fit)
  y?: number;
  w?: number;
  h?: number;
}

// Emoji sticker placed on a spread
export interface StickerBlock {
  id: string;
  emoji: string;
  x: number;      // mm from spread origin
  y: number;
  sizeMm: number; // font-size equivalent in mm
  rotation: number;
  z: number;
  opacity?: number;
}

// Decorative shape block (white box / color fill) placed on a spread
export interface ShapeBlock {
  id: string;
  x: number;        // mm from spread origin
  y: number;
  width: number;    // mm
  height: number;   // mm
  fill: string;     // CSS color
  opacity: number;  // 0–1
  rotation: number; // degrees
  z: number;
}

export type TextRole = "heading" | "body" | "caption"; // strict hierarchy, R-T3

export interface TextBlock {
  id: string;
  role: TextRole;
  text: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  z: number;
  align: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  height?: number; // mm — when set, text box clips to this height
  // Per-block style overrides; absent = use theme defaults
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic" | "bold";
  fontColor?: string; // explicit color override; absent = use theme fill
}

export interface Spread {
  id: string;
  projectId: string;
  index: number; // order within the book
  templateId?: string; // template it was created from (citable, see src/layout)
  frames: Frame[];
  texts: TextBlock[];
  background?: string; // legacy solid-color override; default comes from theme tokens
  bg?: SpreadBg;       // structured background override (takes precedence over background)
  borderDefault?: BorderStyle; // per-spread border toggle (brief: per page & per photo)
  stickers?: StickerBlock[];
  pageRole?: "front-cover" | "back-cover"; // absent = interior spread
  filter?: PhotoFilter;  // color-grading filter applied to all photos in this spread
  bgLayers?: SpreadBgLayer[];  // extra photo layers stacked above the primary background
  shapes?: ShapeBlock[];       // decorative boxes / white overlays
  spineColor?: string;         // cover spread only — spine strip fill color
  spineWidthMm?: number;       // cover spread only — spine strip width in mm (default 12)
  showSpine?: boolean;         // cover spread only — set false to hide the spine strip (default true)
}
