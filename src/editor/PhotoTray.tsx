import { memo, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { db, touchProject } from "../db/db";
import type { Photo } from "../model/types";
import { ACCEPT_ATTR } from "../images/importPhotos";
import { Button, ConfirmDialog } from "../app/ui";
import { usePhotoThumbs } from "./usePhotoThumbs";
import type { ImportUiState } from "./useImport";

const TILE_H = 120; // px; tray is ~190px with header + padding

interface PhotoTileProps {
  photo: Photo;
  url: string | undefined;
  used: boolean;
  selected: boolean;
  onSelect: (photoId: string, e: ReactMouseEvent) => void;
  observe: (el: Element, photoId: string) => () => void;
}

const PhotoTile = memo(function PhotoTile({ photo, url, used, selected, onSelect, observe }: PhotoTileProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, photo.id);
  }, [observe, photo.id]);

  const width = Math.min(220, Math.max(64, Math.round(TILE_H * (photo.width / photo.height))));

  const handleDragStart = (e: React.DragEvent) => {
    // Set photoId so SpreadCanvas.handleDrop can read it (getData is case-insensitive)
    e.dataTransfer.setData("photoId", photo.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <button
      ref={ref}
      type="button"
      title={photo.fileName}
      draggable
      onDragStart={handleDragStart}
      onClick={(e) => onSelect(photo.id, e)}
      className={`relative shrink-0 select-none overflow-hidden rounded-md bg-surface-2 transition-shadow duration-150 ${
        selected ? "ring-2 ring-accent" : "ring-1 ring-line/40 hover:ring-surface-3"
      }`}
      style={{ width, height: TILE_H }}
    >
      {url && (
        <img src={url} alt={photo.fileName} loading="lazy" draggable={false} className="h-full w-full object-cover" />
      )}
      {used ? (
        <span
          title="Used in a spread"
          className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-accent"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1.5 5.5 4 8l4.5-6" stroke="var(--color-accent-ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        <span title="Not used yet" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white/45" />
      )}
    </button>
  );
});

interface PhotoTrayProps {
  projectId: string;
  photos: Photo[];
  usedIds: ReadonlySet<string>;
  importState: ImportUiState;
  onAddFiles: (files: File[]) => void;
  onDismissFailures: () => void;
}

export function PhotoTray({ projectId, photos, usedIds, importState, onAddFiles, onDismissFailures }: PhotoTrayProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const anchorRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const photoIds = photos.map((p) => p.id);
  const { urls, observe } = usePhotoThumbs(photoIds);

  // Drop selections of photos that no longer exist (e.g. after removal).
  useEffect(() => {
    const live = new Set(photoIds);
    if ([...selectedRef.current].some((id) => !live.has(id))) {
      setSelected(new Set([...selectedRef.current].filter((id) => live.has(id))));
    }
  }, [photos]);

  // Stable handler so 300 memoized tiles do not re-render on every tray render.
  const handleSelect = useCallback((photoId: string, e: ReactMouseEvent) => {
    const ids = photosRef.current.map((p) => p.id);
    const prev = selectedRef.current;
    if (e.shiftKey && anchorRef.current) {
      const a = ids.indexOf(anchorRef.current);
      const b = ids.indexOf(photoId);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = ids.slice(lo, hi + 1);
        setSelected(new Set(e.ctrlKey || e.metaKey ? [...prev, ...range] : range));
        return;
      }
    }
    anchorRef.current = photoId;
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      setSelected(next);
    } else {
      setSelected(new Set([photoId]));
    }
  }, []);

  const removeSelected = async () => {
    const ids = [...selectedRef.current];
    setConfirmRemove(false);
    if (ids.length === 0) return;
    await db.transaction("rw", [db.photos, db.photoBlobs], async () => {
      await db.photos.bulkDelete(ids);
      await db.photoBlobs.bulkDelete(ids);
    });
    await touchProject(projectId);
    setSelected(new Set());
  };

  const failures = importState.failures;

  return (
    <div className="flex h-[190px] shrink-0 flex-col border-t border-line bg-surface-1">
      <div className="flex h-11 shrink-0 items-center gap-3 px-4">
        <span className="text-[13px] font-medium text-ink">Photos ({photos.length})</span>

        {importState.running && (
          <span className="flex items-center gap-2.5">
            <span className="h-1 w-36 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${importState.total > 0 ? (importState.done / importState.total) * 100 : 0}%` }}
              />
            </span>
            <span className="text-[12px] tabular-nums text-ink-dim">
              Importing {importState.done}/{importState.total}…
            </span>
          </span>
        )}

        {!importState.running && failures && (
          <span className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1 text-[12px] text-ink-dim">
            <span>
              {failures.length} {failures.length === 1 ? "file" : "files"} failed:{" "}
              {failures
                .slice(0, 3)
                .map((f) => f.fileName)
                .join(", ")}
              {failures.length > 3 ? "…" : ""}
            </span>
            <button
              type="button"
              aria-label="Dismiss import errors"
              onClick={onDismissFailures}
              className="text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-[12px] text-ink-dim">{selected.size} selected</span>
              <Button className="!py-1.5 text-danger hover:!text-danger" onClick={() => setConfirmRemove(true)}>
                Remove from project
              </Button>
            </>
          )}
          <Button variant="primary" className="!py-1.5" onClick={() => fileInputRef.current?.click()}>
            Add photos
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length > 0) onAddFiles(files);
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-3">
        {photos.length === 0 ? (
          <div className="grid h-full place-items-center text-[13px] text-ink-faint">
            No photos yet — drop files anywhere in this window, or click Add photos.
          </div>
        ) : (
          <div className="flex h-[120px] items-stretch gap-2">
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                url={urls.get(photo.id)}
                used={usedIds.has(photo.id)}
                selected={selected.has(photo.id)}
                onSelect={handleSelect}
                observe={observe}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove photos?"
        body={
          <>
            {selected.size} {selected.size === 1 ? "photo" : "photos"} will be removed from this project, including
            the stored originals. This cannot be undone.
          </>
        }
        confirmLabel="Remove photos"
        onConfirm={() => void removeSelected()}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
