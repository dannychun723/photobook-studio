import { useRef, useState } from "react";
import { db } from "../db/db";
import type { Project } from "../model/types";
import { getBookSize } from "../model/bookSizes";
import type { IdeaMode } from "../ai/regenerateSpreadIdea";

export type EditorView = "edit" | "overview" | "preview";

function InlineName({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  const commit = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== project.name) {
      await db.projects.update(project.id, { name: trimmed, updatedAt: Date.now() });
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") { setDraft(project.name); setEditing(false); }
        }}
        className="w-44 rounded border border-line bg-transparent px-2 py-0.5 text-[13px] text-ink focus:outline-none focus:border-ink-dim"
      />
    );
  }
  return (
    <button
      type="button"
      title="Click to rename"
      onClick={() => { setDraft(project.name); setEditing(true); }}
      className="max-w-44 truncate px-1 py-0.5 text-[13px] text-ink-dim transition-colors hover:text-ink"
    >
      {project.name}
    </button>
  );
}

// Idea dropdown — three generation modes
function IdeaButton({
  onGenerate,
  isLoading,
}: {
  onGenerate: (mode: IdeaMode) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
  };

  const choose = (mode: IdeaMode) => {
    setOpen(false);
    onGenerate(mode);
  };

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => setOpen((v) => !v)}
        title="Regenerate page with AI"
        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
          open
            ? "border-[#c9a36a] bg-[#fdf8f0] text-[#8b5e2a]"
            : "border-[#e8e6e1] bg-white text-[#706c63] hover:bg-[#f5f4f0] hover:text-[#1c1917]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isLoading ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#c9a36a] border-t-transparent" />
            <span>Thinking…</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M2.5 9.5l1.4-1.4M8.1 3.9l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span>Idea</span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="shrink-0 opacity-60">
              <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </>
        )}
      </button>

      {open && !isLoading && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-[#e8e6e1] bg-white shadow-lg">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#a09c93]">
            Regenerate with AI
          </div>
          {(
            [
              { mode: "text" as IdeaMode,   label: "Text only",   desc: "Rewrite captions & headings" },
              { mode: "layout" as IdeaMode, label: "Layout only",  desc: "Rearrange photo frames" },
              { mode: "both" as IdeaMode,   label: "Text & Layout", desc: "Full page makeover" },
            ] as const
          ).map(({ mode, label, desc }) => (
            <button
              key={mode}
              type="button"
              onClick={() => choose(mode)}
              className="flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-[#f5f4f0]"
            >
              <span className="text-[12px] font-medium text-[#1c1917]">{label}</span>
              <span className="text-[11px] text-[#a09c93]">{desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar({
  project,
  pageCount,
  editorView,
  onViewChange,
  onExport,
  onGoHome,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showGuides,
  onShowGuidesChange,
  onIdeaGenerate,
  isIdeaLoading,
}: {
  project: Project;
  pageCount: number;
  editorView: EditorView;
  onViewChange: (v: EditorView) => void;
  onExport: () => void;
  onGoHome: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showGuides: boolean;
  onShowGuidesChange: (v: boolean) => void;
  onIdeaGenerate?: (mode: IdeaMode) => void;
  isIdeaLoading?: boolean;
}) {
  const size = getBookSize(project.sizeId);

  return (
    <header className="relative flex h-[52px] shrink-0 items-center border-b border-[#e8e6e1] bg-white px-4">
      {/* Left: logo + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          title="Back to library"
          onClick={onGoHome}
          className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-[#f5f4f0]"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white leading-none"
            style={{ background: "#8b5e2a" }}
          >
            DF
          </span>
          <span className="hidden text-[13px] font-semibold tracking-tight text-[#1c1917] lg:inline" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Daniel.F.Studio
          </span>
        </button>
        <span className="text-[#d9d7d0] text-[14px]">/</span>
        <InlineName project={project} />
        <span className="hidden text-[11px] text-[#a09c93] lg:inline">
          {size.label} · {pageCount} {pageCount === 1 ? "page" : "pages"}
        </span>
      </div>

      {/* Center: Edit / Overview / Preview — pill tabs */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center rounded-full bg-[#f0eeea] p-0.5">
          {(["edit", "overview", "preview"] as EditorView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`rounded-full px-5 py-1.5 text-[12px] font-medium tracking-wide transition-all duration-150 ${
                editorView === v
                  ? "bg-white text-[#1c1917] shadow-sm"
                  : "text-[#706c63] hover:text-[#1c1917]"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Right: undo/redo + idea + guides + export */}
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center rounded-full border border-[#e8e6e1] bg-white">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            className="flex h-8 w-8 items-center justify-center rounded-l-full text-[14px] text-[#706c63] transition-colors hover:bg-[#f5f4f0] hover:text-[#1c1917] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↩
          </button>
          <span className="h-4 w-px bg-[#e8e6e1]" />
          <button
            type="button"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={onRedo}
            className="flex h-8 w-8 items-center justify-center rounded-r-full text-[14px] text-[#706c63] transition-colors hover:bg-[#f5f4f0] hover:text-[#1c1917] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ↪
          </button>
        </div>

        {editorView === "edit" && onIdeaGenerate && (
          <IdeaButton
            onGenerate={onIdeaGenerate}
            isLoading={isIdeaLoading ?? false}
          />
        )}

        {editorView === "edit" && (
          <button
            type="button"
            title={showGuides ? "Hide guides" : "Show guides"}
            onClick={() => onShowGuidesChange(!showGuides)}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
              showGuides
                ? "border-[#c9a36a] bg-[#fdf8f0] text-[#8b5e2a]"
                : "border-[#e8e6e1] bg-white text-[#a09c93] hover:bg-[#f5f4f0]"
            }`}
          >
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none" className="shrink-0">
              <path d="M1 1h11M1 5h11M1 9h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Guides
          </button>
        )}

        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-full border border-[#e8e6e1] bg-white px-4 py-1.5 text-[12px] font-medium text-[#1c1917] transition-colors hover:bg-[#f5f4f0]"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
            <path d="M6.5 2v7M3.5 6l3 3 3-3M2 11h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Save
        </button>
      </div>
    </header>
  );
}
