import { useEffect, useRef, useState } from "react";
import type { Project } from "../model/types";
import { getBookSize } from "../model/bookSizes";
import { db } from "../db/db";
import { renderSpreadToCanvas } from "../export/renderSpread";
import { getTheme } from "../themes/themes";

function formatUpdated(ts: number): string {
  const deltaMs = Date.now() - ts;
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days} d ago`;
  return `Updated ${new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

interface ProjectCardProps {
  project: Project;
  photoCount: number;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function ProjectCard({ project, photoCount, onOpen, onDelete, onDuplicate }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const size = getBookSize(project.sizeId);
  const pageRatio = size.pageWidthMm / size.pageHeightMm;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Render cover thumbnail from the first spread — extract the right page (front cover)
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const allSpreads = await db.spreads
        .where("projectId")
        .equals(project.id)
        .sortBy("index");
      // index 0 = cover spread; right page = front cover
      const coverSpread = allSpreads[0];
      if (cancelled || !coverSpread) return;
      try {
        const theme = getTheme(project.themeId);
        // Render full spread then crop to right half (front cover page)
        // Use "preview" blobs (~1600px) for a crisp card thumbnail.
        const spreadCanvas = await renderSpreadToCanvas(coverSpread, size, theme, 2, "preview");
        if (cancelled) return;
        const halfW = Math.floor(spreadCanvas.width / 2);
        const frontCanvas = document.createElement("canvas");
        frontCanvas.width = halfW;
        frontCanvas.height = spreadCanvas.height;
        const fctx = frontCanvas.getContext("2d");
        if (fctx) fctx.drawImage(spreadCanvas, halfW, 0, halfW, spreadCanvas.height, 0, 0, halfW, spreadCanvas.height);
        frontCanvas.toBlob((blob) => {
          if (cancelled || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setCoverUrl(objectUrl);
        }, "image/jpeg", 0.88);
      } catch { /* leave placeholder on render error */ }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.themeId]);

  return (
    <div className="group relative rounded-xl border border-line bg-surface-1 transition-colors duration-150 hover:border-surface-3">
      <button type="button" onClick={onOpen} className="block w-full rounded-xl p-4 text-left">
        <div
          className="grid place-items-center overflow-hidden rounded-lg bg-surface-2"
          style={{ aspectRatio: `${size.pageWidthMm} / ${size.pageHeightMm}` }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="rounded-[2px] bg-[#f5f2ec] shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
              style={pageRatio >= 1 ? { width: 96, height: 96 / pageRatio } : { width: 96 * pageRatio, height: 96 }}
            />
          )}
        </div>
        <div className="mt-3.5 pr-7">
          <h3 className="truncate font-display text-[15px] text-ink">{project.name}</h3>
          <p className="mt-1 text-[12px] text-ink-dim">
            {size.label} · {project.binding === "layflat" ? "Layflat" : "Standard"}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {photoCount} {photoCount === 1 ? "photo" : "photos"} · {formatUpdated(project.updatedAt)}
          </p>
        </div>
      </button>

      <div ref={menuRef} className="absolute bottom-4 right-3">
        <button
          type="button"
          aria-label={`More actions for ${project.name}`}
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-faint opacity-0 transition-opacity duration-150 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="7" r="1.4" />
            <circle cx="7" cy="7" r="1.4" />
            <circle cx="12" cy="7" r="1.4" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-10 w-44 rounded-lg border border-line bg-surface-2 py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDuplicate();
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-3"
            >
              Duplicate project
            </button>
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-danger hover:bg-surface-3"
            >
              Delete project…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
