import { memo, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { db, touchProject } from "../db/db";
import type { Photo } from "../model/types";
import { ACCEPT_ATTR } from "../images/importPhotos";
import { ConfirmDialog } from "../app/ui";
import { usePhotoThumbs } from "./usePhotoThumbs";
import type { ImportUiState } from "./useImport";

const TILE = 90; // px — square tiles
const PANEL_PAD = 4; // px — slim padding around tiles
export const PANEL_MIN = 6 + PANEL_PAD * 2 + TILE; // handle + padding + one tile row
export const PANEL_DEFAULT = PANEL_MIN;
export const PANEL_MAX = 520;

// ─── Tile ────────────────────────────────────────────────────────────────────

interface TileProps {
  photo: Photo;
  url: string | undefined;
  used: boolean;
  selected: boolean;
  onSelect: (id: string, e: ReactMouseEvent) => void;
  observe: (el: Element, photoId: string) => () => void;
}

const PhotoTile = memo(function PhotoTile({ photo, url, used, selected, onSelect, observe }: TileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observe(el, photo.id);
  }, [observe, photo.id]);

  return (
    <button
      ref={ref}
      type="button"
      title={photo.fileName}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("photoId", photo.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={(e) => onSelect(photo.id, e)}
      className={`relative shrink-0 select-none overflow-hidden rounded-md bg-surface-2 transition-shadow ${
        selected ? "ring-2 ring-accent" : "ring-1 ring-line/40 hover:ring-surface-3"
      }`}
      style={{ width: TILE, height: TILE }}
    >
      {url && <img src={url} alt={photo.fileName} draggable={false} className="h-full w-full object-cover" />}
      {used ? (
        <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5.5 4 8l4.5-6" stroke="var(--color-accent-ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/45" />
      )}
    </button>
  );
});

// ─── Panel ───────────────────────────────────────────────────────────────────

interface BottomPhotoPanelProps {
  projectId: string;
  photos: Photo[];
  usedIds: ReadonlySet<string>;
  importState: ImportUiState;
  onAddFiles: (files: File[]) => void;
  onDismissFailures: () => void;
  height: number;
  onHeightChange: (h: number) => void;
}

export function BottomPhotoPanel({
  projectId, photos, usedIds, importState, onAddFiles, onDismissFailures,
  height, onHeightChange,
}: BottomPhotoPanelProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const photoIds = photos.map((p) => p.id);
  const { urls, observe } = usePhotoThumbs(photoIds);

  // Drop deselected photos
  useEffect(() => {
    const live = new Set(photoIds);
    if ([...selectedRef.current].some((id) => !live.has(id))) {
      setSelected(new Set([...selectedRef.current].filter((id) => live.has(id))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      next.has(photoId) ? next.delete(photoId) : next.add(photoId);
      setSelected(next);
    } else {
      setSelected(new Set([photoId]));
    }
  }, []);

  const removeSelected = async () => {
    const ids = [...selectedRef.current];
    setConfirmRemove(false);
    if (!ids.length) return;
    await db.transaction("rw", [db.photos, db.photoBlobs], async () => {
      await db.photos.bulkDelete(ids);
      await db.photoBlobs.bulkDelete(ids);
    });
    await touchProject(projectId);
    setSelected(new Set());
  };

  // Drag-to-resize: drag the top handle upward to expand, downward to shrink
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(PANEL_MIN, Math.min(PANEL_MAX, startH - (ev.clientY - startY)));
      onHeightChange(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="flex shrink-0 flex-col bg-surface-1"
      style={{ height, borderTop: "1px solid var(--color-line)" }}
    >
      {/* Resize handle */}
      <div
        onPointerDown={handleResizePointerDown}
        style={{ touchAction: "none" }}
        className="flex h-1.5 w-full shrink-0 cursor-row-resize items-center justify-center hover:bg-accent/25 active:bg-accent/40 transition-colors"
        title="Drag to resize photo panel"
      >
        <div className="flex gap-[3px]">
          {[0,1,2].map((i) => (
            <span key={i} className="h-0.5 w-3 rounded-full bg-line/60" />
          ))}
        </div>
      </div>

      {/* Import progress bar — thin strip, only visible while importing */}
      {importState.running && (
        <div className="h-0.5 w-full shrink-0 bg-surface-3">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${importState.total > 0 ? (importState.done / importState.total) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Import failures — compact dismissible strip */}
      {!importState.running && importState.failures && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-danger/20 bg-danger/8 px-3 py-1">
          <span className="text-[10px] text-danger/80">
            {importState.failures.length} file{importState.failures.length !== 1 ? "s" : ""} failed to import
          </span>
          <button type="button" onClick={onDismissFailures} className="ml-auto text-[10px] text-ink-faint hover:text-ink">✕</button>
        </div>
      )}

      {/* Horizontal filmstrip — single row, scrolls sideways */}
      <div
        className="relative flex-1 overflow-x-auto overflow-y-hidden"
        style={{ padding: PANEL_PAD }}
        onDrop={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length) onAddFiles(files);
          }
        }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      >
        {/* Floating remove button */}
        {selected.size > 0 && (
          <div className="absolute right-1 top-1 z-10">
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-1 rounded-md border border-danger/40 bg-surface-1/90 px-2 py-0.5 text-[10px] text-danger backdrop-blur-sm hover:bg-danger/10"
            >
              Remove {selected.size}
            </button>
          </div>
        )}

        <div className="flex flex-nowrap" style={{ gap: PANEL_PAD }}>
          {/* "+" add tile — always first */}
          <button
            type="button"
            title="Add photos"
            onClick={() => fileInputRef.current?.click()}
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-line/70 text-ink-faint/60 transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
            style={{ width: TILE, height: TILE }}
          >
            <span className="text-[28px] font-light leading-none">+</span>
          </button>

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
      </div>

      <input
        ref={fileInputRef}
        type="file" multiple accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onAddFiles(files);
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove photos?"
        body={
          <>{selected.size} {selected.size === 1 ? "photo" : "photos"} will be removed from the project. This cannot be undone.</>
        }
        confirmLabel="Remove photos"
        onConfirm={() => void removeSelected()}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
