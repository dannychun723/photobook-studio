import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteProjectCascade, duplicateProject } from "../db/db";
import type { Project } from "../model/types";
import { useAppStore } from "../app/store";
import { Button, ConfirmDialog } from "../app/ui";
import { ProjectCard } from "./ProjectCard";
import { NewProjectDialog } from "./NewProjectDialog";

interface ProjectWithCount {
  project: Project;
  photoCount: number;
}

export function ProjectsHome() {
  const openProject = useAppStore((s) => s.openProject);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const projects = useLiveQuery<ProjectWithCount[]>(async () => {
    const list = await db.projects.orderBy("updatedAt").reverse().toArray();
    const counts = await Promise.all(list.map((p) => db.photos.where("projectId").equals(p.id).count()));
    return list.map((project, i) => ({ project, photoCount: counts[i] }));
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteProjectCascade(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDuplicate = async (projectId: string) => {
    const newId = await duplicateProject(projectId);
    openProject(newId);
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto max-w-5xl px-8 py-10">
        {projects === undefined ? null : projects.length === 0 ? (
          <div className="flex h-[calc(100vh-120px)] flex-col items-center justify-center text-center">
            <div className="grid h-20 w-28 rotate-[-3deg] place-items-center rounded-md bg-surface-2 shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
              <div className="h-14 w-14 rounded-[2px] bg-[#f5f2ec]" />
            </div>
            <h2 className="mt-8 font-display text-xl text-ink">Begin your first book</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-dim">
              Create a photobook, import your client photos, and design every spread — all stored locally on this machine.
            </p>
            <Button variant="primary" className="mt-6" onClick={() => setDialogOpen(true)}>
              New photobook
            </Button>
          </div>
        ) : (
          <>
            <h2 className="mb-6 text-2xl font-medium tracking-tight text-ink" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>All projects</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
              {projects.map(({ project, photoCount }) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  photoCount={photoCount}
                  onOpen={() => openProject(project.id)}
                  onDelete={() => setDeleteTarget(project)}
                  onDuplicate={() => void handleDuplicate(project.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="grid min-h-[300px] place-items-center rounded-xl border border-dashed border-line text-ink-faint transition-colors hover:border-accent hover:text-accent"
              >
                <span className="flex flex-col items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-current text-lg leading-none">+</span>
                  <span className="text-[13px]">New photobook</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <NewProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project?"
        body={
          <>
            <span className="text-ink">{deleteTarget?.name}</span> and all of its imported photos and spreads will be
            permanently removed from this machine. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
