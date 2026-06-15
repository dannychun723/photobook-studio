import { useState } from "react";
import { Dialog, Button } from "../app/ui";
import type { BookSize, Project, Spread } from "../model/types";
import type { ThemeTokens } from "../themes/themes";
import { downloadSpreadPNG, downloadSinglePageJPEG, exportSocialSlides, printBook, type SocialFormat } from "../export/exportBook";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project;
  activeSpread: Spread | null;
  spreads: Spread[];
  size: BookSize;
  theme: ThemeTokens;
}

type Phase = "idle" | "rendering" | "done" | "error";

export function ExportDialog({ open, onClose, project, activeSpread, spreads, size, theme }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [socialFormat, setSocialFormat] = useState<SocialFormat>("square");
  const [singleSide, setSingleSide] = useState<"left" | "right">("right");
  const [exportQuality, setExportQuality] = useState<"original" | "preview">("original");

  const reset = () => { setPhase("idle"); setErrorMsg(""); };

  const handleClose = () => { reset(); onClose(); };

  const handlePNG = async () => {
    if (!activeSpread) return;
    setPhase("rendering");
    setProgress({ done: 0, total: 1 });
    try {
      const name = `${project.name} — Spread ${activeSpread.index + 1}.png`;
      await downloadSpreadPNG(activeSpread, size, theme, name, exportQuality);
      setProgress({ done: 1, total: 1 });
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const handleSinglePage = async () => {
    if (!activeSpread) return;
    setPhase("rendering");
    setProgress({ done: 0, total: 1 });
    try {
      const sideLabel = activeSpread.index === 0
        ? (singleSide === "left" ? "Back Cover" : "Front Cover")
        : (singleSide === "left" ? "Left" : "Right");
      const name = `${project.name} — ${sideLabel} (Page ${activeSpread.index + 1}).jpg`;
      await downloadSinglePageJPEG(activeSpread, size, theme, singleSide, name, exportQuality);
      setProgress({ done: 1, total: 1 });
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const handlePrint = async () => {
    if (spreads.length === 0) return;
    setPhase("rendering");
    setProgress({ done: 0, total: spreads.length });
    try {
      await printBook(spreads, size, theme, project.name, (done, total) => {
        setProgress({ done, total });
      });
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const isCover = activeSpread?.index === 0;
  const leftLabel  = isCover ? "Back Cover"  : "Left page";
  const rightLabel = isCover ? "Front Cover" : "Right page";

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onClose={handleClose} title="Export" widthClass="w-[420px]">
      {phase === "idle" && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-dim">
            {spreads.length} {spreads.length === 1 ? "spread" : "spreads"} · {project.name}
          </p>

          {/* Resolution toggle — applies to PNG and JPEG downloads */}
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-ink">Resolution</span>
              <div className="flex gap-1.5">
                {(["original", "preview"] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setExportQuality(q)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                      exportQuality === q
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line text-ink-faint hover:border-surface-3 hover:text-ink"
                    }`}
                  >
                    {q === "original" ? "Full (Recommended)" : "Compressed"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {exportQuality === "original"
                ? "Uses original uploaded photos — full quality, larger file"
                : "Uses preview photos — smaller file, faster to generate"}
            </p>
          </div>

          {/* Double-page spread PNG */}
          <button
            type="button"
            disabled={!activeSpread}
            onClick={() => void handlePNG()}
            className="flex w-full items-start gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-left transition-colors hover:border-surface-3 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="mt-0.5 text-xl">🖼</span>
            <div>
              <p className="text-[13px] font-medium text-ink">Download Spread (PNG)</p>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                Double page · current spread · {exportQuality === "original" ? "~200 DPI · full quality" : "~100 DPI · compressed"}
              </p>
            </div>
          </button>

          {/* Single page download */}
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3.5">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 text-xl">📋</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">Download Single Page (JPEG)</p>
                <p className="mt-0.5 text-[12px] text-ink-faint">
                  One page from the current spread
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  {(["left", "right"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setSingleSide(side)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                        singleSide === side
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line text-ink-faint hover:border-surface-3 hover:text-ink"
                      }`}
                    >
                      {side === "left" ? leftLabel : rightLabel}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!activeSpread}
                  onClick={() => void handleSinglePage()}
                  className="mt-2.5 rounded-lg border border-accent/60 bg-accent/10 px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download {singleSide === "left" ? leftLabel : rightLabel} →
                </button>
              </div>
            </div>
          </div>

          {/* PDF — all spreads via print */}
          <button
            type="button"
            disabled={spreads.length === 0}
            onClick={() => void handlePrint()}
            className="flex w-full items-start gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-left transition-colors hover:border-surface-3 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="mt-0.5 text-xl">📄</span>
            <div>
              <p className="text-[13px] font-medium text-ink">Print / Save as PDF</p>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                All {spreads.length} spreads · opens print dialog
              </p>
            </div>
          </button>

          {/* Social media — Instagram / stories */}
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3.5">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 text-xl">📱</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">Social Media Carousel</p>
                <p className="mt-0.5 text-[12px] text-ink-faint">
                  Download all {spreads.length} spreads as individual slides for Instagram/social
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  {(["square", "portrait", "story"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setSocialFormat(fmt)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                        socialFormat === fmt
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line text-ink-faint hover:border-surface-3 hover:text-ink"
                      }`}
                    >
                      {fmt === "square" ? "1:1 Square" : fmt === "portrait" ? "4:5 Portrait" : "9:16 Story"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={spreads.length === 0}
                  onClick={() => {
                    if (spreads.length === 0) return;
                    setPhase("rendering");
                    setProgress({ done: 0, total: spreads.length });
                    void exportSocialSlides(spreads, size, theme, socialFormat, project.name, (done, total) => {
                      setProgress({ done, total });
                      if (done === total) setPhase("done");
                    }).catch((e) => {
                      setErrorMsg(e instanceof Error ? e.message : String(e));
                      setPhase("error");
                    });
                  }}
                  className="mt-2.5 rounded-lg border border-accent/60 bg-accent/10 px-3 py-1.5 text-[12px] text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download {spreads.length} slides →
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}

      {phase === "rendering" && (
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
            <span className="text-xl">⏳</span>
          </div>
          <div>
            <p className="text-[14px] font-medium text-ink">Rendering…</p>
            {progress.total > 1 && (
              <p className="mt-1 text-[12px] text-ink-faint">
                {progress.done} / {progress.total} spreads
              </p>
            )}
          </div>
          {progress.total > 1 && (
            <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <p className="text-[11px] text-ink-faint">This may take a moment for large books.</p>
        </div>
      )}

      {phase === "done" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
            <span className="text-xl">✓</span>
          </div>
          <p className="text-[14px] font-medium text-ink">Done!</p>
          <div className="flex gap-2">
            <Button onClick={reset}>Export more</Button>
            <Button variant="primary" onClick={handleClose}>Close</Button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
            <p className="text-[13px] font-medium text-danger">Export failed</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-danger/80">{errorMsg}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={reset}>Back</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
