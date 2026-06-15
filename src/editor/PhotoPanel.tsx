import { memo, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { db, touchProject } from "../db/db";
import type { Photo } from "../model/types";
import { ACCEPT_ATTR } from "../images/importPhotos";
import { ConfirmDialog } from "../app/ui";
import { usePhotoThumbs } from "./usePhotoThumbs";
import type { ImportUiState } from "./useImport";

const TILE_SIZE = 88; // px square

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

  const handleDragStart = (e: React.DragEvent) => {
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
      className={`relative select-none overflow-hidden rounded-md bg-surface-2 transition-shadow duration-150 ${
        selected ? "ring-2 ring-accent" : "ring-1 ring-line/40 hover:ring-surface-3"
      }`}
      style={{ width: TILE_SIZE, height: TILE_SIZE }}
    >
      {url && (
        <img src={url} alt={photo.fileName} loading="lazy" draggable={false} className="h-full w-full object-cover" />
      )}
      {used ? (
        <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1.5 5.5 4 8l4.5-6" stroke="var(--color-accent-ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/45" />
      )}
    </button>
  );
});

interface PhotoPanelProps {
  projectId: string;
  photos: Photo[];
  usedIds: ReadonlySet<string>;
  importState: ImportUiState;
  onAddFiles: (files: File[]) => void;
  onDismissFailures: () => void;
}

export function PhotoPanel({ projectId, photos, usedIds, importState, onAddFiles, onDismissFailures }: PhotoPanelProps) {
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

  useEffect(() => {
    const live = new Set(photoIds);
    if ([...selectedRef.current].some((id) => !live.has(id))) {
      setSelected(new Set([...selectedRef.current].filter((id) => live.has(id))));
    }
  }, [photos]);

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

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-line bg-surface-1">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-[12px] font-medium text-ink">Photos</span>
        <span className="text-[11px] text-ink-faint">({photos.length})</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="ml-auto flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-ink-dim transition-colors hover:border-surface-3 hover:text-ink"
        >
          + Add
        </button>
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

      {/* Import progress */}
      {importState.running && (
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${importState.total > 0 ? (importState.done / importState.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-ink-faint">
            {importState.done}/{importState.total}
          </span>
        </div>
      )}

      {/* Import failures */}
      {!importState.running && importState.failures && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-1.5">
          <span className="flex-1 truncate text-[11px] text-danger">
            {importState.failures.length} file{importState.failures.length !== 1 ? "s" : ""} failed
          </span>
          <button type="button" onClick={onDismissFailures} className="text-[11px] text-ink-faint hover:text-ink">✕</button>
        </div>
      )}

      {/* Selection actions */}
      {selected.size > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
          <span className="text-[11px] text-ink-faint">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="ml-auto text-[11px] text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      )}

      {/* Photo grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {photos.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center"
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0) onAddFiles(files);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="rounded-lg border border-dashed border-line p-4">
              <p className="text-[12px] text-ink-faint">Drop photos here</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-[12px] text-accent hover:underline"
              >
                or click to add
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
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
            {selected.size} {selected.size === 1 ? "photo" : "photos"} will be removed from this project. This cannot
            be undone.
          </>
        }
        confirmLabel="Remove photos"
        onConfirm={() => void removeSelected()}
        onCancel={() => setConfirmRemove(false)}
      />
    </aside>
  );
}
