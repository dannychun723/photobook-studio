// Book-wide typography presets for AI Design.
// Each preset defines heading / body / caption font families and weights,
// plus text colors that work on both light paper and dark accent backgrounds.
// The AI picks ONE preset per book — applied consistently to every text block.

export interface FontSpec {
  family: string;   // CSS font-family stack (matches FONT_OPTIONS values)
  weight: string;   // CSS font-weight
  darkColor: string;  // text color on light / paper backgrounds
  lightColor: string; // text color on dark / colored backgrounds
}

export interface TypographyPreset {
  name: string;
  description: string;
  heading: FontSpec;
  body: FontSpec;
  caption: FontSpec;
}

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    name: "Classic Editorial",
    description: "Cormorant Garamond heading · EB Garamond body · Lato caption. Timeless elegance — weddings, portraits, heritage.",
    heading: { family: "'Cormorant Garamond', Georgia, serif", weight: "600", darkColor: "#1a1410", lightColor: "#f5ede0" },
    body:    { family: "'EB Garamond', Georgia, serif",         weight: "400", darkColor: "#3d3530", lightColor: "#d4c8b8" },
    caption: { family: "Lato, Arial, sans-serif",               weight: "400", darkColor: "#7a7068", lightColor: "#a09880" },
  },
  {
    name: "Modern Bold",
    description: "Montserrat heading · Open Sans body/caption. Confident, contemporary — events, editorial travel.",
    heading: { family: "Montserrat, Arial, sans-serif",         weight: "800", darkColor: "#111114", lightColor: "#f5f5f5" },
    body:    { family: "'Open Sans', Arial, sans-serif",        weight: "400", darkColor: "#444448", lightColor: "#cccccc" },
    caption: { family: "'Open Sans', Arial, sans-serif",        weight: "300", darkColor: "#888890", lightColor: "#aaaaaa" },
  },
  {
    name: "Editorial Contrast",
    description: "Playfair Display heading · DM Sans body/caption. Dramatic serif/sans contrast — editorial travel, wedding magazines.",
    heading: { family: "'Playfair Display', Georgia, serif",    weight: "700", darkColor: "#1c1610", lightColor: "#f8f0e3" },
    body:    { family: "'DM Sans', Arial, sans-serif",          weight: "400", darkColor: "#3a3830", lightColor: "#c8c0b0" },
    caption: { family: "'DM Sans', Arial, sans-serif",          weight: "400", darkColor: "#8a8880", lightColor: "#a8a898" },
  },
  {
    name: "Romantic Script",
    description: "Great Vibes heading · Cormorant body/caption. Flowing and intimate — weddings, newborns, romantic portraits.",
    heading: { family: "'Great Vibes', cursive",                weight: "400", darkColor: "#2c1a20", lightColor: "#f0e0e8" },
    body:    { family: "Cormorant, Georgia, serif",             weight: "400", darkColor: "#3c2a30", lightColor: "#d4c0c8" },
    caption: { family: "Cormorant, Georgia, serif",             weight: "400", darkColor: "#8a7880", lightColor: "#b8a8b0" },
  },
  {
    name: "Warm Humanist",
    description: "Lora heading · Source Sans 3 body/caption. Friendly warmth — family, newborn, warm-toned travel.",
    heading: { family: "Lora, Georgia, serif",                  weight: "600", darkColor: "#2a1e14", lightColor: "#f5ede0" },
    body:    { family: "'Source Sans 3', Arial, sans-serif",    weight: "400", darkColor: "#4a3c30", lightColor: "#d0c4b0" },
    caption: { family: "'Source Sans 3', Arial, sans-serif",    weight: "400", darkColor: "#8a7c68", lightColor: "#a89c88" },
  },
  {
    name: "Documentary",
    description: "Space Grotesk heading · Inter body/caption. Raw credibility — travel documentary, reportage, events.",
    heading: { family: "'Space Grotesk', Arial, sans-serif",    weight: "700", darkColor: "#0d0d0d", lightColor: "#f0f0f0" },
    body:    { family: "Inter, Arial, sans-serif",              weight: "400", darkColor: "#333333", lightColor: "#cccccc" },
    caption: { family: "Inter, Arial, sans-serif",              weight: "400", darkColor: "#777777", lightColor: "#999999" },
  },
  {
    name: "Heritage Serif",
    description: "EB Garamond heading · Crimson Text body · Lato caption. Old-world richness — classic weddings, family history.",
    heading: { family: "'EB Garamond', Georgia, serif",         weight: "700", darkColor: "#1e140a", lightColor: "#f0e8d8" },
    body:    { family: "'Crimson Text', Georgia, serif",        weight: "400", darkColor: "#362a1e", lightColor: "#ccc0a8" },
    caption: { family: "Lato, Arial, sans-serif",               weight: "300", darkColor: "#7a6e60", lightColor: "#a09888" },
  },
  {
    name: "Contemporary Fraunces",
    description: "Fraunces heading · DM Sans body/caption. Quirky optical warmth — artistic portraits, indie travel.",
    heading: { family: "Fraunces, Georgia, serif",              weight: "700", darkColor: "#1a1a1e", lightColor: "#f0f0f5" },
    body:    { family: "'DM Sans', Arial, sans-serif",          weight: "400", darkColor: "#3a3a40", lightColor: "#c0c0c8" },
    caption: { family: "'DM Sans', Arial, sans-serif",          weight: "300", darkColor: "#808088", lightColor: "#a8a8b0" },
  },
  {
    name: "Luxury Cinzel",
    description: "Cinzel heading · Cormorant Garamond body/caption. Classical Roman gravitas — luxury weddings, fine-art portraits.",
    heading: { family: "Cinzel, Georgia, serif",                weight: "600", darkColor: "#0d0a08", lightColor: "#f5f0e8" },
    body:    { family: "'Cormorant Garamond', Georgia, serif",  weight: "400", darkColor: "#2e2820", lightColor: "#d8d0c0" },
    caption: { family: "'Cormorant Garamond', Georgia, serif",  weight: "400", darkColor: "#7c7060", lightColor: "#b8b0a0" },
  },
  {
    name: "Minimal Clean",
    description: "Josefin Sans heading · Raleway body/caption. Understated gallery aesthetic — minimalist editorial, fine-art.",
    heading: { family: "'Josefin Sans', Arial, sans-serif",     weight: "600", darkColor: "#111111", lightColor: "#eeeeee" },
    body:    { family: "Raleway, Arial, sans-serif",            weight: "400", darkColor: "#444444", lightColor: "#cccccc" },
    caption: { family: "Raleway, Arial, sans-serif",            weight: "300", darkColor: "#888888", lightColor: "#aaaaaa" },
  },
];

export function lookupPreset(name: string): TypographyPreset | null {
  return TYPOGRAPHY_PRESETS.find((p) => p.name === name) ?? null;
}

/** Returns true when a CSS hex color (#rrggbb) has luminance below 0.35 — use light text on these. */
export function isColorDark(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.35;
}
