export interface TextStylePreset {
  id: string;
  label: string;
  tagline: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic" | "bold";
}

const CORMORANT = "Cormorant Garamond, Fraunces, ui-serif, Georgia, serif";
const PLAYFAIR = "Playfair Display, Fraunces, ui-serif, Georgia, serif";
const DM_SERIF = "DM Serif Display, Fraunces, ui-serif, Georgia, serif";
const SPACE_GROTESK = "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif";
const INTER = "Inter, ui-sans-serif, system-ui, sans-serif";

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    tagline: "Playfair italic — dramatic & filmic",
    fontFamily: PLAYFAIR,
    fontSize: 22,
    fontWeight: "700",
    fontStyle: "italic",
  },
  {
    id: "editorial",
    label: "Editorial",
    tagline: "Space Grotesk — clean magazine grid",
    fontFamily: SPACE_GROTESK,
    fontSize: 16,
    fontWeight: "600",
    fontStyle: "normal",
  },
  {
    id: "romantic",
    label: "Romantic",
    tagline: "Cormorant italic — lyrical luxury",
    fontFamily: CORMORANT,
    fontSize: 20,
    fontWeight: "500",
    fontStyle: "italic",
  },
  {
    id: "luxe",
    label: "Luxe",
    tagline: "DM Serif — high-end studio serif",
    fontFamily: DM_SERIF,
    fontSize: 18,
    fontWeight: "400",
    fontStyle: "normal",
  },
  {
    id: "bold",
    label: "Bold",
    tagline: "Space Grotesk heavy — strong contrast",
    fontFamily: SPACE_GROTESK,
    fontSize: 28,
    fontWeight: "700",
    fontStyle: "normal",
  },
  {
    id: "minimal",
    label: "Minimal",
    tagline: "Inter light — pure reduction",
    fontFamily: INTER,
    fontSize: 11,
    fontWeight: "400",
    fontStyle: "normal",
  },
];
