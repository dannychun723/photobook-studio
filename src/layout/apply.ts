import { nanoid } from "nanoid";
import type { BookSize, Frame, Spread, TextBlock } from "../model/types";
import { templateCtx, type LayoutTemplate } from "./templates";

export const DEFAULT_CROP = { offsetX: 0.5, offsetY: 0.5, zoom: 1 };

function readingOrder<T extends { x: number; y: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (Math.abs(a.y - b.y) > 5 ? a.y - b.y : a.x - b.x));
}

/**
 * Re-lays a spread onto a template. Photos are preserved: existing frames are
 * read in visual reading order and poured into the new frames in the same
 * order (hero slots first keep their photo if it was the previous hero).
 * Crops reset because frame aspect changed. Existing user text is kept;
 * template placeholder texts are only added to spreads with no text yet.
 */
export function applyTemplate(spread: Spread, template: LayoutTemplate, size: BookSize): Spread {
  const ctx = templateCtx(size);
  const oldPhotos = readingOrder(spread.frames)
    .map((f) => f.photoId)
    .filter((id): id is string => !!id);

  const frames: Frame[] = readingOrder(template.frames(ctx)).map((spec, i) => ({
    id: nanoid(),
    photoId: oldPhotos[i],
    x: spec.x,
    y: spec.y,
    width: spec.width,
    height: spec.height,
    rotation: 0,
    z: i,
    crop: { ...DEFAULT_CROP },
    border: null,
    role: spec.role,
  }));

  const texts: TextBlock[] =
    spread.texts.length > 0
      ? spread.texts
      : (template.texts?.(ctx) ?? []).map((spec, i) => ({
          id: nanoid(),
          role: spec.role,
          text: spec.placeholder,
          x: spec.x,
          y: spec.y,
          width: spec.width,
          rotation: 0,
          z: 100 + i,
          align: spec.align,
        }));

  return { ...spread, templateId: template.id, frames, texts };
}

/** Union of selected frames → one collage frame; keeps the first photo (merge tool). */
export function mergeFrames(spread: Spread, frameIds: string[]): Spread {
  const selected = spread.frames.filter((f) => frameIds.includes(f.id));
  if (selected.length < 2) return spread;
  const x = Math.min(...selected.map((f) => f.x));
  const y = Math.min(...selected.map((f) => f.y));
  const right = Math.max(...selected.map((f) => f.x + f.width));
  const bottom = Math.max(...selected.map((f) => f.y + f.height));
  const keep = readingOrder(selected).find((f) => f.photoId) ?? selected[0];
  const merged: Frame = {
    ...keep,
    x,
    y,
    width: right - x,
    height: bottom - y,
    rotation: 0,
    crop: { ...DEFAULT_CROP },
  };
  return {
    ...spread,
    templateId: undefined,
    frames: [...spread.frames.filter((f) => !frameIds.includes(f.id)), merged],
  };
}
