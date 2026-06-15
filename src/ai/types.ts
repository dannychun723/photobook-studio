// AI Design types — shared across analysis, pacing, and layout steps.
// All pacing rules cite research findings from docs/design-research.md.

export type Occasion =
  | "wedding"
  | "portrait"
  | "travel"
  | "family"
  | "event"
  | "newborn";

export const OCCASION_LABELS: Record<Occasion, string> = {
  wedding: "Wedding",
  portrait: "Portrait Session",
  travel: "Travel",
  family: "Family",
  event: "Event / Party",
  newborn: "Newborn",
};

// Per-photo output from vision analysis pass (R-S4, R-S8)
export interface PhotoAnalysis {
  photoId: string;
  sceneType: string;         // portrait | candid | group | landscape | detail | ceremony | ...
  isKeyMoment: boolean;      // true → hero template (R-S4)
  compositionScore: number;  // 1–10; used for deduplication selection (R-S8)
  suggestedRole: "hero" | "detail" | "filler";
  chapter: string;           // narrative chapter label (R-S2)
  colorTemperature?: "warm" | "cool" | "neutral"; // drives color-harmony sequencing
  cropHint?: "center" | "left-third" | "right-third" | "top" | "bottom"; // smart initial crop
}

// ─── Layout Style ──────────────────────────────────────────────────────────────
// Three named presets that shift template mix, whitespace ratio, and typography.
// Inspired by premium brands: Editorial = MILK/Papier; Gallery = Rosemood; Storyteller = narrative-memoir.

export type LayoutStyle = "editorial" | "gallery" | "storyteller";

export interface LayoutStyleConfig {
  label: string;
  tagline: string;
  ratio: string;         // image : whitespace ratio, shown in UI
  typography: string;    // typography description, shown in UI
  templateBias: string;  // injected verbatim into the AI design prompt
}

export const LAYOUT_STYLES: Record<LayoutStyle, LayoutStyleConfig> = {
  editorial: {
    label: "Minimalist Editorial",
    tagline: "Generous whitespace · Serif typography · Airy spreads",
    ratio: "40 : 60",
    typography: "Serif headings, generous leading",
    templateBias:
      "Prefer breather-right, text-left-photo-right, panoramic-spread, and two-up. " +
      "Avoid grid-3x3 and pano-strip entirely. Use at most 2 grid-2x2 spreads in the whole book. " +
      "Include at least 3 text-left-photo-right spreads to carry the narrative.",
  },
  gallery: {
    label: "Gallery Style",
    tagline: "Bold imagery · Dense layouts · Maximum visual impact",
    ratio: "75 : 25",
    typography: "Minimal sans-serif captions only",
    templateBias:
      "Prefer full-bleed-spread, full-bleed-pages, hero-left-details, hero-right-details, and grid-2x2. " +
      "Use at most 2 breather-right spreads. Include grid-3x3 for the peak-energy sequence. " +
      "Use text-left-photo-right only at the very start and very end of the book.",
  },
  storyteller: {
    label: "Storyteller",
    tagline: "Narrative arc · Chapter breaks · Mixed pacing",
    ratio: "55 : 45",
    typography: "Serif headings with sans-serif captions",
    templateBias:
      "Open every chapter with a text-left-photo-right spread (one per chapter). " +
      "Insert a breather-right every 4–5 spreads as a visual breath. " +
      "Include at least 2 panoramic-spread for scene-setting moments. " +
      "Mix hero and detail templates freely within each chapter so each feels distinct.",
  },
};

// One spread's worth of layout from the design pass
export interface AISpreadDesign {
  templateId: string;
  photoIds: string[];
  chapterHint?: string;      // optional opener label for first spread of a new chapter
  title?: string;            // heading text (4–7 words) — for text/breather/pano spreads
  body?: string;             // narrative paragraph — text-left-photo-right only
  caption?: string;          // short caption: date, location, or mood (≤10 words)
  borderStyle?: "none" | "white" | "keyline";  // per-spread frame border override
  bgColor?: string;          // CSS color for spread background override
  bgColorB?: string;         // gradient end color (used with bgColor for gradient)
  photoGrain?: number;       // 0–40 film-grain applied to all photos in this spread
  pageRole?: "front-cover" | "back-cover"; // first and last spreads may be covers
}

// Book-level output — wraps per-spread designs with a single chosen typography preset
// and an optional spine color for the cover strip.
export interface AIBookDesign {
  spreads: AISpreadDesign[];
  bookTypographyPreset: string;  // name from TYPOGRAPHY_PRESETS — applied to all text blocks
  spineColor?: string;           // CSS hex for cover spine strip (e.g. "#1a2744")
}

export type SocialFormat = "square" | "portrait" | "story";

export interface AIDesignOptions {
  occasion: Occasion;
  targetSpreads: number;
}

// Photo count each template requires (must match src/layout/templates.ts)
export const TEMPLATE_PHOTO_COUNTS: Record<string, number> = {
  "full-bleed-spread": 1,
  "full-bleed-pages": 2,
  "two-up": 2,
  "breather-right": 1,
  "hero-left-details": 3,
  "hero-right-details": 3,
  "grid-2x2": 4,
  "grid-3x3": 9,
  "panoramic-spread": 1,
  "pano-strip": 3,
  "portrait-landscape": 2,
  "square-strip": 3,
  "text-left-photo-right": 1,
};
