import type { BorderStyle, ThemeId } from "../model/types";

// Theme token sets. Each theme is a pure render-time token object — no
// geometry is mutated when switching themes (non-destructive, per brief).
// Tokens applied by: SpreadCanvas (background, safe-zone color, text styles),
// FrameNode (default border), ThemeSwitcher (switcher UI).
//
// Every token set cites the research finding that grounds its styling:
//   Modern     → R-TH3   Minimal    → R-TH2   Warm    → R-TH4
//   Classic    → R-TH1   Editorial  → R-TH5   Playful → R-TH6

export interface ThemeFontTokens {
  family: string;
  size: number;
  weight: string;
  style: "normal" | "italic" | "bold";
  fill: string;
}

export interface ThemeTokens {
  id: ThemeId;
  label: string;
  description: string;

  // Spread / page background — the "paper" color (R-TH1–6)
  background: string;

  // Default border when frame.border === null AND spread.borderDefault === undefined
  defaultBorder: BorderStyle;

  // Colors used when rendering white-border and keyline-border (let themes
  // tint these to match their paper color, e.g. cream mat for Warm/Classic)
  whiteBorderColor: string;  // typically matches or complements background
  keylineColor: string;

  // Typography — heading / body / caption (max 2 font families, R-T1)
  fonts: {
    heading: ThemeFontTokens;
    body: ThemeFontTokens;
    caption: ThemeFontTokens;
  };

  // Canvas chrome
  gutterColor: string;       // center-fold guide line
  safeZoneColor: string;     // safe-zone dash color

  // Swatch colors shown in the switcher card
  swatch: string;            // dominant background
  swatchAccent: string;      // typography/accent sample color
}

const INTER = "Inter, ui-sans-serif, system-ui, sans-serif";
const FRAUNCES = "Fraunces, ui-serif, Georgia, serif";
const PLAYFAIR = "Playfair Display, ui-serif, Georgia, serif";
const CORMORANT = "Cormorant Garamond, ui-serif, Georgia, serif";

export const THEMES: ThemeTokens[] = [
  {
    // R-TH3: Modern — neutral backgrounds, high-contrast, immersive full-bleed,
    // contemporary sans pairing, linen-cover sensibility.
    id: "modern",
    label: "Modern",
    description: "Clean white paper, no borders, bold sans typography",
    background: "#ffffff",
    defaultBorder: "none",
    whiteBorderColor: "#ffffff",
    keylineColor: "#d4d4d4",
    fonts: {
      heading: { family: INTER, size: 24, weight: "700", style: "normal", fill: "#111114" },
      body:    { family: INTER, size: 13, weight: "400", style: "normal", fill: "#444448" },
      caption: { family: INTER, size: 11, weight: "400", style: "normal", fill: "#888890" },
    },
    gutterColor: "rgba(0,0,0,0.10)",
    safeZoneColor: "rgba(0,0,0,0.12)",
    swatch: "#ffffff",
    swatchAccent: "#111114",
  },
  {
    // R-TH2: Minimal — exclusively white, zero motifs/accents, single crisp sans,
    // generous negative space as the design element, gallery aesthetic.
    id: "minimal",
    label: "Minimal",
    description: "Gallery-white, generous margins, single sans-serif",
    background: "#fafafa",
    defaultBorder: "none",
    whiteBorderColor: "#fafafa",
    keylineColor: "#e0e0e0",
    fonts: {
      heading: { family: INTER, size: 18, weight: "600", style: "normal", fill: "#1a1a1a" },
      body:    { family: INTER, size: 12, weight: "400", style: "normal", fill: "#5a5a5a" },
      caption: { family: INTER, size: 10, weight: "400", style: "normal", fill: "#9a9a9a" },
    },
    gutterColor: "rgba(0,0,0,0.07)",
    safeZoneColor: "rgba(0,0,0,0.08)",
    swatch: "#fafafa",
    swatchAccent: "#1a1a1a",
  },
  {
    // R-TH4: Warm — cream/warm-neutral paper, humanist serif + sans mix,
    // soft white mat borders, "light and airy" colour temperature (R-TH8c).
    id: "warm",
    label: "Warm",
    description: "Cream paper, soft white mat borders, Fraunces serif",
    background: "#f3e4c2",
    defaultBorder: "white",
    whiteBorderColor: "#f3e4c2",  // mat matches paper so border blends naturally
    keylineColor: "#c8b898",
    fonts: {
      heading: { family: FRAUNCES, size: 22, weight: "500", style: "normal", fill: "#3a3228" },
      body:    { family: INTER,    size: 13, weight: "400", style: "normal", fill: "#5a5048" },
      caption: { family: INTER,    size: 11, weight: "400", style: "italic", fill: "#8a8078" },
    },
    gutterColor: "rgba(90,70,50,0.15)",
    safeZoneColor: "rgba(90,70,50,0.18)",
    swatch: "#f3e4c2",
    swatchAccent: "#3a3228",
  },
  {
    // R-TH1: Classic / Timeless — white or black, formal symmetry, structured
    // grid, consistent white gallery borders (R-W2), classic serif headings.
    id: "classic",
    label: "Classic",
    description: "White paper, gallery mat borders, classic Fraunces serif",
    background: "#ffffff",
    defaultBorder: "white",
    whiteBorderColor: "#ffffff",
    keylineColor: "#c8c8c8",
    fonts: {
      heading: { family: FRAUNCES, size: 22, weight: "600", style: "normal", fill: "#1a1a1a" },
      body:    { family: INTER,    size: 13, weight: "400", style: "normal", fill: "#4a4a4a" },
      caption: { family: INTER,    size: 11, weight: "400", style: "italic", fill: "#8a8a8a" },
    },
    gutterColor: "rgba(0,0,0,0.10)",
    safeZoneColor: "rgba(0,0,0,0.12)",
    swatch: "#ffffff",
    swatchAccent: "#1a1a1a",
  },
  {
    // Studio — inspired by Milk Books: crisp white, Playfair Display serif,
    // full-bleed with elegant typographic hierarchy, no borders. Luxury editorial.
    id: "studio",
    label: "Studio",
    description: "Crisp white, Playfair serif — editorial luxury photobook",
    background: "#ffffff",
    defaultBorder: "none",
    whiteBorderColor: "#ffffff",
    keylineColor: "#d0d0d0",
    fonts: {
      heading: { family: PLAYFAIR, size: 26, weight: "700", style: "normal", fill: "#0d0d0d" },
      body:    { family: INTER,    size: 12, weight: "400", style: "normal", fill: "#3a3a3a" },
      caption: { family: INTER,    size: 10, weight: "400", style: "italic", fill: "#888888" },
    },
    gutterColor: "rgba(0,0,0,0.08)",
    safeZoneColor: "rgba(0,0,0,0.10)",
    swatch: "#ffffff",
    swatchAccent: "#0d0d0d",
  },
  {
    // Heritage — inspired by Rosemood: ivory canvas, Cormorant Garamond, romantic
    // white mat borders, timeless and emotionally warm. Popular for weddings.
    id: "heritage",
    label: "Heritage",
    description: "Ivory canvas, Cormorant Garamond — timeless and romantic",
    background: "#f8f4ef",
    defaultBorder: "white",
    whiteBorderColor: "#f8f4ef",
    keylineColor: "#c8b8a8",
    fonts: {
      heading: { family: CORMORANT, size: 28, weight: "500", style: "italic", fill: "#2a2218" },
      body:    { family: CORMORANT, size: 14, weight: "400", style: "normal", fill: "#4a3e32" },
      caption: { family: INTER,    size: 10, weight: "300", style: "normal", fill: "#8a7a6a" },
    },
    gutterColor: "rgba(80,60,40,0.12)",
    safeZoneColor: "rgba(80,60,40,0.15)",
    swatch: "#f8f4ef",
    swatchAccent: "#2a2218",
  },
  {
    // Noir — deep charcoal background, white typography, cinematic full-bleed drama.
    // Trend 2024–25: dark editorial photobooks for moody/fashion/event photography.
    id: "noir",
    label: "Noir",
    description: "Dramatic dark charcoal, white type — cinematic and moody",
    background: "#111318",
    defaultBorder: "none",
    whiteBorderColor: "#1e2128",
    keylineColor: "#3a3d47",
    fonts: {
      heading: { family: INTER,     size: 22, weight: "700", style: "normal", fill: "#f0f0f0" },
      body:    { family: INTER,     size: 13, weight: "300", style: "normal", fill: "#a8a8b0" },
      caption: { family: INTER,     size: 10, weight: "400", style: "normal", fill: "#6a6a78" },
    },
    gutterColor: "rgba(255,255,255,0.08)",
    safeZoneColor: "rgba(255,255,255,0.10)",
    swatch: "#111318",
    swatchAccent: "#f0f0f0",
  },
  {
    // Golden Hour — warm honey amber, romantic Fraunces serif, soft mat borders.
    // Trend 2024–25: golden-warm aesthetic dominates wedding/portrait market.
    id: "golden",
    label: "Golden Hour",
    description: "Honey amber paper, romantic serif, warm mat borders",
    background: "#f5e6c4",
    defaultBorder: "white",
    whiteBorderColor: "#f5e6c4",
    keylineColor: "#d4b87a",
    fonts: {
      heading: { family: FRAUNCES, size: 24, weight: "500", style: "normal", fill: "#2d1f0a" },
      body:    { family: FRAUNCES, size: 14, weight: "400", style: "italic", fill: "#5a3e1a" },
      caption: { family: INTER,   size: 10, weight: "400", style: "normal", fill: "#9a7a40" },
    },
    gutterColor: "rgba(100,70,20,0.15)",
    safeZoneColor: "rgba(100,70,20,0.18)",
    swatch: "#f5e6c4",
    swatchAccent: "#2d1f0a",
  },
  {
    // Sage — dusty botanical green, earthy sans typography, nature-inspired.
    // Trend 2024–25: top-trending aesthetic for outdoor/botanical/lifestyle photography.
    id: "sage",
    label: "Sage",
    description: "Dusty sage green paper, earthy tones, organic feel",
    background: "#e4ede0",
    defaultBorder: "none",
    whiteBorderColor: "#e4ede0",
    keylineColor: "#a8c4a0",
    fonts: {
      heading: { family: INTER,     size: 20, weight: "600", style: "normal", fill: "#1c2e1c" },
      body:    { family: INTER,     size: 13, weight: "400", style: "normal", fill: "#3a5238" },
      caption: { family: INTER,     size: 10, weight: "400", style: "italic", fill: "#6a8a68" },
    },
    gutterColor: "rgba(40,80,40,0.15)",
    safeZoneColor: "rgba(40,80,40,0.18)",
    swatch: "#e4ede0",
    swatchAccent: "#1c2e1c",
  },
  {
    // Haze — blush rose soft background, delicate Fraunces, dreamy.
    // Trend 2024–25: soft romantic pastels — newborn, engagement, boudoir.
    id: "haze",
    label: "Haze",
    description: "Blush rose paper, delicate serif, dreamy and soft",
    background: "#faeaeb",
    defaultBorder: "white",
    whiteBorderColor: "#faeaeb",
    keylineColor: "#e0b8bc",
    fonts: {
      heading: { family: FRAUNCES, size: 22, weight: "400", style: "italic", fill: "#3d1a1e" },
      body:    { family: INTER,    size: 13, weight: "300", style: "normal", fill: "#7a4a50" },
      caption: { family: INTER,    size: 10, weight: "400", style: "italic", fill: "#b08890" },
    },
    gutterColor: "rgba(120,60,70,0.12)",
    safeZoneColor: "rgba(120,60,70,0.15)",
    swatch: "#faeaeb",
    swatchAccent: "#3d1a1e",
  },
];

export function getTheme(id: ThemeId): ThemeTokens {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
