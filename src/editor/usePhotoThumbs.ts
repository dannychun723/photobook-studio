import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db/db";

/**
 * Lazily materializes object URLs for photo thumbnails. Tiles register their
 * DOM node via `observe`; a single IntersectionObserver loads a thumb only
 * once its tile scrolls near the viewport, so a 300-photo tray never reads
 * 300 blobs up front. URLs are revoked when a photo leaves `photoIds`
 * (removal) and on unmount.
 */
export function usePhotoThumbs(photoIds: string[]): {
  urls: ReadonlyMap<string, string>;
  observe: (el: Element, photoId: string) => () => void;
} {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());
  const urlMap = useRef(new Map<string, string>());
  const pending = useRef(new Set<string>());
  const elToId = useRef(new Map<Element, string>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const flushScheduled = useRef(false);

  // Batch state updates: many thumbs resolve in the same frame while
  // scrolling. setTimeout rather than rAF so the flush still runs when the
  // window is occluded and not painting.
  const scheduleFlush = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    setTimeout(() => {
      flushScheduled.current = false;
      setUrls(new Map(urlMap.current));
    }, 16);
  }, []);

  const load = useCallback(
    (photoId: string) => {
      if (urlMap.current.has(photoId) || pending.current.has(photoId)) return;
      pending.current.add(photoId);
      void db.photoBlobs.get(photoId).then((blobs) => {
        pending.current.delete(photoId);
        if (!blobs || urlMap.current.has(photoId)) return;
        urlMap.current.set(photoId, URL.createObjectURL(blobs.thumb));
        scheduleFlush();
      });
    },
    [scheduleFlush],
  );

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const id = elToId.current.get(entry.target);
            if (id) load(id);
          }
        },
        // Generous horizontal margin pre-loads thumbs just outside the tray.
        { rootMargin: "0px 600px" },
      );
    }
    return observerRef.current;
  }, [load]);

  const observe = useCallback(
    (el: Element, photoId: string) => {
      elToId.current.set(el, photoId);
      getObserver().observe(el);
      return () => {
        elToId.current.delete(el);
        observerRef.current?.unobserve(el);
      };
    },
    [getObserver],
  );

  // Revoke URLs for photos removed from the project.
  useEffect(() => {
    const live = new Set(photoIds);
    let changed = false;
    for (const [id, url] of urlMap.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(url);
        urlMap.current.delete(id);
        changed = true;
      }
    }
    if (changed) scheduleFlush();
  }, [photoIds, scheduleFlush]);

  useEffect(() => {
    const map = urlMap.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return { urls, observe };
}
