import { useEffect, useRef, useState } from "react";
import { db } from "../db/db";
import type { ThemeId } from "../model/types";
import { THEMES } from "./themes";

interface ThemeSwitcherProps {
  projectId: string;
  currentThemeId: ThemeId;
}

export function ThemeSwitcher({ projectId, currentThemeId }: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ right: window.innerWidth - r.right, top: r.bottom + 6 });
    const onDown = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const apply = async (themeId: ThemeId) => {
    if (themeId === currentThemeId) { setOpen(false); return; }
    setApplying(true);
    await db.projects.update(projectId, { themeId, updatedAt: Date.now() });
    setApplying(false);
    setOpen(false);
  };

  const current = THEMES.find((t) => t.id === currentThemeId) ?? THEMES[0];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={applying}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
          open
            ? "border-accent bg-surface-2 text-ink"
            : "border-line text-ink-dim hover:bg-surface-2 hover:text-ink"
        }`}
      >
        {/* Swatch dot showing current theme paper color */}
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-line"
          style={{ background: current.swatch }}
        />
        <span>{current.label}</span>
        <span className="text-[10px] text-ink-faint">▾</span>
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          className="fixed z-[300] w-64 overflow-hidden rounded-xl border border-line bg-surface-1 shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
          style={{ right: pos.right, top: pos.top }}
        >
          <div className="border-b border-line px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint">Theme</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">Paper color changes instantly · borders & fonts apply to placed frames</p>
          </div>
          <div className="py-1">
            {THEMES.map((theme) => {
              const isActive = theme.id === currentThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => void apply(theme.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${
                    isActive ? "bg-surface-2" : ""
                  }`}
                >
                  {/* Mini spread swatch */}
                  <span className="relative h-8 w-14 shrink-0 overflow-hidden rounded border border-line/60">
                    <span
                      className="absolute inset-0"
                      style={{ background: theme.background }}
                    />
                    {/* Simulated photo blocks */}
                    <span
                      className="absolute"
                      style={{
                        left: "8%", top: "12%", width: "40%", height: "76%",
                        background: theme.swatchAccent + "22",
                        border: `0.5px solid ${theme.swatchAccent}33`,
                      }}
                    />
                    <span
                      className="absolute"
                      style={{
                        left: "54%", top: "12%", width: "38%", height: "35%",
                        background: theme.swatchAccent + "22",
                        border: `0.5px solid ${theme.swatchAccent}33`,
                      }}
                    />
                    <span
                      className="absolute"
                      style={{
                        left: "54%", top: "53%", width: "38%", height: "35%",
                        background: theme.swatchAccent + "22",
                        border: `0.5px solid ${theme.swatchAccent}33`,
                      }}
                    />
                    {/* Gutter line */}
                    <span
                      className="absolute inset-y-0"
                      style={{ left: "50%", width: "0.5px", background: theme.swatchAccent + "20" }}
                    />
                  </span>

                  <span className="flex flex-col gap-0.5">
                    <span className={`text-[13px] font-medium ${isActive ? "text-accent" : "text-ink"}`}>
                      {theme.label}
                    </span>
                    <span className="text-[11px] text-ink-faint">{theme.description}</span>
                  </span>

                  {isActive && (
                    <span className="ml-auto shrink-0 text-[10px] text-accent">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
