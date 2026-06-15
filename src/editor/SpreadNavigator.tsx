import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { ConfirmDialog } from "../app/ui";
import type { BookSize, Frame, Spread } from "../model/types";
import {
  createSpread,
  deleteSpread,
  duplicateSpread,
  moveSpread,
  updateSpread,
} from "../db/spreadOps";

interface SpreadNavigatorProps {
  projectId: string;
  size: BookSize;
  activeSpreadId: string | null;
  onSelect: (spreadId: string) => void;
}

interface SpreadCardProps {
  spreadId: string;
  index: number;
  frames: Frame[];
  pageRole?: Spread["pageRole"];
  pageWidthMm: number;
  pageHeightMm: number;
  isActive: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSetPageRole: (role: Spread["pageRole"]) => void;
  // drag-to-reorder
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}

const THUMB_W = 172; // px
const ASPECT = 0.5; // spreadH / spreadW = pageH / (2*pageW) ≈ 0.5 for square

function SpreadThumb({ frames, pageWidthMm, pageHeightMm }: { frames: Frame[]; pageWidthMm: number; pageHeightMm: number }) {
  const spreadWmm = pageWidthMm * 2;
  const scaleX = THUMB_W / spreadWmm;
  const scaleY = (THUMB_W * ASPECT) / pageHeightMm;
  const scale = Math.min(scaleX, scaleY);
  const thumbW = spreadWmm * scale;
  const thumbH = pageHeightMm * scale;

  return (
    <svg
      width={thumbW}
      height={thumbH}
      viewBox={`0 0 ${thumbW} ${thumbH}`}
      style={{ display: "block" }}
    >
      {/* Paper background */}
      <rect x={0} y={0} width={thumbW} height={thumbH} fill="#f7f5f0" />
      {/* Gutter line */}
      <line
        x1={pageWidthMm * scale}
        y1={0}
        x2={pageWidthMm * scale}
        y2={thumbH}
        stroke="rgba(0,0,0,0.12)"
        strokeWidth={0.5}
      />
      {/* Frames */}
      {frames.map((f) => (
        <rect
          key={f.id}
          x={f.x * scale}
          y={f.y * scale}
          width={f.width * scale}
          height={f.height * scale}
          fill={f.photoId ? "#5c6070" : "#2a2d35"}
          rx={1}
        />
      ))}
    </svg>
  );
}

function SpreadCard({
  spreadId: _spreadId,
  index,
  frames,
  pageRole,
  pageWidthMm,
  pageHeightMm,
  isActive,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onSetPageRole,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
}: SpreadCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // Right-click opens menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
  };

  // Drag-to-reorder (simple mousedown approach)
  const dragHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDragStart(index);
    const handleMouseUp = () => {
      onDragEnd();
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={cardRef}
      className={`group relative cursor-pointer select-none rounded-lg border p-1.5 transition-colors duration-100 ${
        isActive
          ? "border-accent bg-surface-2"
          : isDragOver
            ? "border-accent/60 bg-surface-2"
            : "border-line bg-surface-1 hover:border-surface-3 hover:bg-surface-2"
      }`}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => {
        // signal drag over
      }}
    >
      {/* Drag-over indicator */}
      {isDragOver && (
        <div className="pointer-events-none absolute -top-0.5 left-0 right-0 h-0.5 rounded bg-accent" />
      )}

      {/* Thumbnail */}
      <div
        className="overflow-hidden rounded"
        onMouseEnter={() => onDragOver(index)}
      >
        <SpreadThumb frames={frames} pageWidthMm={pageWidthMm} pageHeightMm={pageHeightMm} />
      </div>

      {/* Label row */}
      <div className="mt-1 flex items-center justify-between px-0.5">
        <span className="text-[11px] text-ink-faint">
          {pageRole === "front-cover" ? "Front Cover" : pageRole === "back-cover" ? "Back Cover" : `Spread ${index + 1}`}
        </span>
        <div className="flex items-center gap-1">
          {/* Drag handle */}
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-[11px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            onMouseDown={dragHandleMouseDown}
            title="Drag to reorder"
          >
            ⠿
          </button>
          {/* Kebab menu */}
          <button
            type="button"
            className="rounded p-0.5 text-[11px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            title="Spread options"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-1 top-1 z-50 w-44 overflow-hidden rounded-xl border border-line bg-surface-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
            onClick={() => { setMenuOpen(false); onDuplicate(); }}
          >
            Duplicate
          </button>
          {canMoveUp && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
              onClick={() => { setMenuOpen(false); onMoveUp(); }}
            >
              Move up
            </button>
          )}
          {canMoveDown && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
              onClick={() => { setMenuOpen(false); onMoveDown(); }}
            >
              Move down
            </button>
          )}
          <div className="mx-2 border-t border-line" />
          {pageRole !== "front-cover" && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
              onClick={() => { setMenuOpen(false); onSetPageRole("front-cover"); }}
            >
              Set as Front Cover
            </button>
          )}
          {pageRole !== "back-cover" && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
              onClick={() => { setMenuOpen(false); onSetPageRole("back-cover"); }}
            >
              Set as Back Cover
            </button>
          )}
          {pageRole && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
              onClick={() => { setMenuOpen(false); onSetPageRole(undefined); }}
            >
              Clear cover role
            </button>
          )}
          <div className="mx-2 border-t border-line" />
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-[12px] text-danger transition-colors hover:bg-surface-2"
            onClick={() => { setMenuOpen(false); onDelete(); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function SpreadNavigator({
  projectId,
  size,
  activeSpreadId,
  onSelect,
}: SpreadNavigatorProps) {
  const spreads = useLiveQuery(
    () => db.spreads.where("projectId").equals(projectId).sortBy("index"),
    [projectId],
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleAddSpread = async () => {
    const spread = await createSpread(projectId, size, "two-up");
    onSelect(spread.id);
  };

  const handleDelete = async (spreadId: string) => {
    const spread = spreads?.find((s) => s.id === spreadId);
    const hasContent = spread && spread.frames.some((f) => f.photoId);
    if (hasContent) {
      setConfirmDeleteId(spreadId);
    } else {
      await deleteSpread(spreadId);
      if (activeSpreadId === spreadId && spreads) {
        const remaining = spreads.filter((s) => s.id !== spreadId);
        if (remaining.length > 0) onSelect(remaining[0].id);
      }
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    await deleteSpread(id);
    if (activeSpreadId === id && spreads) {
      const remaining = spreads.filter((s) => s.id !== id);
      if (remaining.length > 0) onSelect(remaining[0].id);
    }
  };

  const handleDragEnd = async () => {
    if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
      const spread = spreads?.[dragFromIndex];
      if (spread) {
        await moveSpread(spread.id, dragOverIndex);
      }
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  };

  if (!spreads) return null;

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-line bg-surface-1">
      <div className="flex h-10 shrink-0 items-center border-b border-line px-3">
        <span className="text-[12px] font-medium text-ink-dim">
          Spreads {spreads.length > 0 ? `(${spreads.length})` : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {spreads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8">
            <p className="text-center text-[12px] text-ink-faint">No spreads yet</p>
            <button
              type="button"
              onClick={() => void handleAddSpread()}
              className="rounded-lg border border-accent px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent hover:text-accent-ink"
            >
              Add your first spread →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {spreads.map((spread, idx) => (
              <SpreadCard
                key={spread.id}
                spreadId={spread.id}
                index={idx}
                frames={spread.frames}
                pageRole={spread.pageRole}
                pageWidthMm={size.pageWidthMm}
                pageHeightMm={size.pageHeightMm}
                isActive={spread.id === activeSpreadId}
                onSelect={() => onSelect(spread.id)}
                onDuplicate={() => void duplicateSpread(spread.id)}
                onDelete={() => void handleDelete(spread.id)}
                onMoveUp={() => void moveSpread(spread.id, idx - 1)}
                onMoveDown={() => void moveSpread(spread.id, idx + 1)}
                canMoveUp={idx > 0}
                canMoveDown={idx < spreads.length - 1}
                onSetPageRole={(role) => void updateSpread(spread.id, (s) => ({ ...s, pageRole: role }))}
                onDragStart={(i) => setDragFromIndex(i)}
                onDragOver={(i) => setDragOverIndex(i)}
                onDragEnd={() => void handleDragEnd()}
                isDragOver={dragFromIndex !== null && dragOverIndex === idx && dragFromIndex !== idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add spread button */}
      <div className="shrink-0 border-t border-line p-2">
        <button
          type="button"
          onClick={() => void handleAddSpread()}
          className="w-full rounded-lg border border-line py-2 text-[12px] text-ink-dim transition-colors hover:border-surface-3 hover:bg-surface-2 hover:text-ink"
        >
          + Add spread
        </button>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete spread?"
        body="This spread has photos assigned. Delete it anyway? The photos will remain in the tray."
        confirmLabel="Delete spread"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </aside>
  );
}
