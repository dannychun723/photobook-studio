import { useEffect, useState } from "react";
import { db } from "../../db/db";

/**
 * Loads a photo blob from IndexedDB and returns an HTMLImageElement (preview
 * size ~1600px) ready for Konva. Returns null while loading or if no photoId.
 * Async — does not block the canvas render.
 */
export function useFrameImage(photoId: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!photoId) {
      setImg(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void db.photoBlobs.get(photoId).then((blobs) => {
      if (cancelled || !blobs) return;
      objectUrl = URL.createObjectURL(blobs.preview);
      const el = new window.Image();
      el.onload = () => {
        if (!cancelled) setImg(el);
      };
      el.onerror = () => {
        if (!cancelled) setImg(null);
      };
      el.src = objectUrl;
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setImg(null);
    };
  }, [photoId]);

  return img;
}
