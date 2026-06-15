export interface FontOption {
  label: string;
  value: string; // CSS font-family stack
  category: "serif" | "sans" | "script" | "display" | "mono";
}

// All fonts sorted alphabetically.
// Web-safe fonts need no loading; Google Fonts are loaded via index.html.
export const FONT_OPTIONS: FontOption[] = [
  // ── A ──────────────────────────────────────────────────────────────────────
  { label: "Abril Fatface",      value: "'Abril Fatface', serif",                              category: "display" },
  { label: "Alegreya",           value: "Alegreya, Georgia, serif",                            category: "serif"   },
  { label: "Allura",             value: "Allura, cursive",                                     category: "script"  },
  { label: "Amatic SC",          value: "'Amatic SC', cursive",                                category: "display" },
  { label: "Anton",              value: "Anton, sans-serif",                                   category: "display" },
  { label: "Archivo",            value: "Archivo, Arial, sans-serif",                          category: "sans"    },
  { label: "Arial",              value: "Arial, Helvetica, sans-serif",                        category: "sans"    },

  // ── B ──────────────────────────────────────────────────────────────────────
  { label: "Bebas Neue",         value: "'Bebas Neue', sans-serif",                            category: "display" },
  { label: "Bitter",             value: "Bitter, Georgia, serif",                              category: "serif"   },
  { label: "Bodoni Moda",        value: "'Bodoni Moda', Georgia, serif",                       category: "serif"   },

  // ── C ──────────────────────────────────────────────────────────────────────
  { label: "Cabin",              value: "Cabin, Arial, sans-serif",                            category: "sans"    },
  { label: "Cardo",              value: "Cardo, Georgia, serif",                               category: "serif"   },
  { label: "Caveat",             value: "Caveat, cursive",                                     category: "script"  },
  { label: "Cinzel",             value: "Cinzel, Georgia, serif",                              category: "display" },
  { label: "Cinzel Decorative",  value: "'Cinzel Decorative', Georgia, serif",                 category: "display" },
  { label: "Cormorant",          value: "Cormorant, Georgia, serif",                           category: "serif"   },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', Georgia, serif",                category: "serif"   },
  { label: "Courier New",        value: "'Courier New', Courier, monospace",                   category: "mono"    },
  { label: "Courgette",          value: "Courgette, cursive",                                  category: "script"  },
  { label: "Crimson Pro",        value: "'Crimson Pro', Georgia, serif",                       category: "serif"   },
  { label: "Crimson Text",       value: "'Crimson Text', Georgia, serif",                      category: "serif"   },

  // ── D ──────────────────────────────────────────────────────────────────────
  { label: "Dancing Script",     value: "'Dancing Script', cursive",                           category: "script"  },
  { label: "DM Sans",            value: "'DM Sans', Arial, sans-serif",                        category: "sans"    },
  { label: "DM Serif Display",   value: "'DM Serif Display', Georgia, serif",                  category: "serif"   },
  { label: "Domine",             value: "Domine, Georgia, serif",                              category: "serif"   },

  // ── E ──────────────────────────────────────────────────────────────────────
  { label: "EB Garamond",        value: "'EB Garamond', Georgia, serif",                       category: "serif"   },

  // ── F ──────────────────────────────────────────────────────────────────────
  { label: "Fira Sans",          value: "'Fira Sans', Arial, sans-serif",                      category: "sans"    },
  { label: "Fjalla One",         value: "'Fjalla One', sans-serif",                            category: "display" },
  { label: "Forum",              value: "Forum, Georgia, serif",                               category: "serif"   },
  { label: "Fraunces",           value: "Fraunces, Georgia, serif",                            category: "serif"   },

  // ── G ──────────────────────────────────────────────────────────────────────
  { label: "Georgia",            value: "Georgia, serif",                                      category: "serif"   },
  { label: "Gilda Display",      value: "'Gilda Display', Georgia, serif",                     category: "serif"   },
  { label: "Great Vibes",        value: "'Great Vibes', cursive",                              category: "script"  },

  // ── I ──────────────────────────────────────────────────────────────────────
  { label: "Ibarra Real Nova",   value: "'Ibarra Real Nova', Georgia, serif",                  category: "serif"   },
  { label: "Inter",              value: "Inter, Arial, sans-serif",                            category: "sans"    },
  { label: "Italiana",           value: "Italiana, Georgia, serif",                            category: "serif"   },

  // ── J ──────────────────────────────────────────────────────────────────────
  { label: "Josefin Sans",       value: "'Josefin Sans', Arial, sans-serif",                   category: "sans"    },
  { label: "Josefin Slab",       value: "'Josefin Slab', Georgia, serif",                      category: "serif"   },
  { label: "Jost",               value: "Jost, Arial, sans-serif",                             category: "sans"    },

  // ── K ──────────────────────────────────────────────────────────────────────
  { label: "Karla",              value: "Karla, Arial, sans-serif",                            category: "sans"    },
  { label: "Kaushan Script",     value: "'Kaushan Script', cursive",                           category: "script"  },

  // ── L ──────────────────────────────────────────────────────────────────────
  { label: "Lato",               value: "Lato, Arial, sans-serif",                             category: "sans"    },
  { label: "Libre Baskerville",  value: "'Libre Baskerville', Georgia, serif",                 category: "serif"   },
  { label: "Libre Bodoni",       value: "'Libre Bodoni', Georgia, serif",                      category: "serif"   },
  { label: "Libre Franklin",     value: "'Libre Franklin', Arial, sans-serif",                 category: "sans"    },
  { label: "Lobster",            value: "Lobster, cursive",                                    category: "script"  },
  { label: "Lora",               value: "Lora, Georgia, serif",                                category: "serif"   },

  // ── M ──────────────────────────────────────────────────────────────────────
  { label: "Marcellus",          value: "Marcellus, Georgia, serif",                           category: "serif"   },
  { label: "Martel",             value: "Martel, Georgia, serif",                              category: "serif"   },
  { label: "Merriweather",       value: "Merriweather, Georgia, serif",                        category: "serif"   },
  { label: "Montserrat",         value: "Montserrat, Arial, sans-serif",                       category: "sans"    },
  { label: "Mulish",             value: "Mulish, Arial, sans-serif",                           category: "sans"    },

  // ── N ──────────────────────────────────────────────────────────────────────
  { label: "Neuton",             value: "Neuton, Georgia, serif",                              category: "serif"   },
  { label: "Noto Sans",          value: "'Noto Sans', Arial, sans-serif",                      category: "sans"    },
  { label: "Noto Serif",         value: "'Noto Serif', Georgia, serif",                        category: "serif"   },
  { label: "Nunito",             value: "Nunito, Arial, sans-serif",                           category: "sans"    },
  { label: "Nunito Sans",        value: "'Nunito Sans', Arial, sans-serif",                    category: "sans"    },

  // ── O ──────────────────────────────────────────────────────────────────────
  { label: "Old Standard TT",    value: "'Old Standard TT', Georgia, serif",                   category: "serif"   },
  { label: "Open Sans",          value: "'Open Sans', Arial, sans-serif",                      category: "sans"    },
  { label: "Oswald",             value: "Oswald, Arial, sans-serif",                           category: "display" },
  { label: "Outfit",             value: "Outfit, Arial, sans-serif",                           category: "sans"    },

  // ── P ──────────────────────────────────────────────────────────────────────
  { label: "Pacifico",           value: "Pacifico, cursive",                                   category: "script"  },
  { label: "Philosopher",        value: "Philosopher, Georgia, serif",                         category: "serif"   },
  { label: "Pinyon Script",      value: "'Pinyon Script', cursive",                            category: "script"  },
  { label: "Playfair Display",   value: "'Playfair Display', Georgia, serif",                  category: "serif"   },
  { label: "Plus Jakarta Sans",  value: "'Plus Jakarta Sans', Arial, sans-serif",              category: "sans"    },
  { label: "Poiret One",         value: "'Poiret One', sans-serif",                            category: "display" },
  { label: "Poppins",            value: "Poppins, Arial, sans-serif",                          category: "sans"    },
  { label: "PT Sans",            value: "'PT Sans', Arial, sans-serif",                        category: "sans"    },
  { label: "PT Serif",           value: "'PT Serif', Georgia, serif",                          category: "serif"   },

  // ── Q ──────────────────────────────────────────────────────────────────────
  { label: "Quicksand",          value: "Quicksand, Arial, sans-serif",                        category: "sans"    },

  // ── R ──────────────────────────────────────────────────────────────────────
  { label: "Raleway",            value: "Raleway, Arial, sans-serif",                          category: "sans"    },
  { label: "Righteous",          value: "Righteous, sans-serif",                               category: "display" },
  { label: "Roboto",             value: "Roboto, Arial, sans-serif",                           category: "sans"    },
  { label: "Roboto Condensed",   value: "'Roboto Condensed', Arial, sans-serif",               category: "sans"    },
  { label: "Roboto Mono",        value: "'Roboto Mono', monospace",                            category: "mono"    },
  { label: "Roboto Slab",        value: "'Roboto Slab', Georgia, serif",                       category: "serif"   },
  { label: "Rokkitt",            value: "Rokkitt, Georgia, serif",                             category: "serif"   },
  { label: "Rufina",             value: "Rufina, Georgia, serif",                              category: "serif"   },

  // ── S ──────────────────────────────────────────────────────────────────────
  { label: "Sacramento",         value: "Sacramento, cursive",                                 category: "script"  },
  { label: "Sanchez",            value: "Sanchez, Georgia, serif",                             category: "serif"   },
  { label: "Satisfy",            value: "Satisfy, cursive",                                    category: "script"  },
  { label: "Sorts Mill Goudy",   value: "'Sorts Mill Goudy', Georgia, serif",                  category: "serif"   },
  { label: "Source Sans 3",      value: "'Source Sans 3', Arial, sans-serif",                  category: "sans"    },
  { label: "Source Serif 4",     value: "'Source Serif 4', Georgia, serif",                    category: "serif"   },
  { label: "Space Grotesk",      value: "'Space Grotesk', Arial, sans-serif",                  category: "sans"    },
  { label: "Spectral",           value: "Spectral, Georgia, serif",                            category: "serif"   },

  // ── T ──────────────────────────────────────────────────────────────────────
  { label: "Tangerine",          value: "Tangerine, cursive",                                  category: "script"  },
  { label: "Times New Roman",    value: "'Times New Roman', Times, serif",                     category: "serif"   },
  { label: "Trebuchet MS",       value: "'Trebuchet MS', Helvetica, sans-serif",               category: "sans"    },
  { label: "Trocchi",            value: "Trocchi, Georgia, serif",                             category: "serif"   },

  // ── U ──────────────────────────────────────────────────────────────────────
  { label: "Ubuntu",             value: "Ubuntu, Arial, sans-serif",                           category: "sans"    },

  // ── V ──────────────────────────────────────────────────────────────────────
  { label: "Verdana",            value: "Verdana, Geneva, sans-serif",                         category: "sans"    },
  { label: "Volkhov",            value: "Volkhov, Georgia, serif",                             category: "serif"   },

  // ── W ──────────────────────────────────────────────────────────────────────
  { label: "Work Sans",          value: "'Work Sans', Arial, sans-serif",                      category: "sans"    },

  // ── Y ──────────────────────────────────────────────────────────────────────
  { label: "Yanone Kaffeesatz",  value: "'Yanone Kaffeesatz', Arial, sans-serif",              category: "display" },
  { label: "Yellowtail",         value: "Yellowtail, cursive",                                 category: "script"  },
  { label: "Yeseva One",         value: "'Yeseva One', Georgia, serif",                        category: "display" },
];

/** Extract the first font name from a CSS font-family stack for display. */
export function fontDisplayLabel(fontFamily: string | undefined): string {
  if (!fontFamily) return "Default";
  const first = fontFamily.split(",")[0].replace(/['"]/g, "").trim();
  const match = FONT_OPTIONS.find(
    (f) => f.value.split(",")[0].replace(/['"]/g, "").trim().toLowerCase() === first.toLowerCase(),
  );
  return match?.label ?? first;
}
