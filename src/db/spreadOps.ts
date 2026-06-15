import { nanoid } from "nanoid";
import { db, touchProject } from "./db";
import type { BookSize, BorderStyle, Frame, Spread } from "../model/types";
import { applyTemplate } from "../layout/apply";
import { getTemplate } from "../layout/templates";
import { useUndoStore } from "../editor/undoStore";

// All spread mutations live here so the editor UI stays declarative and every
// write bumps the project's updatedAt inside one transaction.

async function nextIndex(projectId: string): Promise<number> {
  const last = await db.spreads.where("[projectId+index]").between([projectId, -Infinity], [projectId, Infinity]).last();
  return (last?.index ?? -1) + 1;
}

export async function createSpread(projectId: string, size: BookSize, templateId = "two-up"): Promise<Spread> {
  const empty: Spread = {
    id: nanoid(),
    projectId,
    index: 0,
    frames: [],
    texts: [],
  };
  const spread = { ...applyTemplate(empty, getTemplate(templateId), size), index: await nextIndex(projectId) };
  await db.transaction("rw", [db.spreads, db.projects], async () => {
    spread.index = await nextIndex(projectId);
    await db.spreads.add(spread);
    await touchProject(projectId);
  });
  return spread;
}

/** Insert a new spread immediately after the given spread (by index), shifting later spreads up. */
export async function insertSpreadAfter(afterSpreadId: string, size: BookSize, templateId = "two-up"): Promise<Spread> {
  const after = await db.spreads.get(afterSpreadId);
  if (!after) throw new Error("Spread not found");
  const insertIndex = after.index + 1;
  const empty: Spread = { id: nanoid(), projectId: after.projectId, index: insertIndex, frames: [], texts: [] };
  const spread = { ...applyTemplate(empty, getTemplate(templateId), size), index: insertIndex };
  await db.transaction("rw", [db.spreads, db.projects], async () => {
    await db.spreads
      .where("projectId").equals(after.projectId)
      .and((s) => s.index >= insertIndex)
      .modify((s) => { s.index += 1; });
    await db.spreads.add(spread);
    await touchProject(after.projectId);
  });
  return spread;
}

export async function duplicateSpread(spreadId: string): Promise<void> {
  await db.transaction("rw", [db.spreads, db.projects], async () => {
    const src = await db.spreads.get(spreadId);
    if (!src) return;
    const copy: Spread = {
      ...src,
      id: nanoid(),
      index: src.index + 1,
      // Layout-only duplicate: copy frame geometry but clear photos, text, and background
      frames: src.frames.map((f) => ({
        ...f,
        id: nanoid(),
        photoId: undefined,
        crop: { offsetX: 0.5, offsetY: 0.5, zoom: 1 },
      })),
      texts: [],
      bg: undefined,
      bgLayers: [],
      background: undefined,
    };
    await db.spreads
      .where("projectId")
      .equals(src.projectId)
      .and((s) => s.index > src.index)
      .modify((s) => {
        s.index += 1;
      });
    await db.spreads.add(copy);
    await touchProject(src.projectId);
  });
}

export async function deleteSpread(spreadId: string): Promise<void> {
  await db.transaction("rw", [db.spreads, db.projects], async () => {
    const spread = await db.spreads.get(spreadId);
    if (!spread) return;
    await db.spreads.delete(spreadId);
    await db.spreads
      .where("projectId")
      .equals(spread.projectId)
      .and((s) => s.index > spread.index)
      .modify((s) => {
        s.index -= 1;
      });
    await touchProject(spread.projectId);
  });
}

/** Moves a spread to a new position; indices stay dense (0..n-1). */
export async function moveSpread(spreadId: string, toIndex: number): Promise<void> {
  await db.transaction("rw", [db.spreads, db.projects], async () => {
    const spread = await db.spreads.get(spreadId);
    if (!spread || spread.index === toIndex) return;
    const all = await db.spreads.where("projectId").equals(spread.projectId).sortBy("index");
    const clamped = Math.max(0, Math.min(all.length - 1, toIndex));
    const reordered = all.filter((s) => s.id !== spreadId);
    reordered.splice(clamped, 0, spread);
    await Promise.all(
      reordered.map((s, i) => (s.index === i ? Promise.resolve(0) : db.spreads.update(s.id, { index: i }))),
    );
    await touchProject(spread.projectId);
  });
}

/** Generic transactional read-modify-write for frame/text edits. */
export async function updateSpread(spreadId: string, mutate: (spread: Spread) => Spread | void): Promise<void> {
  await db.transaction("rw", [db.spreads, db.projects], async () => {
    const spread = await db.spreads.get(spreadId);
    if (!spread) return;
    // Deep-clone before mutation so the snapshot is fully independent
    useUndoStore.getState().push(spreadId, structuredClone(spread) as Spread);
    const next = mutate(spread) ?? spread;
    await db.spreads.put(next);
    await touchProject(spread.projectId);
  });
}

export async function applyTemplateToSpread(spreadId: string, templateId: string, size: BookSize): Promise<void> {
  await updateSpread(spreadId, (s) => applyTemplate(s, getTemplate(templateId), size));
}

export async function assignPhoto(spreadId: string, frameId: string, photoId: string): Promise<void> {
  await updateSpread(spreadId, (s) => ({
    ...s,
    frames: s.frames.map((f) =>
      f.id === frameId ? { ...f, photoId, crop: { offsetX: 0.5, offsetY: 0.5, zoom: 1 } } : f,
    ),
  }));
}

/** Swap the photos of two frames (drag frame→frame); crops reset to cover-fit. */
export async function swapFramePhotos(spreadId: string, aId: string, bId: string): Promise<void> {
  await updateSpread(spreadId, (s) => {
    const a = s.frames.find((f) => f.id === aId);
    const b = s.frames.find((f) => f.id === bId);
    if (!a || !b) return;
    const aPhoto = a.photoId;
    a.photoId = b.photoId;
    b.photoId = aPhoto;
    a.crop = { offsetX: 0.5, offsetY: 0.5, zoom: 1 };
    b.crop = { offsetX: 0.5, offsetY: 0.5, zoom: 1 };
  });
}

export async function setSpreadBorderDefault(spreadId: string, border: BorderStyle): Promise<void> {
  await updateSpread(spreadId, (s) => ({ ...s, borderDefault: border }));
}

/** Apply a BookDesignPreset to all spreads in a project, cycling the template sequence. */
export async function applyBookDesign(projectId: string, designId: string, size: BookSize): Promise<void> {
  const { BOOK_DESIGNS } = await import("../layout/bookDesigns");
  const design = BOOK_DESIGNS.find((d) => d.id === designId);
  if (!design) return;
  const spreads = await db.spreads.where("projectId").equals(projectId).sortBy("index");
  await Promise.all(spreads.map((spread, i) => {
    const templateId = design.sequence[i % design.sequence.length];
    return applyTemplateToSpread(spread.id, templateId, size);
  }));
}

export async function addEmptyFrame(spreadId: string, size: BookSize): Promise<void> {
  await updateSpread(spreadId, (s) => {
    const w = size.pageWidthMm * 0.4;
    const h = size.pageHeightMm * 0.4;
    const frame: Frame = {
      id: nanoid(),
      x: size.pageWidthMm - w / 2,
      y: (size.pageHeightMm - h) / 2,
      width: w,
      height: h,
      rotation: 0,
      z: Math.max(0, ...s.frames.map((f) => f.z)) + 1,
      crop: { offsetX: 0.5, offsetY: 0.5, zoom: 1 },
      border: null,
    };
    return { ...s, templateId: undefined, frames: [...s.frames, frame] };
  });
}
