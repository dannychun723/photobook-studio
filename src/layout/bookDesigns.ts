// Book design presets — curated template sequences for entire-book layout application.
// Inspired by Artifact Uprising editorial pacing and Canva popular photobook styles.
// Each sequence loops when the book has more spreads than template entries. (R-L6, R-S4, R-S5)

export interface BookDesignPreset {
  id: string;
  name: string;
  description: string;
  category: "editorial" | "classic" | "modern" | "documentary" | "portrait" | "wedding" | "travel" | "family" | "portfolio" | "seasonal" | "pet";
  /** Template IDs to apply in order; loops when spreads > sequence.length */
  sequence: string[];
}

export const BOOK_DESIGNS: BookDesignPreset[] = [
  {
    id: "editorial-flow",
    name: "Editorial Flow",
    description: "Magazine pacing — full bleeds, asymmetric clusters, and breather pages",
    category: "editorial",
    sequence: [
      "full-bleed-spread",
      "hero-left-details",
      "breather-right",
      "asymmetric-wide-narrow",
      "portrait-hero-left-stack-right",
      "triptych",
      "breather-left",
      "hero-top-trio",
      "two-up",
      "full-bleed-pages",
    ],
  },
  {
    id: "classic-album",
    name: "Classic Album",
    description: "Timeless matted layouts with generous white space and clean grids",
    category: "classic",
    sequence: [
      "two-up",
      "two-portrait-matted",
      "grid-2x2",
      "breather-right",
      "two-stack-per-page",
      "two-up",
      "portrait-landscape",
      "grid-2x2",
      "centered-feature",
      "photo-right-caption-left",
    ],
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Clean asymmetric layouts with lots of white space",
    category: "modern",
    sequence: [
      "full-bleed-spread",
      "breather-right",
      "single-page-center",
      "corner-accent",
      "two-stack-left-hero-right",
      "hero-left-two-stack-right",
      "centered-feature",
      "two-portrait-matted",
      "breather-left",
      "full-bleed-pages",
    ],
  },
  {
    id: "documentary",
    name: "Documentary",
    description: "Story-driven layouts mixing candid grids, strips, and editorial heroes",
    category: "documentary",
    sequence: [
      "full-bleed-spread",
      "filmstrip",
      "hero-right-details",
      "grid-2x3",
      "photos-caption-strip",
      "blank-left-grid-right",
      "pano-strip",
      "hero-top-trio",
      "grid-4x2",
      "text-left-photo-right",
    ],
  },
  {
    id: "portrait-story",
    name: "Portrait Story",
    description: "Portrait-focused layouts ideal for people photography and wedding books",
    category: "portrait",
    sequence: [
      "full-bleed-pages",
      "two-portrait-matted",
      "two-stack-left-hero-right",
      "hero-plus-three-right",
      "three-col-per-page",
      "breather-right",
      "portrait-hero-left-stack-right",
      "stack-left-portrait-hero-right",
      "two-row-per-page",
      "corner-accent",
    ],
  },

  // ── Artifact Uprising occasion-based designs ──────────────────────────────
  // Names and layout ideas from artifactuprising.com/diy/photo-book-layout-ideas

  {
    id: "wedding-album",
    name: "Wedding Album",
    description: "Ceremony-to-reception narrative — First Look duos, vows text page, ceremony triptych, and a dance-floor energy grid",
    category: "wedding",
    sequence: [
      "full-bleed-spread",          // arrival / opening hero
      "two-portrait-matted",        // First Look: duo portrait build-up moments
      "hero-left-details",          // getting-ready: hero + detail cluster
      "text-left-photo-right",      // Vows: text/screenshot + photo
      "portrait-landscape",         // Ceremony: procession, kiss, recessional mix
      "full-bleed-pages",           // ceremony hero (first kiss)
      "two-up",                     // Group Portraits: duo landscape, wide-angle
      "grid-2x3",                   // Dance Floor: 6-up action spread
      "breather-right",             // quiet romantic portrait
      "full-bleed-spread",          // exit/closing hero
    ],
  },
  {
    id: "travel-photo-book",
    name: "Travel Photo Book",
    description: "Journey narrative mixing scenic panoramas, four-square food spreads, captioned stories, and candid strips",
    category: "travel",
    sequence: [
      "full-bleed-spread",          // destination opening hero
      "text-left-photo-right",      // Telling a Travel Story: narrative + image
      "panoramic-spread",           // wide panoramic landscape
      "hero-top-trio",              // scene setter + local details
      "grid-2x2",                   // Food Spreads: four-square grouping
      "pano-strip",                 // Panorama: duo-portrait cross-spread effect
      "filmstrip",                  // street / candid moments strip
      "two-up",                     // paired scenery
      "photos-caption-strip",       // captioned travel memories
      "full-bleed-pages",           // closing destination
    ],
  },
  {
    id: "family-album",
    name: "Family Album",
    description: "Milestone portraits, growing-over-time sequences, candid grids, and phone-selfie strips across seasons",
    category: "family",
    sequence: [
      "full-bleed-pages",           // Family Portrait: full-bleed group photo
      "two-portrait-matted",        // Growing Over Time: portrait progression
      "hero-left-two-stack-right",  // milestone moment + family details
      "square-strip",               // Phone Selfies: small-square lower-res shots
      "grid-2x2",                   // candid moments four-square
      "two-up",                     // seasonal pair
      "photos-caption-strip",       // captioned memories
      "mosaic-five",                // candid family cluster
      "breather-left",              // quiet family moment
      "full-bleed-spread",          // year-closing hero
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Showcase creative work with centered features, caption pages, full-bleed heroes, and a text bio spread",
    category: "portfolio",
    sequence: [
      "centered-feature",           // Photography Lookbook: center square with breathing room
      "full-bleed-pages",           // full-bleed featured work
      "photo-right-caption-left",   // Bio Section: large portrait + caption
      "grid-2x2",                   // Design Portfolio: four-square varying angles
      "single-page-center",         // spotlight single piece
      "text-left-photo-right",      // Writing & Poetry: text + image
      "two-up",                     // paired works
      "photos-caption-strip",       // series with technical notes
      "breather-right",             // breathing room
      "full-bleed-spread",          // closing showcase
    ],
  },
  {
    id: "year-in-review",
    name: "Year in Review",
    description: "Seasonal duo squares, a 10-photo candid strip, recurring pattern grids, and captioned personal memories",
    category: "seasonal",
    sequence: [
      "full-bleed-spread",          // year-opening hero
      "two-up",                     // Seasons: duo square seasonal progression
      "grid-4x2",                   // Candids: dense 10-photo-style strip
      "hero-left-details",          // highlight of the year
      "two-portrait-matted",        // season portrait pair
      "photos-caption-strip",       // Handwritten Captions: personalized memories
      "grid-2x2",                   // Patterns: four-square recurring activities
      "triptych",                   // three-moment visual
      "corner-accent",              // detail accent with space
      "full-bleed-pages",           // year-closing hero
    ],
  },
  {
    id: "pet-photo-album",
    name: "Pet Photo Album",
    description: "Playful four-square outtakes, expressive portrait spotlight, duo-landscape field trips, and candid strips",
    category: "pet",
    sequence: [
      "full-bleed-pages",           // favorite pet portrait hero
      "grid-2x2",                   // Outtakes: full-bleed four square
      "centered-feature",           // Pet's Expression: centered portrait spotlight
      "two-up",                     // Field Trip: duo landscape with setting
      "hero-top-trio",              // action moment + detail shots
      "portrait-landscape",         // mixed-orientation pair
      "filmstrip",                  // candid expression strip
      "breather-right",             // quiet expressive portrait
      "single-page-center",         // best expression close-up
      "full-bleed-spread",          // adventure-closing hero
    ],
  },
];
