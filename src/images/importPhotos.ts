import { nanoid } from "nanoid";
import exifr from "exifr";
import { db, touchProject } from "../db/db";
import type { Orientation, Photo } from "../model/types";
import type { ImportRequest, ImportResult } from "./importWorker";

export interface ImportProgress {
  done: number;
  total: number;
  failed: { fileName: string; reason: string }[];
}

const ACCEPTED = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif";

function orientationOf(width: number, height: number): Orientation {
  const ratio = width / height;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return "square";
}

// Square aspect (R-O4) and capture time (R-S2) feed the Phase 4 pacing engine,
// so EXIF time is read at import while we still have the original File handle.
async function readTakenAt(file: File): Promise<number | undefined> {
  try {
    const exif = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    const date: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate;
    return date instanceof Date && !isNaN(date.getTime()) ? date.getTime() : undefined;
  } catch {
    return undefined;
  }
}

const POOL_SIZE = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 2));

/**
 * Imports files into a project using a small worker pool (handles 50–300
 * RAW-sized JPEGs without blocking the UI). Persists originals + derived
 * preview/thumb blobs to IndexedDB. Returns the imported Photo records.
 */
export async function importPhotos(
  projectId: string,
  files: File[],
  onProgress?: (p: ImportProgress) => void,
): Promise<Photo[]> {
  const valid = files.filter((f) => ACCEPTED.test(f.name) || f.type.startsWith("image/"));
  const progress: ImportProgress = { done: 0, total: valid.length, failed: [] };
  const imported: Photo[] = [];
  if (valid.length === 0) return imported;

  const workers = Array.from(
    { length: Math.min(POOL_SIZE, valid.length) },
    () => new Worker(new URL("./importWorker.ts", import.meta.url), { type: "module" }),
  );

  let nextIndex = 0;
  let jobCounter = 0;

  async function handleResult(file: File, result: ImportResult): Promise<void> {
    if (!result.ok || !result.preview || !result.thumb) {
      progress.failed.push({ fileName: file.name, reason: result.error ?? "unknown" });
      return;
    }
    const photo: Photo = {
      id: nanoid(),
      projectId,
      fileName: file.name,
      width: result.width!,
      height: result.height!,
      orientation: orientationOf(result.width!, result.height!),
      takenAt: await readTakenAt(file),
      importedAt: Date.now(),
    };
    await db.transaction("rw", [db.photos, db.photoBlobs], async () => {
      await db.photos.add(photo);
      await db.photoBlobs.add({
        photoId: photo.id,
        original: file,
        preview: result.preview!,
        thumb: result.thumb!,
      });
    });
    imported.push(photo);
  }

  await Promise.all(
    workers.map(async (worker) => {
      while (nextIndex < valid.length) {
        const file = valid[nextIndex++];
        const jobId = ++jobCounter;
        const result = await new Promise<ImportResult>((resolve) => {
          const onMessage = (e: MessageEvent<ImportResult>) => {
            if (e.data.jobId !== jobId) return;
            worker.removeEventListener("message", onMessage);
            resolve(e.data);
          };
          worker.addEventListener("message", onMessage);
          worker.postMessage({ jobId, file } satisfies ImportRequest);
        });
        await handleResult(file, result);
        progress.done += 1;
        onProgress?.({ ...progress, failed: [...progress.failed] });
      }
      worker.terminate();
    }),
  );

  await touchProject(projectId);
  return imported;
}
