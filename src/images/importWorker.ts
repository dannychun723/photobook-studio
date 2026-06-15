/// <reference lib="webworker" />
// Decodes an uploaded image off the main thread and renders the derived sizes.
// EXIF rotation is baked in by createImageBitmap, so all downstream code can
// treat width/height as display dimensions.

export interface ImportRequest {
  jobId: number;
  file: File;
}

export interface ImportResult {
  jobId: number;
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  preview?: Blob;
  thumb?: Blob;
}

const PREVIEW_MAX = 1600;
const THUMB_MAX = 320;

async function scale(bitmap: ImageBitmap, maxDim: number): Promise<Blob> {
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
}

self.onmessage = async (e: MessageEvent<ImportRequest>) => {
  const { jobId, file } = e.data;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const [preview, thumb] = await Promise.all([scale(bitmap, PREVIEW_MAX), scale(bitmap, THUMB_MAX)]);
    const result: ImportResult = {
      jobId,
      ok: true,
      width: bitmap.width,
      height: bitmap.height,
      preview,
      thumb,
    };
    bitmap.close();
    self.postMessage(result);
  } catch (err) {
    self.postMessage({
      jobId,
      ok: false,
      error: err instanceof Error ? err.message : "Could not decode image",
    } satisfies ImportResult);
  }
};
