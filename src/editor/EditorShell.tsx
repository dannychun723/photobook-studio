import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useAppStore } from "../app/store";
import { useUndoStore } from "./undoStore";
import { getBookSize } from "../model/bookSizes";
import { TopBar, type EditorView } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { BottomPhotoPanel, PANEL_DEFAULT } from "./BottomPhotoPanel";
import { SpreadCanvas } from "./canvas/SpreadCanvas";
import { SpreadThumbnail } from "./canvas/SpreadThumbnail";
import { ExportDialog } from "./ExportDialog";
import { useImport } from "./useImport";
import { getTheme } from "../themes/themes";
import { createSpread, deleteSpread, duplicateSpread, insertSpreadAfter, moveSpread } from "../db/spreadOps";
import { ConfirmDialog } from "../app/ui";
import type { BookSize, Spread } from "../model/types";
import type { ThemeTokens } from "../themes/themes";
import { applyIdea, type IdeaMode } from "../ai/regenerateSpreadIdea";

// ─── Overview grid ────────────────────────────────────────────────────────────

function OverviewGrid({
  spreads, size, theme, activeSpreadId, onSelect, onViewEdit, onInsertAfter, onDeletePage, onReorder,
}: {
  spreads: Spread[];
  size: BookSize;
  theme: ThemeTokens;
  activeSpreadId: string | null;
  onSelect: (id: string) => void;
  onViewEdit: () => void;
  onInsertAfter: (spreadId: string) => void;
  onDeletePage: (spreadId: string) => void;
  onReorder: (spreadId: string, toIndex: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(900);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(entries => setContainerW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const COLS = 4;
  const GAP = 24;
  const PAD = 48;
  const cardW = Math.max(120, (containerW - PAD - GAP * (COLS - 1)) / COLS);
  const thumbnailH = Math.round(cardW * (size.pageHeightMm / (size.pageWidthMm * 2)));

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-y-auto bg-[#dedad4]">
      <div className="grid grid-cols-4 gap-6 py-8 px-6">
        {spreads.map((spread, idx) => {
          const leftLabel  = idx === 0 ? "Back Cover"  : `Page ${(idx - 1) * 2 + 1}`;
          const rightLabel = idx === 0 ? "Front Cover" : `Page ${(idx - 1) * 2 + 2}`;
          const isActive   = spread.id === activeSpreadId;
          const isDragging = spread.id === dragId;
          const isDragOver = dragOverIdx === idx && dragId !== null && dragId !== spread.id;
          const canDelete  = spreads.length > 1;

          return (
            <div key={spread.id} className="group/card flex flex-col items-center gap-1.5">
              {/* Thumbnail card — draggable for reorder */}
              <div className="relative w-full">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("spreadId", spread.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(spread.id);
                  }}
                  onDragEnd={() => { setDragId(null); setDragOverIdx(null); }}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes("spreadid")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverIdx(idx);
                  }}
                  onDragLeave={(e) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                      setDragOverIdx(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const srcId = e.dataTransfer.getData("spreadId");
                    if (srcId && srcId !== spread.id) onReorder(srcId, idx);
                    setDragId(null);
                    setDragOverIdx(null);
                  }}
                  onClick={() => { onSelect(spread.id); onViewEdit(); }}
                  className={`w-full overflow-hidden rounded-xl shadow-md transition-all duration-150 cursor-pointer select-none ${
                    isDragging  ? "opacity-40 scale-95 shadow-sm" :
                    isDragOver  ? "ring-2 ring-accent shadow-xl scale-[1.02]" :
                    isActive    ? "shadow-xl scale-[1.005]" :
                                  "hover:shadow-lg hover:scale-[1.01]"
                  }`}
                >
                  <SpreadThumbnail
                    spread={spread}
                    size={size}
                    theme={theme}
                    height={thumbnailH}
                    isCover={idx === 0}
                  />
                </div>

                {/* Delete button — top-right corner, shown on hover */}
                {canDelete && (
                  <button
                    type="button"
                    title="Delete this page"
                    onClick={(e) => { e.stopPropagation(); onDeletePage(spread.id); }}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-[11px] text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 group-hover/card:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Page labels */}
              <div className="flex w-full items-center px-0.5 select-none">
                <span className="flex-1 truncate text-[10px] text-ink-dim">{leftLabel}</span>
                {idx === 0 && (
                  <span className="shrink-0 px-1 text-[10px] text-ink-faint/70">Spine</span>
                )}
                <span className="flex-1 truncate text-right text-[10px] text-ink-dim">{rightLabel}</span>
              </div>

              {/* Insert page after this one */}
              <button
                type="button"
                onClick={() => onInsertAfter(spread.id)}
                title="Add page after this one"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-line/60 bg-surface-1 text-[12px] text-ink-faint shadow-sm transition-colors hover:border-accent/50 hover:text-ink-dim"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Preview mode ─────────────────────────────────────────────────────────────

function PreviewMode({ spreads, activeSpreadId, onNavigate, size, theme }: {
  spreads: Spread[];
  activeSpreadId: string | null;
  onNavigate: (id: string) => void;
  size: BookSize;
  theme: ThemeTokens;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 1000, h: 700 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeIdx = spreads.findIndex((s) => s.id === activeSpreadId);
  const spread = activeIdx >= 0 ? spreads[activeIdx] : null;

  // Fit the spread to the available area, leaving room for labels + nav
  const availW = Math.max(100, area.w - 120);
  const availH = Math.max(100, area.h - 120);
  const fitScale = Math.min(availW / (size.pageWidthMm * 2), availH / size.pageHeightMm, 3);
  const spreadW = Math.round(size.pageWidthMm * 2 * fitScale);
  const spreadH = Math.round(size.pageHeightMm * fitScale);

  const leftLabel  = activeIdx === 0 ? "Back Cover"  : `Page ${(activeIdx - 1) * 2 + 1}`;
  const rightLabel = activeIdx === 0 ? "Front Cover" : `Page ${(activeIdx - 1) * 2 + 2}`;

  const atFirst = activeIdx <= 0;
  const atLast  = activeIdx >= spreads.length - 1;
  const navBtn  = "flex h-8 w-8 items-center justify-center rounded-full text-[14px] text-ink-dim transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#e8e4de]"
    >
      {spread ? (
        <>
          {/* Page labels aligned to spread edges */}
          <div style={{ width: spreadW }} className="flex items-end justify-between pb-2">
            <span className="text-[11px] text-ink-faint">{leftLabel}</span>
            <span className="text-[11px] text-ink-faint">{rightLabel}</span>
          </div>

          {/* Clean rendered spread — SpreadThumbnail, no Konva editing chrome */}
          <div style={{ width: spreadW, height: spreadH }} className="overflow-hidden shadow-2xl">
            <SpreadThumbnail spread={spread} size={size} theme={theme} height={spreadH} isCover={activeIdx === 0} />
          </div>

          {/* Navigation pill */}
          <div className="mt-6 flex items-center gap-0.5 rounded-full border border-line bg-surface-1 px-2 py-1.5 shadow-md">
            <button type="button" disabled={atFirst} onClick={() => onNavigate(spreads[0].id)} className={navBtn} title="First">
              |‹
            </button>
            <button type="button" disabled={atFirst} onClick={() => onNavigate(spreads[activeIdx - 1].id)} className={navBtn} title="Previous">
              ‹
            </button>
            <span className="min-w-[56px] text-center text-[11px] text-ink-faint">
              {activeIdx + 1} / {spreads.length}
            </span>
            <button type="button" disabled={atLast} onClick={() => onNavigate(spreads[activeIdx + 1].id)} className={navBtn} title="Next">
              ›
            </button>
            <button type="button" disabled={atLast} onClick={() => onNavigate(spreads[spreads.length - 1].id)} className={navBtn} title="Last">
              ›|
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink-faint">No page selected</p>
      )}
    </div>
  );
}

// ─── EditorShell ──────────────────────────────────────────────────────────────

export function EditorShell({ projectId }: { projectId: string }) {
  const goHome = useAppStore((s) => s.goHome);
  const activeSpreadId = useAppStore((s) => s.activeSpreadId);
  const setActiveSpreadId = useAppStore((s) => s.setActiveSpreadId);

  const [editorView, setEditorView] = useState<EditorView>("overview");
  const [showGuides, setShowGuides] = useState<boolean>(() => {
    const stored = localStorage.getItem("pb_show_guides");
    return stored === null ? true : stored === "true";
  });
  const handleShowGuidesChange = (v: boolean) => {
    setShowGuides(v);
    localStorage.setItem("pb_show_guides", String(v));
  };
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<"layout" | "free">("layout");
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ideaAttempt, setIdeaAttempt] = useState(0);
  const [isIdeaLoading, setIsIdeaLoading] = useState(false);
  const [photoPanelHeight, setPhotoPanelHeight] = useState(PANEL_DEFAULT);
  const { importState, importFiles, dismissFailures } = useImport(projectId);

  const undoStacks = useUndoStore((s) => s.stacks);
  const { undo, redo } = useUndoStore.getState();
  const canUndo = Boolean(activeSpreadId && (undoStacks[activeSpreadId]?.past.length ?? 0) > 0);
  const canRedo = Boolean(activeSpreadId && (undoStacks[activeSpreadId]?.future.length ?? 0) > 0);

  const handleUndo = useCallback(async () => {
    if (!activeSpreadId) return;
    const current = await db.spreads.get(activeSpreadId);
    if (!current) return;
    const target = undo(activeSpreadId, current);
    if (target) await db.spreads.put(target);
  }, [activeSpreadId, undo]);

  const handleRedo = useCallback(async () => {
    if (!activeSpreadId) return;
    const current = await db.spreads.get(activeSpreadId);
    if (!current) return;
    const target = redo(activeSpreadId, current);
    if (target) await db.spreads.put(target);
  }, [activeSpreadId, redo]);

  const project = useLiveQuery(async () => (await db.projects.get(projectId)) ?? null, [projectId]);
  const photos = useLiveQuery(
    () => db.photos.where("projectId").equals(projectId).sortBy("importedAt"),
    [projectId],
  );
  const spreads = useLiveQuery(
    () => db.spreads.where("projectId").equals(projectId).sortBy("index"),
    [projectId],
  );

  const usedIds = useLiveQuery(
    async () => {
      const all = await db.spreads.where("projectId").equals(projectId).toArray();
      const used = new Set<string>();
      for (const spread of all) {
        for (const frame of spread.frames) if (frame.photoId) used.add(frame.photoId);
      }
      return used;
    },
    [projectId],
    new Set<string>(),
  );

  // Auto-select first spread
  useEffect(() => {
    if (!spreads) return;
    if (spreads.length === 0) { setActiveSpreadId(null); return; }
    if (!activeSpreadId || !spreads.find((s) => s.id === activeSpreadId)) {
      setActiveSpreadId(spreads[0].id);
    }
  }, [spreads, activeSpreadId, setActiveSpreadId]);

  useEffect(() => { setMode("layout"); }, [activeSpreadId]);

  useEffect(() => {
    if (project === null) goHome();
  }, [project, goHome]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return; // only block for inline text editor
      if ((e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault(); void handleUndo();
      } else if (((e.key === "z" || e.key === "Z") && e.shiftKey) || e.key === "y" || e.key === "Y") {
        e.preventDefault(); void handleRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  // Full-window drag-and-drop
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => (e.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth += 1; setDragActive(true); };
    const onDragOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; setDragActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) void importFiles(files);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [importFiles]);

  const handleAddPage = async () => {
    if (!project) return;
    const size = getBookSize(project.sizeId);
    const spread = await createSpread(projectId, size, "two-up");
    setActiveSpreadId(spread.id);
  };

  const handleInsertAfter = async (afterSpreadId: string) => {
    if (!project) return;
    const size = getBookSize(project.sizeId);
    const spread = await insertSpreadAfter(afterSpreadId, size, "two-up");
    setActiveSpreadId(spread.id);
  };

  const handleDeletePage = async (spreadId: string) => {
    const spread = spreads?.find((s) => s.id === spreadId);
    const hasContent = spread?.frames.some((f) => f.photoId);
    if (hasContent) {
      setConfirmDeleteId(spreadId);
    } else {
      await deleteSpread(spreadId);
      if (activeSpreadId === spreadId && spreads) {
        const remaining = spreads.filter((s) => s.id !== spreadId);
        setActiveSpreadId(remaining.length > 0 ? remaining[0].id : null);
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
      setActiveSpreadId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleIdeaGenerate = async (mode: IdeaMode) => {
    if (!activeSpread || !project || isIdeaLoading) return;
    setIsIdeaLoading(true);
    try {
      const brief = localStorage.getItem(`pb_ai_desc_${projectId}`) ?? "";
      const size = getBookSize(project.sizeId);
      const updated = await applyIdea(activeSpread, mode, size, brief, ideaAttempt);
      setIdeaAttempt((a) => a + 1);
      await db.spreads.update(activeSpread.id, {
        frames: updated.frames,
        texts: updated.texts,
        templateId: updated.templateId,
      });
      await db.projects.update(projectId, { updatedAt: Date.now() });
    } catch (err) {
      console.error("Idea generation failed:", err);
    } finally {
      setIsIdeaLoading(false);
    }
  };

  if (!project || photos === undefined || spreads === undefined) return null;

  const size = getBookSize(project.sizeId);
  const theme = getTheme(project.themeId);
  const activeSpread = spreads.find((s) => s.id === activeSpreadId) ?? null;
  const activeIdx = spreads.findIndex((s) => s.id === activeSpreadId);
  const editPageLabel =
    activeIdx === 0 ? "Front Cover" :
    activeIdx === spreads.length - 1 ? "Back Cover" :
    `Page ${activeIdx + 1}`;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        project={project}
        pageCount={spreads.length}
        editorView={editorView}
        onViewChange={setEditorView}
        onGoHome={goHome}
        onExport={() => setExportDialogOpen(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => void handleUndo()}
        onRedo={() => void handleRedo()}
        showGuides={showGuides}
        onShowGuidesChange={handleShowGuidesChange}
        onIdeaGenerate={(mode) => void handleIdeaGenerate(mode)}
        isIdeaLoading={isIdeaLoading}
      />

      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Left: tabbed panel — AI Design / Layouts / Border / Text / Theme / Filter */}
        <LeftPanel
          projectId={projectId}
          themeId={project.themeId}
          photos={photos}
          activeSpreadId={activeSpreadId}
          activeSpread={activeSpread}
          size={size}
          selectedFrameId={selectedFrameId}
          selectedTextId={selectedTextId}
        />

        {/* Center: view-dependent canvas area */}

        {/* ── Edit: single active spread, full canvas ── */}
        {editorView === "edit" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {activeSpread ? (
              <div className="flex min-h-0 flex-1 overflow-hidden bg-[#dedad4]">
                <SpreadCanvas
                  spread={activeSpread}
                  project={project}
                  size={size}
                  mode={mode}
                  onModeChange={setMode}
                  theme={theme}
                  isCover={activeIdx === 0}
                  onFrameSelect={setSelectedFrameId}
                  onTextSelect={setSelectedTextId}
                  onAddPage={() => void handleAddPage()}
                  onDeletePage={() => void handleDeletePage(activeSpread.id)}
                  canDeletePage={spreads.length > 1}
                  pageLabel={editPageLabel}
                  pageIndex={activeIdx}
                  pageCount={spreads.length}
                  onPrevPage={() => setActiveSpreadId(spreads[activeIdx - 1].id)}
                  onNextPage={() => setActiveSpreadId(spreads[activeIdx + 1].id)}
                  onDuplicatePage={() => void duplicateSpread(activeSpread.id)}
                  showGuides={showGuides}
                />
              </div>
            ) : (
              /* No spread selected — prompt user to go to Overview */
              <div className="flex flex-1 items-center justify-center bg-[#dedad4]">
                <div className="text-center">
                  {spreads.length === 0 ? (
                    <>
                      <p className="mb-3 text-[14px] text-ink-faint">No pages yet</p>
                      <button
                        type="button"
                        onClick={() => void handleAddPage()}
                        className="rounded-lg border border-accent px-4 py-2 text-[13px] text-accent hover:bg-accent hover:text-accent-ink"
                      >
                        + Add first page
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mb-3 text-[14px] text-ink-faint">Select a page in Overview to edit</p>
                      <button
                        type="button"
                        onClick={() => setEditorView("overview")}
                        className="rounded-lg border border-line px-4 py-2 text-[13px] text-ink-dim transition-colors hover:bg-surface-2"
                      >
                        Go to Overview →
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Overview: 4-column grid of all spreads ── */}
        {editorView === "overview" && (
          <OverviewGrid
            spreads={spreads}
            size={size}
            theme={theme}
            activeSpreadId={activeSpreadId}
            onSelect={setActiveSpreadId}
            onViewEdit={() => setEditorView("edit")}
            onInsertAfter={(id) => void handleInsertAfter(id)}
            onDeletePage={(id) => void handleDeletePage(id)}
            onReorder={(spreadId, toIndex) => void moveSpread(spreadId, toIndex)}
          />
        )}

        {/* ── Preview ── */}
        {editorView === "preview" && (
          <PreviewMode
            spreads={spreads}
            activeSpreadId={activeSpreadId}
            onNavigate={setActiveSpreadId}
            size={size}
            theme={theme}
          />
        )}
      </div>

        {/* Bottom: resizable photo library */}
        <BottomPhotoPanel
          projectId={projectId}
          photos={photos}
          usedIds={usedIds}
          importState={importState}
          onAddFiles={(files) => void importFiles(files)}
          onDismissFailures={dismissFailures}
          height={photoPanelHeight}
          onHeightChange={setPhotoPanelHeight}
        />
      </div>

      {/* Drag-and-drop overlay */}
      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
          <div className="grid h-full w-full place-items-center rounded-2xl border-2 border-dashed border-accent">
            <div className="text-center">
              <p className="font-display text-2xl text-ink">Drop photos to add them to {project.name}</p>
              <p className="mt-2 text-[13px] text-ink-dim">JPEG, PNG, WebP, GIF, BMP or AVIF</p>
            </div>
          </div>
        </div>
      )}

      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        project={project}
        activeSpread={activeSpread}
        spreads={spreads}
        size={size}
        theme={theme}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete page?"
        body="This page has photos assigned. Delete it anyway? The photos will remain in the library."
        confirmLabel="Delete page"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
