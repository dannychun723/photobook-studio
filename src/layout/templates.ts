import type { BookSize, TextRole } from "../model/types";

// Layout template catalogue. Each template implements one row of the
// "Template catalogue → research mapping" table in docs/design-research.md;
// the `cites` field is the source of truth for that link. All geometry in mm,
// spread coordinates (W = 2 × page width).

export interface TemplateContext {
  pageW: number;
  pageH: number;
  /** outer margin for matted layouts; gallery convention 12–25mm (R-L2, R-W2) */
  margin: number;
  /** spacing between grid/cluster cells (R-L4) */
  gap: number;
}

export interface FrameSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  role?: "hero" | "detail";
}

export interface TextSpec {
  role: TextRole;
  x: number;
  y: number;
  width: number;
  align: "left" | "center" | "right";
  placeholder: string;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  category: "hero" | "gallery" | "grid" | "collage" | "panorama" | "mixed" | "text";
  cites: string[];
  /** photo slots this template is designed around */
  slots: number;
  /** true when a frame intentionally crosses the spread center — needs the
      layflat/standard gutter warning on standard binding (R-W5, R-L7) */
  crossesGutter?: boolean;
  frames: (ctx: TemplateContext) => FrameSpec[];
  texts?: (ctx: TemplateContext) => TextSpec[];
}

export const DEFAULT_TEMPLATE_CTX = { margin: 15, gap: 5 };

export function templateCtx(size: BookSize): TemplateContext {
  return { pageW: size.pageWidthMm, pageH: size.pageHeightMm, ...DEFAULT_TEMPLATE_CTX };
}

function grid(
  x0: number,
  y0: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  gap: number,
  role?: "hero" | "detail",
): FrameSpec[] {
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  const frames: FrameSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({ x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), width: cw, height: ch, role });
    }
  }
  return frames;
}

export const TEMPLATES: LayoutTemplate[] = [
  {
    id: "full-bleed-spread",
    name: "Full-Bleed Spread",
    category: "hero",
    cites: ["R-L1", "R-W3", "R-P1", "R-L7"],
    slots: 1,
    crossesGutter: true,
    frames: ({ pageW, pageH }) => [{ x: 0, y: 0, width: pageW * 2, height: pageH, role: "hero" }],
  },
  {
    id: "full-bleed-pages",
    name: "Two Full-Bleed Pages",
    category: "hero",
    cites: ["R-L1", "R-W3", "R-P1"],
    slots: 2,
    frames: ({ pageW, pageH }) => [
      { x: 0, y: 0, width: pageW, height: pageH, role: "hero" },
      { x: pageW, y: 0, width: pageW, height: pageH, role: "hero" },
    ],
  },
  {
    id: "two-up",
    name: "Two-Up Gallery",
    category: "gallery",
    cites: ["R-L3", "R-L2", "R-W2"],
    slots: 2,
    frames: ({ pageW, pageH, margin }) => [
      { x: margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin },
      { x: pageW + margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin },
    ],
  },
  {
    id: "breather-right",
    name: "Breather — Single Right",
    category: "gallery",
    cites: ["R-L2", "R-W1", "R-S5"],
    slots: 1,
    // extra-generous mat: this page is the visual palate cleanser (R-S5)
    frames: ({ pageW, pageH, margin }) => {
      const m = margin * 1.6;
      return [{ x: pageW + m, y: m, width: pageW - 2 * m, height: pageH - 2 * m }];
    },
  },
  {
    id: "hero-left-details",
    name: "Hero Left + Detail Cluster",
    category: "collage",
    cites: ["R-L6", "R-S4", "R-L4", "R-TH5"],
    slots: 5,
    frames: ({ pageW, pageH, margin, gap }) => [
      { x: 0, y: 0, width: pageW, height: pageH, role: "hero" },
      ...grid(pageW + margin, margin, pageW - 2 * margin, pageH - 2 * margin, 2, 2, gap, "detail"),
    ],
  },
  {
    id: "hero-right-details",
    name: "Detail Cluster + Hero Right",
    category: "collage",
    cites: ["R-L6", "R-S4", "R-L4", "R-TH5"],
    slots: 5,
    frames: ({ pageW, pageH, margin, gap }) => [
      ...grid(margin, margin, pageW - 2 * margin, pageH - 2 * margin, 2, 2, gap, "detail"),
      { x: pageW, y: 0, width: pageW, height: pageH, role: "hero" },
    ],
  },
  {
    id: "grid-2x2",
    name: "2×2 Grid",
    category: "grid",
    cites: ["R-L4", "R-S4"],
    slots: 4,
    frames: ({ pageW, pageH, margin, gap }) => {
      // columns sit either side of the gutter; the gap keeps cell edges off it
      const cw = pageW - margin - gap / 2;
      const ch = (pageH - 2 * margin - gap) / 2;
      return [0, 1].flatMap((r) =>
        [margin, pageW + gap / 2].map((x) => ({
          x,
          y: margin + r * (ch + gap),
          width: cw,
          height: ch,
          role: "detail" as const,
        })),
      );
    },
  },
  {
    id: "grid-3x3",
    name: "3×3 Candid Grid",
    category: "grid",
    cites: ["R-L5", "R-S5"],
    slots: 9,
    crossesGutter: true, // middle column straddles the fold — layflat-friendly
    frames: ({ pageW, pageH, margin, gap }) =>
      grid(margin, margin, pageW * 2 - 2 * margin, pageH - 2 * margin, 3, 3, gap, "detail"),
  },
  {
    id: "panoramic-spread",
    name: "Panoramic Spread",
    category: "panorama",
    cites: ["R-L7", "R-W5"],
    slots: 1,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin }) => {
      const w = pageW * 2 - 2 * margin;
      const h = Math.min(pageH - 2 * margin, w / 3); // ~3:1 cinematic band
      return [{ x: margin, y: (pageH - h) / 2, width: w, height: h, role: "hero" }];
    },
  },
  {
    id: "pano-strip",
    name: "Panorama Strip (3 Portraits)",
    category: "panorama",
    cites: ["R-L7", "R-O5"],
    slots: 3,
    crossesGutter: true, // middle portrait sits on the fold (R-W5)
    frames: ({ pageW, pageH, margin, gap }) => {
      const w = (pageW * 2 - 2 * margin - 2 * gap) / 3;
      const h = Math.min(pageH - 2 * margin, (w * 4) / 3);
      const y = (pageH - h) / 2;
      return [0, 1, 2].map((i) => ({ x: margin + i * (w + gap), y, width: w, height: h }));
    },
  },
  {
    id: "portrait-landscape",
    name: "Portrait + Landscape",
    category: "mixed",
    cites: ["R-O1", "R-O2"],
    slots: 2,
    frames: ({ pageW, pageH, margin }) => {
      const lw = pageW - 2 * margin;
      const lh = (lw * 2) / 3; // 3:2 landscape, bottom-aligned; caption fills the gap above (R-O2)
      const ph = pageH - 2 * margin;
      const pw = Math.min(pageW - 2 * margin, ph * 0.75); // 3:4 portrait
      return [
        { x: margin, y: pageH - margin - lh, width: lw, height: lh },
        { x: pageW + (pageW - pw) / 2, y: margin, width: pw, height: ph },
      ];
    },
    texts: ({ pageW, pageH, margin }) => [
      {
        role: "caption",
        x: margin,
        y: margin + (pageH - 2 * margin - ((pageW - 2 * margin) * 2) / 3) / 2 - 8,
        width: pageW - 2 * margin,
        align: "left",
        placeholder: "Add a caption…",
      },
    ],
  },
  {
    id: "square-strip",
    name: "Square Strip",
    category: "mixed",
    cites: ["R-O4"],
    slots: 3,
    crossesGutter: true, // middle square sits on the fold (R-W5)
    frames: ({ pageW, pageH, margin, gap }) => {
      const s = Math.min((pageW * 2 - 2 * margin - 2 * gap) / 3, pageH - 2 * margin);
      const totalW = 3 * s + 2 * gap;
      const x0 = (pageW * 2 - totalW) / 2;
      const y = (pageH - s) / 2;
      return [0, 1, 2].map((i) => ({ x: x0 + i * (s + gap), y, width: s, height: s }));
    },
  },
  {
    id: "text-left-photo-right",
    name: "Text Page + Photo",
    category: "text",
    cites: ["R-T6", "R-L2"],
    slots: 1,
    frames: ({ pageW, pageH, margin }) => [
      { x: pageW + margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin },
    ],
    texts: ({ pageW, pageH, margin }) => [
      {
        role: "heading",
        x: margin * 1.5,
        y: pageH * 0.32,
        width: pageW - 3 * margin,
        align: "left",
        placeholder: "Chapter title",
      },
      {
        role: "body",
        x: margin * 1.5,
        y: pageH * 0.45,
        width: pageW - 3 * margin,
        align: "left",
        placeholder: "Tell the story of this moment…",
      },
    ],
  },

  // ── Pinterest-inspired additions ───────────────────────────────────────────

  {
    // One full-bleed left page, matted photo on right — editorial contrast (R-L1, R-L2)
    id: "full-left-matted-right",
    name: "Full Bleed Left + Matted Right",
    category: "mixed",
    cites: ["R-L1", "R-L2", "R-W2"],
    slots: 2,
    frames: ({ pageW, pageH, margin }) => [
      { x: 0, y: 0, width: pageW, height: pageH, role: "hero" },
      { x: pageW + margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin },
    ],
  },

  {
    // Matted left, full bleed right — mirrored editorial (R-L1, R-L2)
    id: "matted-left-full-right",
    name: "Matted Left + Full Bleed Right",
    category: "mixed",
    cites: ["R-L1", "R-L2", "R-W2"],
    slots: 2,
    frames: ({ pageW, pageH, margin }) => [
      { x: margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin },
      { x: pageW, y: 0, width: pageW, height: pageH, role: "hero" },
    ],
  },

  {
    // Large hero top half of spread + 3 equal detail shots below (R-L6, R-S4)
    id: "hero-top-trio",
    name: "Hero Top + Three Below",
    category: "collage",
    cites: ["R-L6", "R-S4", "R-L4"],
    slots: 4,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) => {
      const heroH = (pageH - 2 * margin) * 0.58;
      const stripH = pageH - 2 * margin - heroH - gap;
      const stripW = (pageW * 2 - 2 * margin - 2 * gap) / 3;
      return [
        { x: margin, y: margin, width: pageW * 2 - 2 * margin, height: heroH, role: "hero" },
        ...([0, 1, 2] as const).map((i) => ({
          x: margin + i * (stripW + gap),
          y: margin + heroH + gap,
          width: stripW,
          height: stripH,
          role: "detail" as const,
        })),
      ];
    },
  },

  {
    // 3 equal tall portrait columns full-bleed across spread — triptych (R-L7, R-O1)
    id: "triptych",
    name: "Triptych",
    category: "panorama",
    cites: ["R-L7", "R-O1"],
    slots: 3,
    crossesGutter: true,
    frames: ({ pageW, pageH, gap }) => {
      const w = (pageW * 2 - 2 * gap) / 3;
      return [0, 1, 2].map((i) => ({
        x: i * (w + gap),
        y: 0,
        width: w,
        height: pageH,
        role: "hero" as const,
      }));
    },
  },

  {
    // Tall portrait hero left + 3 stacked details right (R-L6, R-O1, R-S4)
    id: "portrait-hero-left-stack-right",
    name: "Portrait Hero + 3 Stack",
    category: "collage",
    cites: ["R-L6", "R-O1", "R-S4"],
    slots: 4,
    frames: ({ pageW, pageH, margin, gap }) => {
      const heroW = pageW - 2 * margin;
      const stackW = pageW - 2 * margin;
      const cellH = (pageH - 2 * margin - 2 * gap) / 3;
      return [
        { x: margin, y: margin, width: heroW, height: pageH - 2 * margin, role: "hero" },
        { x: pageW + margin, y: margin, width: stackW, height: cellH, role: "detail" },
        { x: pageW + margin, y: margin + cellH + gap, width: stackW, height: cellH, role: "detail" },
        { x: pageW + margin, y: margin + 2 * (cellH + gap), width: stackW, height: cellH, role: "detail" },
      ];
    },
  },

  {
    // Mirrored: 3 stacked details left + tall portrait hero right (R-L6, R-O1, R-S4)
    id: "stack-left-portrait-hero-right",
    name: "3 Stack + Portrait Hero",
    category: "collage",
    cites: ["R-L6", "R-O1", "R-S4"],
    slots: 4,
    frames: ({ pageW, pageH, margin, gap }) => {
      const stackW = pageW - 2 * margin;
      const heroW = pageW - 2 * margin;
      const cellH = (pageH - 2 * margin - 2 * gap) / 3;
      return [
        { x: margin, y: margin, width: stackW, height: cellH, role: "detail" },
        { x: margin, y: margin + cellH + gap, width: stackW, height: cellH, role: "detail" },
        { x: margin, y: margin + 2 * (cellH + gap), width: stackW, height: cellH, role: "detail" },
        { x: pageW + margin, y: margin, width: heroW, height: pageH - 2 * margin, role: "hero" },
      ];
    },
  },

  {
    // 2×3 grid of equal cells across the full spread — high-volume album pages (R-L4, R-L5)
    id: "grid-2x3",
    name: "2×3 Grid",
    category: "grid",
    cites: ["R-L4", "R-L5"],
    slots: 6,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) =>
      grid(margin, margin, pageW * 2 - 2 * margin, pageH - 2 * margin, 3, 2, gap, "detail"),
  },

  {
    // 4×2 dense grid — contact-sheet style (R-L5)
    id: "grid-4x2",
    name: "4×2 Contact Sheet",
    category: "grid",
    cites: ["R-L5"],
    slots: 8,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) =>
      grid(margin, margin, pageW * 2 - 2 * margin, pageH - 2 * margin, 4, 2, gap, "detail"),
  },

  {
    // 5-photo mosaic: 1 large left + 2×2 right cluster (R-L6, R-S4, R-L4)
    id: "mosaic-five",
    name: "5-Photo Mosaic",
    category: "collage",
    cites: ["R-L6", "R-S4", "R-L4"],
    slots: 5,
    frames: ({ pageW, pageH, margin, gap }) => [
      { x: margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin, role: "hero" },
      ...grid(pageW + margin, margin, pageW - 2 * margin, pageH - 2 * margin, 2, 2, gap, "detail"),
    ],
  },

  {
    // 4-photo horizontal filmstrip band centered vertically (R-L4, R-O4)
    id: "filmstrip",
    name: "Filmstrip",
    category: "panorama",
    cites: ["R-L4", "R-O4"],
    slots: 4,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) => {
      const h = Math.round((pageH - 2 * margin) * 0.55);
      const w = (pageW * 2 - 2 * margin - 3 * gap) / 4;
      const y = (pageH - h) / 2;
      return [0, 1, 2, 3].map((i) => ({
        x: margin + i * (w + gap),
        y,
        width: w,
        height: h,
      }));
    },
  },

  {
    // Breather — generous mat on the LEFT page (mirror of breather-right) (R-L2, R-W1, R-S5)
    id: "breather-left",
    name: "Breather — Single Left",
    category: "gallery",
    cites: ["R-L2", "R-W1", "R-S5"],
    slots: 1,
    frames: ({ pageW, pageH, margin }) => {
      const m = margin * 1.6;
      return [{ x: m, y: m, width: pageW - 2 * m, height: pageH - 2 * m }];
    },
  },

  {
    // Photo right page + photo+caption left — story spread (R-T6, R-L2, R-O2)
    id: "photo-right-caption-left",
    name: "Photo + Caption Left",
    category: "text",
    cites: ["R-T6", "R-L2", "R-O2"],
    slots: 2,
    frames: ({ pageW, pageH, margin }) => [
      { x: margin, y: margin, width: pageW - 2 * margin, height: (pageH - 2 * margin) * 0.72 },
      { x: pageW + margin, y: margin, width: pageW - 2 * margin, height: pageH - 2 * margin },
    ],
    texts: ({ pageW, pageH, margin }) => [
      {
        role: "caption",
        x: margin,
        y: margin + (pageH - 2 * margin) * 0.72 + 8,
        width: pageW - 2 * margin,
        align: "left",
        placeholder: "Add a caption…",
      },
    ],
  },

  {
    // Diagonal split: large top-left triangle + smaller bottom-right — modern editorial (R-L6)
    id: "diagonal-split",
    name: "Diagonal Split",
    category: "mixed",
    cites: ["R-L6", "R-S4"],
    slots: 2,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) => {
      const totalW = pageW * 2 - 2 * margin;
      const h = pageH - 2 * margin;
      return [
        { x: margin, y: margin, width: totalW * 0.62, height: h * 0.62, role: "hero" },
        { x: margin + totalW * 0.62 - totalW * 0.38 + gap, y: margin + h * 0.62 - h * 0.38 + gap, width: totalW * 0.38, height: h * 0.38, role: "detail" },
      ];
    },
  },

  {
    // Two equal landscape photos stacked on each page — 4 total (R-L4, R-O2)
    id: "two-stack-per-page",
    name: "2×2 Stacked Pages",
    category: "grid",
    cites: ["R-L4", "R-O2"],
    slots: 4,
    frames: ({ pageW, pageH, margin, gap }) => {
      const cellH = (pageH - 2 * margin - gap) / 2;
      const cellW = pageW - 2 * margin;
      return [0, 1].flatMap((page) =>
        [0, 1].map((row) => ({
          x: page * pageW + margin,
          y: margin + row * (cellH + gap),
          width: cellW,
          height: cellH,
          role: "detail" as const,
        })),
      );
    },
  },

  {
    // Feature portrait centered with generous white mat — minimal statement (R-L2, R-W1, R-S5)
    id: "centered-feature",
    name: "Centered Feature",
    category: "hero",
    cites: ["R-L2", "R-W1", "R-S5"],
    slots: 1,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin }) => {
      const m = margin * 2.2;
      const w = pageW * 2 - 2 * m;
      const h = pageH - 2 * m;
      return [{ x: m, y: m, width: w, height: h, role: "hero" }];
    },
  },

  // ── Artifact Uprising / Canva-inspired additions ────────────────────────────

  {
    // Hero top half + two landscape details below on each page — 6 photos (R-L6, R-S4)
    id: "two-row-per-page",
    name: "Hero + Details Row",
    category: "collage",
    cites: ["R-L6", "R-S4", "R-L4"],
    slots: 6,
    frames: ({ pageW, pageH, margin, gap }) => {
      const heroH = (pageH - 2 * margin) * 0.56;
      const stripH = pageH - 2 * margin - heroH - gap;
      const detailW = (pageW - 2 * margin - gap) / 2;
      return [0, 1].flatMap((page) => [
        { x: page * pageW + margin, y: margin, width: pageW - 2 * margin, height: heroH, role: "hero" as const },
        { x: page * pageW + margin,              y: margin + heroH + gap, width: detailW, height: stripH, role: "detail" as const },
        { x: page * pageW + margin + detailW + gap, y: margin + heroH + gap, width: detailW, height: stripH, role: "detail" as const },
      ]);
    },
  },

  {
    // Two landscape stacked on left + tall portrait hero right — 3 photos (R-L6, R-O1)
    id: "two-stack-left-hero-right",
    name: "Two Stack + Portrait Hero",
    category: "mixed",
    cites: ["R-L6", "R-O1", "R-S4"],
    slots: 3,
    frames: ({ pageW, pageH, margin, gap }) => {
      const stackW = pageW - 2 * margin;
      const cellH = (pageH - 2 * margin - gap) / 2;
      const heroW = pageW - 2 * margin;
      return [
        { x: margin, y: margin, width: stackW, height: cellH, role: "detail" as const },
        { x: margin, y: margin + cellH + gap, width: stackW, height: cellH, role: "detail" as const },
        { x: pageW + margin, y: margin, width: heroW, height: pageH - 2 * margin, role: "hero" as const },
      ];
    },
  },

  {
    // Tall portrait hero left + two landscape stacked right — 3 photos (R-L6, R-O1)
    id: "hero-left-two-stack-right",
    name: "Portrait Hero + Two Stack",
    category: "mixed",
    cites: ["R-L6", "R-O1", "R-S4"],
    slots: 3,
    frames: ({ pageW, pageH, margin, gap }) => {
      const heroW = pageW - 2 * margin;
      const stackW = pageW - 2 * margin;
      const cellH = (pageH - 2 * margin - gap) / 2;
      return [
        { x: margin, y: margin, width: heroW, height: pageH - 2 * margin, role: "hero" as const },
        { x: pageW + margin, y: margin, width: stackW, height: cellH, role: "detail" as const },
        { x: pageW + margin, y: margin + cellH + gap, width: stackW, height: cellH, role: "detail" as const },
      ];
    },
  },

  {
    // Large hero spanning gutter + 3 small details on right page (R-L6, R-S4, R-L7)
    id: "hero-plus-three-right",
    name: "Wide Hero + Three Right",
    category: "collage",
    cites: ["R-L6", "R-S4", "R-L7"],
    slots: 4,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) => {
      const heroW = pageW * 1.1 - margin;
      const rightW = pageW - heroW - margin - gap;
      const cellH = (pageH - 2 * margin - 2 * gap) / 3;
      return [
        { x: margin, y: margin, width: heroW, height: pageH - 2 * margin, role: "hero" as const },
        { x: margin + heroW + gap, y: margin, width: rightW, height: cellH, role: "detail" as const },
        { x: margin + heroW + gap, y: margin + cellH + gap, width: rightW, height: cellH, role: "detail" as const },
        { x: margin + heroW + gap, y: margin + 2 * (cellH + gap), width: rightW, height: cellH, role: "detail" as const },
      ];
    },
  },

  {
    // 3 portrait columns per page — 6 total, classic album style (R-L4, R-O1)
    id: "three-col-per-page",
    name: "Three Portrait Columns",
    category: "grid",
    cites: ["R-L4", "R-O1"],
    slots: 6,
    frames: ({ pageW, pageH, margin, gap }) => {
      const colW = (pageW - 2 * margin - 2 * gap) / 3;
      return [0, 1].flatMap((page) =>
        [0, 1, 2].map((col) => ({
          x: page * pageW + margin + col * (colW + gap),
          y: margin,
          width: colW,
          height: pageH - 2 * margin,
          role: "detail" as const,
        })),
      );
    },
  },

  {
    // Wide main photo left + narrow accent right on each page — 4 photos (R-L6, R-L2)
    id: "asymmetric-wide-narrow",
    name: "Asymmetric Wide–Narrow",
    category: "mixed",
    cites: ["R-L6", "R-L2", "R-S4"],
    slots: 4,
    frames: ({ pageW, pageH, margin, gap }) => {
      const wideW = (pageW - 2 * margin - gap) * 0.62;
      const narrowW = pageW - 2 * margin - gap - wideW;
      return [0, 1].flatMap((page) => [
        { x: page * pageW + margin, y: margin, width: wideW, height: pageH - 2 * margin, role: "hero" as const },
        { x: page * pageW + margin + wideW + gap, y: margin, width: narrowW, height: pageH - 2 * margin, role: "detail" as const },
      ]);
    },
  },

  {
    // Narrow accent left + wide main right on each page — 4 photos (R-L6, R-L2)
    id: "narrow-wide-per-page",
    name: "Narrow–Wide Per Page",
    category: "mixed",
    cites: ["R-L6", "R-L2", "R-S4"],
    slots: 4,
    frames: ({ pageW, pageH, margin, gap }) => {
      const narrowW = (pageW - 2 * margin - gap) * 0.38;
      const wideW = pageW - 2 * margin - gap - narrowW;
      return [0, 1].flatMap((page) => [
        { x: page * pageW + margin, y: margin, width: narrowW, height: pageH - 2 * margin, role: "detail" as const },
        { x: page * pageW + margin + narrowW + gap, y: margin, width: wideW, height: pageH - 2 * margin, role: "hero" as const },
      ]);
    },
  },

  {
    // 4 equal photos across spread with caption band below (R-L4, R-T6, R-O4)
    id: "photos-caption-strip",
    name: "Photos + Caption Strip",
    category: "text",
    cites: ["R-L4", "R-T6", "R-O4"],
    slots: 4,
    crossesGutter: true,
    frames: ({ pageW, pageH, margin, gap }) => {
      const captionH = 14;
      const h = pageH - 2 * margin - captionH - gap;
      const w = (pageW * 2 - 2 * margin - 3 * gap) / 4;
      return [0, 1, 2, 3].map((i) => ({
        x: margin + i * (w + gap), y: margin, width: w, height: h,
      }));
    },
    texts: ({ pageW, pageH, margin, gap }) => {
      const captionH = 14;
      const h = pageH - 2 * margin - captionH - gap;
      return [{
        role: "caption" as const,
        x: margin, y: margin + h + gap,
        width: pageW * 2 - 2 * margin,
        align: "center" as const,
        placeholder: "Add a caption…",
      }];
    },
  },

  {
    // Single matted photo with title block in corner — signature print style (R-L2, R-T6)
    id: "corner-accent",
    name: "Corner Accent",
    category: "text",
    cites: ["R-L2", "R-T6", "R-W1"],
    slots: 1,
    frames: ({ pageW, pageH, margin }) => {
      const m = margin * 1.4;
      return [{ x: pageW + m, y: m, width: pageW - 2 * m, height: pageH - 2 * m, role: "hero" as const }];
    },
    texts: ({ pageW, pageH, margin }) => [
      { role: "heading" as const, x: margin, y: pageH * 0.35, width: pageW - 2 * margin, align: "left" as const, placeholder: "Title" },
      { role: "caption" as const, x: margin, y: pageH * 0.52, width: pageW - 2 * margin, align: "left" as const, placeholder: "Subtitle or date" },
    ],
  },

  {
    // Blank left editorial page + 3×3 mini grid right (R-T6, R-L5)
    id: "blank-left-grid-right",
    name: "Text Page + 3×3 Grid",
    category: "text",
    cites: ["R-T6", "R-L5"],
    slots: 9,
    frames: ({ pageW, pageH, margin, gap }) =>
      grid(pageW + margin, margin, pageW - 2 * margin, pageH - 2 * margin, 3, 3, gap, "detail"),
    texts: ({ pageW, pageH, margin }) => [
      { role: "heading" as const, x: margin, y: pageH * 0.28, width: pageW - 2 * margin, align: "left" as const, placeholder: "Chapter heading" },
      { role: "body" as const, x: margin, y: pageH * 0.42, width: pageW - 2 * margin, align: "left" as const, placeholder: "Tell the story of this chapter…" },
    ],
  },

  {
    // Two tall portrait photos side by side with generous mat — wedding / portrait album (R-L2, R-O1)
    id: "two-portrait-matted",
    name: "Two Matted Portraits",
    category: "gallery",
    cites: ["R-L2", "R-O1", "R-W2"],
    slots: 2,
    frames: ({ pageW, pageH, margin }) => {
      const m = margin * 1.2;
      const ph = pageH - 2 * m;
      const pw = Math.min(pageW - 2 * m, ph * 0.72);
      return [
        { x: (pageW - pw) / 2, y: m, width: pw, height: ph },
        { x: pageW + (pageW - pw) / 2, y: m, width: pw, height: ph },
      ];
    },
  },

  {
    // L-shaped hero spanning left-top + 2 details bottom-left + 2 cells right (R-L6, R-S4)
    id: "l-shape-hero",
    name: "L-Shape Hero",
    category: "collage",
    cites: ["R-L6", "R-S4"],
    slots: 5,
    frames: ({ pageW, pageH, margin, gap }) => {
      const heroW = pageW - 2 * margin;
      const heroH = (pageH - 2 * margin) * 0.60;
      const bottomH = pageH - 2 * margin - heroH - gap;
      const detailW = (pageW - 2 * margin - gap) / 2;
      const rightW = pageW - 2 * margin;
      const rightCellH = (pageH - 2 * margin - gap) / 2;
      return [
        { x: margin, y: margin, width: heroW, height: heroH, role: "hero" as const },
        { x: margin, y: margin + heroH + gap, width: detailW, height: bottomH, role: "detail" as const },
        { x: margin + detailW + gap, y: margin + heroH + gap, width: detailW, height: bottomH, role: "detail" as const },
        { x: pageW + margin, y: margin, width: rightW, height: rightCellH, role: "detail" as const },
        { x: pageW + margin, y: margin + rightCellH + gap, width: rightW, height: rightCellH, role: "detail" as const },
      ];
    },
  },

  {
    // Single photo centered on right page with large white mat — minimal portfolio page (R-L2, R-W1)
    id: "single-page-center",
    name: "Single Page Center",
    category: "hero",
    cites: ["R-L2", "R-W1", "R-S5"],
    slots: 1,
    frames: ({ pageW, pageH, margin }) => {
      const m = margin * 1.8;
      return [{ x: pageW + m, y: m, width: pageW - 2 * m, height: pageH - 2 * m, role: "hero" as const }];
    },
  },
];

export function getTemplate(id: string): LayoutTemplate {
  const t = TEMPLATES.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}
