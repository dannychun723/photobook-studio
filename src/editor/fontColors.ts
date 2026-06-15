export interface FontColor {
  name: string;
  value: string;
}

// Organized by hue family — 80 curated colors covering all common use cases.
export const FONT_COLOR_GROUPS: { label: string; colors: FontColor[] }[] = [
  {
    label: "Black & White",
    colors: [
      { name: "Black",     value: "#000000" },
      { name: "Jet",       value: "#1a1a1a" },
      { name: "Charcoal",  value: "#36393f" },
      { name: "Graphite",  value: "#555555" },
      { name: "Slate",     value: "#708090" },
      { name: "Silver",    value: "#a0a0a0" },
      { name: "Ash",       value: "#c0c0c0" },
      { name: "Smoke",     value: "#d8d8d8" },
      { name: "Chalk",     value: "#f0f0f0" },
      { name: "White",     value: "#ffffff" },
    ],
  },
  {
    label: "Warm Neutrals",
    colors: [
      { name: "Espresso",  value: "#4a2c1a" },
      { name: "Chocolate", value: "#7b3f00" },
      { name: "Walnut",    value: "#5c3317" },
      { name: "Caramel",   value: "#c68642" },
      { name: "Sand",      value: "#c2b280" },
      { name: "Taupe",     value: "#8b8682" },
      { name: "Stone",     value: "#a29b8f" },
      { name: "Linen",     value: "#f0e6d3" },
      { name: "Ivory",     value: "#f9f6ef" },
      { name: "Cream",     value: "#fffacd" },
    ],
  },
  {
    label: "Reds",
    colors: [
      { name: "Maroon",    value: "#800000" },
      { name: "Bordeaux",  value: "#7b0e10" },
      { name: "Ruby",      value: "#9b111e" },
      { name: "Crimson",   value: "#dc143c" },
      { name: "Brick",     value: "#b5451b" },
      { name: "Scarlet",   value: "#ff2400" },
      { name: "Tomato",    value: "#ff6347" },
      { name: "Salmon",    value: "#fa8072" },
      { name: "Blush",     value: "#de5d83" },
      { name: "Misty Rose",value: "#ffb6ba" },
    ],
  },
  {
    label: "Pinks",
    colors: [
      { name: "Flamingo",  value: "#fc8eac" },
      { name: "Hot Pink",  value: "#ff69b4" },
      { name: "Deep Pink", value: "#ff1493" },
      { name: "Rose",      value: "#ff007f" },
      { name: "Petal",     value: "#f9c0be" },
      { name: "Rose Gold", value: "#b76e79" },
      { name: "Dusty Rose",value: "#c4706c" },
      { name: "Mauve",     value: "#915f6d" },
      { name: "Bubblegum", value: "#ffc1cc" },
      { name: "Lavender Blush", value: "#fff0f5" },
    ],
  },
  {
    label: "Oranges & Yellows",
    colors: [
      { name: "Rust",        value: "#b7410e" },
      { name: "Terracotta",  value: "#c66a41" },
      { name: "Sienna",      value: "#a0522d" },
      { name: "Coral",       value: "#ff6b6b" },
      { name: "Tangerine",   value: "#f28500" },
      { name: "Amber",       value: "#ffbf00" },
      { name: "Gold",        value: "#ffd700" },
      { name: "Honey",       value: "#c9a36a" },
      { name: "Mustard",     value: "#e3a857" },
      { name: "Saffron",     value: "#f4c430" },
    ],
  },
  {
    label: "Greens",
    colors: [
      { name: "Hunter",      value: "#355e3b" },
      { name: "Forest",      value: "#228b22" },
      { name: "Emerald",     value: "#50c878" },
      { name: "Jade",        value: "#00a86b" },
      { name: "Sage",        value: "#77815c" },
      { name: "Olive",       value: "#808000" },
      { name: "Fern",        value: "#4f7942" },
      { name: "Moss",        value: "#8a9a5b" },
      { name: "Mint",        value: "#98ff98" },
      { name: "Sea Green",   value: "#2e8b57" },
    ],
  },
  {
    label: "Blues",
    colors: [
      { name: "Midnight",    value: "#191970" },
      { name: "Navy",        value: "#001f5b" },
      { name: "Cobalt",      value: "#0047ab" },
      { name: "Denim",       value: "#1560bd" },
      { name: "Royal Blue",  value: "#4169e1" },
      { name: "Cornflower",  value: "#6495ed" },
      { name: "Sky Blue",    value: "#87ceeb" },
      { name: "Ice Blue",    value: "#99c5c4" },
      { name: "Teal",        value: "#008080" },
      { name: "Cyan",        value: "#00bcd4" },
    ],
  },
  {
    label: "Purples",
    colors: [
      { name: "Plum",        value: "#5e2d79" },
      { name: "Purple",      value: "#800080" },
      { name: "Violet",      value: "#8000ff" },
      { name: "Amethyst",    value: "#9b59b6" },
      { name: "Lavender",    value: "#967bb6" },
      { name: "Lilac",       value: "#c8a2c8" },
      { name: "Orchid",      value: "#da70d6" },
      { name: "Periwinkle",  value: "#ccccff" },
      { name: "Wisteria",    value: "#c9a0dc" },
      { name: "Mulberry",    value: "#c54b8c" },
    ],
  },
];

// Flat list for quick lookup
export const ALL_FONT_COLORS: FontColor[] = FONT_COLOR_GROUPS.flatMap((g) => g.colors);
