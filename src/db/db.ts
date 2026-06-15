import Dexie, { type Table } from "dexie";
import type { Photo, Project, Spread } from "../model/types";

// Blobs live in their own table so listing photos never loads image data.
export interface PhotoBlobs {
  photoId: string;
  original: Blob; // untouched upload — used for print-resolution export only
  preview: Blob; // ≈1600px JPEG — canvas editing
  thumb: Blob; // ≈320px JPEG — tray/library
}

// Phase 6 (schema reserved now so later migrations stay additive)
export interface LibraryItem {
  id: string;
  projectId: string;
  name: string;
  themeId: string;
  pageCount: number;
  exportedAt: number;
  cover: Blob;
}

class PhotoBookDB extends Dexie {
  projects!: Table<Project, string>;
  photos!: Table<Photo, string>;
  photoBlobs!: Table<PhotoBlobs, string>;
  spreads!: Table<Spread, string>;
  libraryItems!: Table<LibraryItem, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt",
      photos: "id, projectId, [projectId+importedAt]",
      photoBlobs: "photoId",
      spreads: "id, projectId, [projectId+index]",
      libraryItems: "id, exportedAt",
    });
  }
}

// Initialized by initDatabase() in main.tsx before any component mounts.
// ES module live bindings mean all importers automatically see the updated instance.
export let db: PhotoBookDB = null!;

export function initDatabase(name: string): void {
  db = new PhotoBookDB(name);
}

export async function deleteProjectCascade(projectId: string): Promise<void> {
  await db.transaction("rw", [db.projects, db.photos, db.photoBlobs, db.spreads], async () => {
    const photoIds = await db.photos.where("projectId").equals(projectId).primaryKeys();
    await db.photoBlobs.bulkDelete(photoIds);
    await db.photos.where("projectId").equals(projectId).delete();
    await db.spreads.where("projectId").equals(projectId).delete();
    await db.projects.delete(projectId);
  });
}

export async function touchProject(projectId: string): Promise<void> {
  await db.projects.update(projectId, { updatedAt: Date.now() });
}

export async function duplicateProject(projectId: string): Promise<string> {
  const { nanoid } = await import("nanoid");
  const now = Date.now();

  const [project, spreads] = await Promise.all([
    db.projects.get(projectId),
    db.spreads.where("projectId").equals(projectId).sortBy("index"),
  ]);
  if (!project) throw new Error("Project not found");

  const newProjectId = nanoid();
  const newProject: Project = {
    ...project,
    id: newProjectId,
    name: `${project.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };

  const newSpreads: Spread[] = spreads.map((spread) => ({
    ...spread,
    id: nanoid(),
    projectId: newProjectId,
  }));

  await db.transaction("rw", [db.projects, db.spreads], async () => {
    await db.projects.add(newProject);
    await db.spreads.bulkAdd(newSpreads);
  });

  return newProjectId;
}
