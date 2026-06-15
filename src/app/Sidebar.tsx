import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, duplicateProject, deleteProjectCascade } from "../db/db";
import { useAppStore } from "./store";
import { createSpread, deleteSpread, duplicateSpread } from "../db/spreadOps";
import { getBookSize } from "../model/bookSizes";
import { ConfirmDialog } from "./ui";
import { NewProjectDialog } from "../library/NewProjectDialog";
import type { Project, Spread } from "../model/types";

function MiniThumb({ frames, pageWidthMm, pageHeightMm }: {
  frames: Spread["frames"];
  pageWidthMm: number;
  pageHeightMm: number;
}) {
  const W = 30;
  const H = Math.max(4, Math.round(W * pageHeightMm / (pageWidthMm * 2)));
  const sx = W / (pageWidthMm * 2);
  const sy = H / pageHeightMm;
  const s = Math.min(sx, sy);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-hidden rounded-[2px]">
      <rect width={W} height={H} fill="#f0ece4" />
      <line x1={pageWidthMm * s} y1={0} x2={pageWidthMm * s} y2={H} stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
      {frames.map((f) => (
        <rect key={f.id} x={f.x * s} y={f.y * s} width={f.width * s} height={f.height * s}
          fill={f.photoId ? "#6b7280" : "#374151"} rx={0.5} />
      ))}
    </svg>
  );
}

export function Sidebar() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const activeSpreadId = useAppStore((s) => s.activeSpreadId);
  const openProject = useAppStore((s) => s.openProject);
  const goHome = useAppStore((s) => s.goHome);
  const setActiveSpreadId = useAppStore((s) => s.setActiveSpreadId);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [spreadMenuId, setSpreadMenuId] = useState<string | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);
  const [deleteSpreadId, setDeleteSpreadId] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const spreadMenuRef = useRef<HTMLDivElement>(null);

  const projects = useLiveQuery<Project[]>(() =>
    db.projects.orderBy("updatedAt").reverse().toArray()
  );

  const activeProject = useLiveQuery<Project | undefined>(
    () => currentProjectId ? db.projects.get(currentProjectId) : Promise.resolve(undefined),
    [currentProjectId],
  );

  const activeSpreads = useLiveQuery<Spread[]>(
    () => currentProjectId
      ? db.spreads.where("projectId").equals(currentProjectId).sortBy("index")
      : Promise.resolve([] as Spread[]),
    [currentProjectId],
  );

  // Close menus on outside click
  useEffect(() => {
    if (!projectMenuId && !spreadMenuId) return;
    const onDown = (e: MouseEvent) => {
      if (
        projectMenuRef.current?.contains(e.target as Node) ||
        spreadMenuRef.current?.contains(e.target as Node)
      ) return;
      setProjectMenuId(null);
      setSpreadMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [projectMenuId, spreadMenuId]);

  const handleAddSpread = async () => {
    if (!currentProjectId || !activeProject) return;
    const size = getBookSize(activeProject.sizeId);
    const spread = await createSpread(currentProjectId, size, "two-up");
    setActiveSpreadId(spread.id);
  };

  const handleDeleteSpread = async () => {
    if (!deleteSpreadId) return;
    const id = deleteSpreadId;
    setDeleteSpreadId(null);
    await deleteSpread(id);
    if (activeSpreadId === id && activeSpreads) {
      const remaining = activeSpreads.filter((s) => s.id !== id);
      setActiveSpreadId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleDuplicateProject = async (projectId: string) => {
    const newId = await duplicateProject(projectId);
    openProject(newId);
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectTarget) return;
    const id = deleteProjectTarget.id;
    setDeleteProjectTarget(null);
    await deleteProjectCascade(id);
    if (id === currentProjectId) goHome();
  };

  return (
    <aside className="flex w-[232px] shrink-0 select-none flex-col border-r border-line bg-surface-1">
      {/* Workspace header */}
      <div className="shrink-0 px-2 pt-3 pb-2">
        <button
          type="button"
          onClick={goHome}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-[9px] font-bold text-accent-ink leading-none">DF</span>
          <span className="truncate text-[13px] font-semibold tracking-tight text-ink" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Daniel.F.Studio</span>
        </button>
      </div>

      {/* New project action */}
      <div className="shrink-0 px-2 pb-1">
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
            <line x1="6" y1="2" x2="6" y2="10" /><line x1="2" y1="6" x2="10" y2="6" />
          </svg>
          New photobook
        </button>
      </div>

      <div className="mx-2.5 border-t border-line" />

      {/* Projects tree */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {(projects ?? []).length > 0 && (
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            Projects
          </p>
        )}

        {(projects ?? []).map((project) => {
          const isActive = project.id === currentProjectId;
          const pmOpen = projectMenuId === project.id;

          return (
            <div key={project.id}>
              {/* Project row */}
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md py-1 pl-2.5 pr-8 text-left text-[13px] transition-colors mx-0.5 ${
                    isActive ? "bg-surface-2 text-ink" : "text-ink-dim hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <span className="w-3 shrink-0 text-center text-[9px] text-ink-faint">
                    {isActive ? "▾" : "▸"}
                  </span>
                  <span className="truncate">{project.name}</span>
                </button>

                {/* Project kebab */}
                <div ref={pmOpen ? projectMenuRef : undefined} className="absolute right-1 top-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setProjectMenuId(pmOpen ? null : project.id);
                    }}
                    className="grid h-6 w-6 place-items-center rounded text-[13px] text-ink-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
                    aria-label="Project options"
                  >
                    ···
                  </button>
                  {pmOpen && (
                    <div className="absolute right-0 top-7 z-50 w-44 overflow-hidden rounded-lg border border-line bg-surface-2 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
                      <button
                        type="button"
                        onMouseDown={() => { setProjectMenuId(null); void handleDuplicateProject(project.id); }}
                        className="block w-full px-3 py-2 text-left text-[12px] text-ink-dim hover:bg-surface-3 hover:text-ink"
                      >
                        Duplicate project
                      </button>
                      <div className="my-1 border-t border-line" />
                      <button
                        type="button"
                        onMouseDown={() => { setProjectMenuId(null); setDeleteProjectTarget(project); }}
                        className="block w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-surface-3"
                      >
                        Delete project…
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Spread sub-items */}
              {isActive && activeSpreads && activeProject && (() => {
                const size = getBookSize(activeProject.sizeId);
                return (
                  <div className="pb-0.5">
                    {activeSpreads.map((spread, idx) => {
                      const isSActive = spread.id === activeSpreadId;
                      const smOpen = spreadMenuId === spread.id;
                      return (
                        <div key={spread.id} className="group/spread relative">
                          <button
                            type="button"
                            onClick={() => setActiveSpreadId(spread.id)}
                            className={`flex w-full items-center gap-2 rounded-md py-[3px] pl-7 pr-8 text-left text-[12px] transition-colors mx-0.5 ${
                              isSActive
                                ? "bg-accent/12 text-accent"
                                : "text-ink-faint hover:bg-surface-2 hover:text-ink-dim"
                            }`}
                          >
                            <MiniThumb
                              frames={spread.frames}
                              pageWidthMm={size.pageWidthMm}
                              pageHeightMm={size.pageHeightMm}
                            />
                            <span>Page {idx + 1}</span>
                          </button>

                          {/* Spread kebab */}
                          <div ref={smOpen ? spreadMenuRef : undefined} className="absolute right-1 top-0">
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setSpreadMenuId(smOpen ? null : spread.id);
                              }}
                              className="grid h-6 w-6 place-items-center rounded text-[12px] text-ink-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink group-hover/spread:opacity-100"
                              aria-label="Spread options"
                            >
                              ···
                            </button>
                            {smOpen && (
                              <div className="absolute right-0 top-7 z-50 w-40 overflow-hidden rounded-lg border border-line bg-surface-2 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
                                <button
                                  type="button"
                                  onMouseDown={() => { setSpreadMenuId(null); void duplicateSpread(spread.id); }}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-ink-dim hover:bg-surface-3 hover:text-ink"
                                >
                                  Duplicate
                                </button>
                                <div className="my-1 border-t border-line" />
                                <button
                                  type="button"
                                  onMouseDown={() => { setSpreadMenuId(null); setDeleteSpreadId(spread.id); }}
                                  className="block w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-surface-3"
                                >
                                  Delete…
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => void handleAddSpread()}
                      className="flex w-full items-center gap-1.5 rounded-md py-[3px] pl-7 pr-3 text-left text-[11px] text-ink-faint transition-colors hover:text-ink-dim mx-0.5"
                    >
                      <span>+</span>
                      <span>Add page</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Admin panel link */}
      <div className="shrink-0 border-t border-line px-2 py-2">
        <a
          href="/?admin=true"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
          </svg>
          Admin panel
        </a>
      </div>

      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <ConfirmDialog
        open={deleteProjectTarget !== null}
        title="Delete project?"
        body={
          <>
            <span className="text-ink">{deleteProjectTarget?.name}</span> and all its photos and spreads will be
            permanently removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        onConfirm={() => void handleDeleteProject()}
        onCancel={() => setDeleteProjectTarget(null)}
      />

      <ConfirmDialog
        open={deleteSpreadId !== null}
        title="Delete spread?"
        body="This page has photos assigned. Delete it anyway? The photos remain in the library."
        confirmLabel="Delete page"
        onConfirm={() => void handleDeleteSpread()}
        onCancel={() => setDeleteSpreadId(null)}
      />
    </aside>
  );
}
