import { useState } from "react";
import { nanoid } from "nanoid";
import { db } from "../db/db";
import { BOOK_SIZES, DEFAULT_SIZE_ID } from "../model/bookSizes";
import type { Binding, Project } from "../model/types";
import { useAppStore } from "../app/store";
import { Button, Dialog } from "../app/ui";

// Visual size cards are drawn at the true page aspect ratio so the picker
// communicates book shape, not just dimensions (R-O6: shape matters; square
// default is the most forgiving for mixed-orientation shoots).
const SHAPE_BOX = 56; // px bounding box for the page-shape glyph

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const openProject = useAppStore((s) => s.openProject);
  const [name, setName] = useState("");
  const [sizeId, setSizeId] = useState(DEFAULT_SIZE_ID);
  const [binding, setBinding] = useState<Binding>("standard");
  const [creating, setCreating] = useState(false);

  const close = () => {
    setName("");
    setSizeId(DEFAULT_SIZE_ID);
    setBinding("standard");
    onClose();
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const now = Date.now();
      const project: Project = {
        id: nanoid(),
        name: trimmed,
        sizeId,
        binding,
        themeId: "modern",
        createdAt: now,
        updatedAt: now,
      };
      await db.projects.add(project);
      close();
      openProject(project.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title="New photobook" widthClass="w-[560px]">
      <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Project name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
        }}
        placeholder="e.g. Hartmann Wedding 2026"
        className="w-full rounded-lg border border-line bg-surface-0 px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />

      <div className="mt-5">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-dim">Book size</span>
        <div className="grid grid-cols-4 gap-2">
          {BOOK_SIZES.map((size) => {
            const ratio = size.pageWidthMm / size.pageHeightMm;
            const w = ratio >= 1 ? SHAPE_BOX : SHAPE_BOX * ratio;
            const h = ratio >= 1 ? SHAPE_BOX / ratio : SHAPE_BOX;
            const selected = sizeId === size.id;
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => setSizeId(size.id)}
                className={`flex flex-col items-center gap-2 rounded-lg border px-2 pb-2.5 pt-3 transition-colors duration-150 ${
                  selected
                    ? "border-accent bg-surface-2"
                    : "border-line bg-surface-0 hover:border-surface-3 hover:bg-surface-2"
                }`}
              >
                <span className="grid place-items-center" style={{ width: SHAPE_BOX, height: SHAPE_BOX }}>
                  <span
                    className={`rounded-[2px] ${selected ? "bg-accent/90" : "bg-ink-faint/60"}`}
                    style={{ width: w, height: h }}
                  />
                </span>
                <span className={`text-center text-[11px] leading-snug ${selected ? "text-ink" : "text-ink-dim"}`}>
                  {size.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-dim">Binding</span>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              // Gutter rules per R-W5: standard binding swallows the spread center.
              { id: "standard", label: "Standard", hint: "Keep faces and key subjects off the center gutter." },
              { id: "layflat", label: "Layflat", hint: "Pages open flat — subjects can cross the spread center." },
            ] as const
          ).map((opt) => {
            const selected = binding === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBinding(opt.id)}
                className={`rounded-lg border px-3.5 py-3 text-left transition-colors duration-150 ${
                  selected
                    ? "border-accent bg-surface-2"
                    : "border-line bg-surface-0 hover:border-surface-3 hover:bg-surface-2"
                }`}
              >
                <span className={`block text-[13px] font-medium ${selected ? "text-ink" : "text-ink-dim"}`}>
                  {opt.label}
                </span>
                <span className="mt-1 block text-[11.5px] leading-snug text-ink-faint">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" disabled={!name.trim() || creating} onClick={() => void create()}>
          Create photobook
        </Button>
      </div>
    </Dialog>
  );
}
