// Orchestrator for the full AI design pipeline:
//   1. Load photos (chronological order, R-S2)
//   2. Vision analysis in batches (R-S4, R-S8)
//   3. Book structure design via text prompt (R-S1–7)
//   4. Write spreads to Dexie — replaces all existing spreads
// The result is a fully editable draft: AI output is a pure document, not locked.

import { nanoid } from "nanoid";
import { db } from "../db/db";
import { applyTemplate } from "../layout/apply";
import { getTemplate } from "../layout/templates";
import type { BookSize, Photo, TextBlock, TextRole } from "../model/types";
import type { ThemeId } from "../model/types";
import { analyzePhotos } from "./analyzePhotos";
import { designBook } from "./designBook";
import type { AISpreadDesign, Occasion, LayoutStyle, PhotoAnalysis } from "./types";
import { lookupPreset, isColorDark, TYPOGRAPHY_PRESETS } from "./typographyPresets";
import type { TypographyPreset } from "./typographyPresets";

export type AIPhase = "analyzing" | "designing" | "writing" | "done" | "error";

export interface AIProgress {
  phase: AIPhase;
  analyzed?: number;
  totalPhotos?: number;
  error?: string;
}

// Maps AI-generated text onto the three templates that have genuine white-space text zones.
// All other templates are photo-first — placing text on them causes overlap and clutter.
// The optional `preset` parameter applies book-wide typography (font family, weight, color).
function buildAITexts(
  design: AISpreadDesign,
  templateId: string,
  size: BookSize,
  preset?: TypographyPreset,
): TextBlock[] {
  const { pageWidthMm: pageW, pageHeightMm: pageH } = size;
  const spreadW = pageW * 2;
  const m = 15;
  const blocks: TextBlock[] = [];

  // Determine if this spread has a dark background — affects text color choice.
  const bgDark = design.bgColor ? isColorDark(design.bgColor) : false;

  const make = (
    role: TextRole,
    text: string,
    x: number,
    y: number,
    width: number,
    align: "left" | "center" | "right",
  ): TextBlock => {
    const block: TextBlock = { id: nanoid(), role, text, x, y, width, rotation: 0, z: 100 + blocks.length, align };
    if (preset) {
      const spec = role === "heading" ? preset.heading : role === "body" ? preset.body : preset.caption;
      block.fontFamily = spec.family;
      block.fontWeight = spec.weight;
      block.fontColor = bgDark ? spec.lightColor : spec.darkColor;
    }
    return block;
  };

  switch (templateId) {
    case "text-left-photo-right":
      // Left page is a dedicated text zone — no photo overlap possible
      if (design.title)   blocks.push(make("heading", design.title,   m * 1.5, pageH * 0.28, pageW - 3 * m, "left"));
      if (design.body)    blocks.push(make("body",    design.body,    m * 1.5, pageH * 0.44, pageW - 3 * m, "left"));
      if (design.caption) blocks.push(make("caption", design.caption, m * 1.5, pageH * 0.80, pageW - 3 * m, "left"));
      break;

    case "breather-right":
      // Left page is white space — chapter title lives here
      if (design.title)   blocks.push(make("heading", design.title,   m, pageH * 0.36, pageW - 3 * m, "left"));
      if (design.caption) blocks.push(make("caption", design.caption, m, design.title ? pageH * 0.52 : pageH * 0.44, pageW - 3 * m, "left"));
      break;

    case "panoramic-spread": {
      // Photo band centred vertically; caption placed below the band in the safe margin
      const photoW = spreadW - 2 * m;
      const photoH = Math.min(pageH - 2 * m, photoW / 3);
      const photoTop = (pageH - photoH) / 2;
      // Only add caption below — title above risks overlap on narrow top margins
      if (design.caption) blocks.push(make("caption", design.caption, m, photoTop + photoH + 7, spreadW - 2 * m, "center"));
      break;
    }

    // Every other template (full-bleed, grid, hero, strip, two-up, portrait-landscape)
    // has photos filling the entire frame area — no safe text zone, so no text is added.
    default:
      break;
  }

  return blocks;
}

// Maps the AI's crop hint to cover-fit offsets (zoom always stays at 1 = cover-fit).
// Users can adjust crop manually; the AI sets a sensible starting position.
const CROP_OFFSETS: Record<NonNullable<PhotoAnalysis["cropHint"]>, { offsetX: number; offsetY: number }> = {
  "center":      { offsetX: 0.5,  offsetY: 0.5  },
  "left-third":  { offsetX: 0.33, offsetY: 0.5  },
  "right-third": { offsetX: 0.67, offsetY: 0.5  },
  "top":         { offsetX: 0.5,  offsetY: 0.3  },
  "bottom":      { offsetX: 0.5,  offsetY: 0.7  },
};

// Picks the densest template that can hold all photos in one spread.
function pickDenseTemplate(photoCount: number): string {
  if (photoCount <= 1) return "full-bleed-spread";
  if (photoCount <= 2) return "two-up";
  if (photoCount <= 3) return "pano-strip";
  if (photoCount <= 4) return "grid-2x2";
  return "grid-3x3"; // up to 9 slots
}

// Cycles through layout-appropriate alternatives on each regeneration so
// a 1-spread re-generate always produces a visually different result.
const SINGLE_SPREAD_VARIANTS: Array<{ maxPhotos: number; ids: string[] }> = [
  { maxPhotos: 1, ids: ["full-bleed-spread", "panoramic-spread"] },
  { maxPhotos: 2, ids: ["two-up", "portrait-landscape", "full-bleed-pages"] },
  { maxPhotos: 3, ids: ["pano-strip", "square-strip"] },
  { maxPhotos: 5, ids: ["grid-2x2", "hero-left-details", "hero-right-details"] },
  { maxPhotos: 99, ids: ["grid-3x3", "hero-left-details", "hero-right-details", "grid-2x2"] },
];

function pickVariedTemplate(photoCount: number, attempt: number): string {
  const group =
    SINGLE_SPREAD_VARIANTS.find((g) => photoCount <= g.maxPhotos) ??
    SINGLE_SPREAD_VARIANTS[SINGLE_SPREAD_VARIANTS.length - 1];
  return group.ids[attempt % group.ids.length];
}

export async function runAIDesign(
  projectId: string,
  occasion: Occasion,
  targetSpreads: number,
  size: BookSize,
  themeId: ThemeId,
  onProgress: (p: AIProgress) => void,
  layoutStyle: LayoutStyle = "storyteller",
  singleSpreadTemplateId?: string,
  attempt: number = 0,
  userDescription?: string,
): Promise<void> {
  // 1. Load photos sorted chronologically (takenAt from EXIF, R-S2)
  const raw: Photo[] = await db.photos.where("projectId").equals(projectId).toArray();
  if (raw.length === 0) throw new Error("No photos to design with. Import photos first.");

  const photos = raw.sort((a, b) => (a.takenAt ?? a.importedAt) - (b.takenAt ?? b.importedAt));

  // Single-spread fast path — skip AI entirely, use chosen or varied template
  if (targetSpreads === 1) {
    onProgress({ phase: "writing" });
    const templateId = singleSpreadTemplateId
      ?? (attempt > 0 ? pickVariedTemplate(photos.length, attempt) : pickDenseTemplate(photos.length));
    const template = getTemplate(templateId);
    const empty = { id: nanoid(), projectId, index: 0, frames: [], texts: [] };
    const spread = applyTemplate(empty, template, size);
    spread.borderDefault = "none";

    for (let j = 0; j < Math.min(photos.length, spread.frames.length); j++) {
      spread.frames[j] = {
        ...spread.frames[j],
        photoId: photos[j].id,
        crop: { offsetX: 0.5, offsetY: 0.5, zoom: 1 },
      };
    }

    await db.transaction("rw", [db.spreads, db.projects], async () => {
      await db.spreads.where("projectId").equals(projectId).delete();
      await db.spreads.add(spread);
      await db.projects.update(projectId, { updatedAt: Date.now() });
    });
    onProgress({ phase: "done" });
    return;
  }

  // 2. Vision analysis
  onProgress({ phase: "analyzing", analyzed: 0, totalPhotos: photos.length });
  const analyses = await analyzePhotos(photos, occasion, (done, total) =>
    onProgress({ phase: "analyzing", analyzed: done, totalPhotos: total }),
  );

  // 3. Book structure design (text-only, uses analysis)
  onProgress({ phase: "designing" });
  const bookDesign = await designBook(analyses, occasion, themeId, targetSpreads, layoutStyle, attempt, userDescription, photos);
  const spreadDesigns = bookDesign.spreads;
  const typographyPreset = lookupPreset(bookDesign.bookTypographyPreset) ?? TYPOGRAPHY_PRESETS[0];
  const aiSpineColor = bookDesign.spineColor;

  // 4. Write to Dexie — replace all existing spreads in one transaction
  onProgress({ phase: "writing" });

  // Build per-photo lookup maps for validation and smart crop hints
  const validPhotoIds = new Set(photos.map((p) => p.id));
  const cropHintByPhotoId = new Map(analyses.map((a) => [a.photoId, a.cropHint ?? "center"]));

  // Enforce global photo uniqueness at code level — first occurrence of a photoId wins.
  // The AI prompt already requests this but we guard here too.
  const seenPhotoIds = new Set<string>();
  for (const design of spreadDesigns) {
    design.photoIds = (design.photoIds ?? []).filter((id) => {
      if (!validPhotoIds.has(id) || seenPhotoIds.has(id)) return false;
      seenPhotoIds.add(id);
      return true;
    });
  }

  await db.transaction("rw", [db.spreads, db.projects], async () => {
    await db.spreads.where("projectId").equals(projectId).delete();

    for (let i = 0; i < spreadDesigns.length; i++) {
      const design = spreadDesigns[i];

      // Gracefully fall back if AI hallucinated an unknown template id
      let template = getTemplate(design.templateId);
      if (!template) template = getTemplate("two-up");

      const empty = { id: nanoid(), projectId, index: i, frames: [], texts: [] };
      const spread = applyTemplate(empty, template, size);

      // Assign photos to frames with AI crop hints; cover-fit (default) fills the frame.
      // Users can adjust crop via crop-mode double-click or switch to contain-fit in free mode.
      for (let j = 0; j < Math.min(design.photoIds.length, spread.frames.length); j++) {
        const photoId = design.photoIds[j];
        const hint = cropHintByPhotoId.get(photoId) ?? "center";
        const { offsetX, offsetY } = CROP_OFFSETS[hint as keyof typeof CROP_OFFSETS] ?? CROP_OFFSETS.center;
        spread.frames[j] = {
          ...spread.frames[j],
          photoId,
          crop: { offsetX, offsetY, zoom: 1 },
        };
      }

      // Replace placeholder text with AI-generated content (title, body, caption)
      // Pass the book-wide typography preset so all text blocks share a cohesive tone.
      const aiTexts = buildAITexts(design, template.id, size, typographyPreset);
      if (aiTexts.length > 0) spread.texts = aiTexts;

      // Apply per-spread border style from AI design
      if (design.borderStyle) spread.borderDefault = design.borderStyle;

      // Apply AI background color / gradient
      if (design.bgColor) {
        spread.bg = design.bgColorB
          ? { type: "gradient", color: design.bgColor, colorB: design.bgColorB }
          : { type: "solid", color: design.bgColor };
      }

      // Apply AI film grain to all photos in this spread
      if ((design.photoGrain ?? 0) > 0) {
        spread.frames = spread.frames.map((f) =>
          f.photoId ? { ...f, grain: design.photoGrain } : f,
        );
      }

      // Apply cover page role and AI-chosen spine color to the first spread
      if (design.pageRole) spread.pageRole = design.pageRole;
      if (i === 0 && aiSpineColor) spread.spineColor = aiSpineColor;

      await db.spreads.add(spread);
    }

    // Code-level guarantee: any photos the AI missed get packed into extra dense-grid spreads.
    // This runs even when the AI is perfectly compliant (0 extras) — zero overhead.
    const unusedPhotos = photos.filter((p) => !seenPhotoIds.has(p.id));
    let extraIndex = spreadDesigns.length;
    let i = 0;
    while (i < unusedPhotos.length) {
      const batch = unusedPhotos.slice(i, i + 9); // grid-3x3 holds up to 9
      const tid = pickDenseTemplate(batch.length);
      const tpl = getTemplate(tid);
      const empty = { id: nanoid(), projectId, index: extraIndex++, frames: [], texts: [] };
      const spread = applyTemplate(empty, tpl, size);
      spread.borderDefault = "none";
      for (let j = 0; j < Math.min(batch.length, spread.frames.length); j++) {
        const photoId = batch[j].id;
        const hint = cropHintByPhotoId.get(photoId) ?? "center";
        const { offsetX, offsetY } = CROP_OFFSETS[hint as keyof typeof CROP_OFFSETS] ?? CROP_OFFSETS.center;
        spread.frames[j] = { ...spread.frames[j], photoId, crop: { offsetX, offsetY, zoom: 1 } };
      }
      await db.spreads.add(spread);
      i += batch.length;
    }

    await db.projects.update(projectId, { updatedAt: Date.now() });
  });

  onProgress({ phase: "done" });
}
