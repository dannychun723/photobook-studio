import { useState, useEffect } from "react";
import { Dialog, Button } from "../app/ui";
import { hasApiKey, saveApiKey, clearApiKey } from "../ai/client";
import { runAIDesign, type AIProgress } from "../ai/runAIDesign";
import type { BookSize, ThemeId, Spread } from "../model/types";
import { OCCASION_LABELS, type Occasion, LAYOUT_STYLES, type LayoutStyle } from "../ai/types";
import { TEMPLATES } from "../layout/templates";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { getTheme } from "../themes/themes";
import { renderSpreadToCanvas } from "../export/renderSpread";

const OCCASIONS: Occasion[] = ["wedding", "portrait", "travel", "family", "event", "newborn"];
const LAYOUT_STYLE_KEYS: LayoutStyle[] = ["editorial", "gallery", "storyteller"];

const OCCASION_EMOJI: Record<Occasion, string> = {
  wedding: "💍",
  portrait: "📸",
  travel: "✈️",
  family: "👨‍👩‍👧‍👦",
  event: "🎉",
  newborn: "👶",
};

function clampSpreads(n: number) {
  return Math.max(1, Math.min(40, n));
}

function autoSpreads(photoCount: number): number {
  return clampSpreads(Math.ceil(photoCount / 2.5));
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  size: BookSize;
  themeId: ThemeId;
}

type Screen = "setup" | "nokey" | "running" | "preview" | "error";

function KeySetupScreen({ onSaved }: { onSaved: () => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed.startsWith("sk-ant-") || trimmed.length < 20) {
      setErr("Key should start with sk-ant- and be at least 20 characters.");
      return;
    }
    saveApiKey(trimmed);
    onSaved();
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-dim">
        Paste your Anthropic API key below. It will be saved in your browser's local storage — you won't need to enter it again.
      </p>
      <div>
        <input
          type="password"
          autoFocus
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="sk-ant-..."
          className="w-full rounded-lg border border-line bg-surface-0 px-3 py-2.5 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        {err && <p className="mt-1.5 text-[12px] text-danger">{err}</p>}
      </div>
      <p className="text-[11px] text-ink-faint">
        Get your key at{" "}
        <span className="font-mono text-ink-dim">console.anthropic.com</span>
        {" "}→ API Keys. The key is stored locally and never sent anywhere except to the Anthropic API.
      </p>
      <div className="flex justify-end gap-2">
        <Button disabled={!draft.trim()} variant="primary" onClick={handleSave}>
          Save key &amp; continue
        </Button>
      </div>
    </div>
  );
}

function PhaseLabel({ p }: { p: AIProgress }) {
  if (p.phase === "analyzing") {
    const pct = p.totalPhotos && p.analyzed != null
      ? Math.round((p.analyzed / p.totalPhotos) * 100)
      : 0;
    return (
      <div className="text-center">
        <p className="text-[14px] font-medium text-ink">Analyzing photos…</p>
        <p className="mt-1 text-[12px] text-ink-faint">
          {p.analyzed ?? 0} / {p.totalPhotos ?? "?"} photos analyzed
        </p>
        <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
  if (p.phase === "designing") {
    return (
      <div className="text-center">
        <p className="text-[14px] font-medium text-ink">Crafting your story…</p>
        <p className="mt-1 text-[12px] text-ink-faint">Sequencing chapters and pacing layouts</p>
        <div className="mt-3 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-accent"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (p.phase === "writing") {
    return (
      <div className="text-center">
        <p className="text-[14px] font-medium text-ink">Building your photobook…</p>
        <p className="mt-1 text-[12px] text-ink-faint">Laying out spreads and placing photos</p>
      </div>
    );
  }
  return null;
}

function SpreadPreviewGrid({
  projectId,
  themeId,
  size,
}: {
  projectId: string;
  themeId: ThemeId;
  size: BookSize;
}) {
  const spreads = useLiveQuery<Spread[]>(
    () => db.spreads.where("projectId").equals(projectId).sortBy("index"),
    [projectId],
  );
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    setThumbs({}); // clear stale thumbnails from previous generation
    if (!spreads?.length) return;
    const theme = getTheme(themeId);
    let cancelled = false;
    for (const s of spreads) {
      renderSpreadToCanvas(s, size, theme, 0.9, "thumb")
        .then((canvas) => {
          if (cancelled) return;
          setThumbs((prev) => ({ ...prev, [s.id]: canvas.toDataURL("image/jpeg", 0.82) }));
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [spreads, themeId, size]);

  if (!spreads?.length) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-line bg-surface-0">
        <span className="text-[12px] text-ink-faint">Loading spreads…</span>
      </div>
    );
  }

  return (
    <div className="grid max-h-[48vh] grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-line bg-surface-0 p-2">
      {spreads.map((s, i) => (
        <div key={s.id} className="relative overflow-hidden rounded bg-surface-2">
          {thumbs[s.id] ? (
            <img src={thumbs[s.id]} alt={`Spread ${i + 1}`} className="w-full" />
          ) : (
            <div className="flex h-16 items-center justify-center">
              <span className="text-[11px] text-ink-faint">Rendering…</span>
            </div>
          )}
          <span className="absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AIDesignDialog({ open, onClose, projectId, size, themeId }: Props) {
  const [occasion, setOccasion] = useState<Occasion>("wedding");
  const [userDescription, setUserDescription] = useState<string>(
    () => localStorage.getItem(`pb_ai_desc_${projectId}`) ?? "",
  );
  const handleDescriptionChange = (v: string) => {
    setUserDescription(v);
    localStorage.setItem(`pb_ai_desc_${projectId}`, v);
  };
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>("storyteller");
  const [spreadCount, setSpreadCount] = useState<number | "auto">("auto");
  const [singleSpreadTemplateId, setSingleSpreadTemplateId] = useState<string | undefined>(undefined);
  const [socialMode, setSocialMode] = useState(false);
  const [screen, setScreen] = useState<Screen>(hasApiKey() ? "setup" : "nokey");
  const [progress, setProgress] = useState<AIProgress>({ phase: "analyzing" });
  const [errorMsg, setErrorMsg] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);

  const photoCount = useLiveQuery(
    () => db.photos.where("projectId").equals(projectId).count(),
    [projectId],
    0,
  ) ?? 0;

  const maxSlides = socialMode ? 12 : 40;
  const autoSlideCount = socialMode
    ? Math.min(10, Math.ceil(photoCount / 2))
    : autoSpreads(photoCount);
  const resolvedSpreads = Math.min(
    spreadCount === "auto" ? autoSlideCount : spreadCount,
    maxSlides,
  );
  const slideLabel = socialMode ? "slide" : "spread";

  const handleClose = () => {
    if (screen === "running") return;
    setAttemptCount(0);
    setScreen(hasApiKey() ? "setup" : "nokey");
    setProgress({ phase: "analyzing" });
    setErrorMsg("");
    onClose();
  };

  const handleGenerate = async () => {
    if (photoCount === 0) {
      setErrorMsg("Import photos first — there are no photos in this project.");
      setScreen("error");
      return;
    }
    const thisAttempt = attemptCount;
    setScreen("running");

    // Prepend social mode directive so the AI knows to optimize for carousel
    const socialPrefix = socialMode
      ? "SOCIAL MEDIA CAROUSEL MODE: Design for Instagram/social upload. Each slide should be visually self-contained and impactful as a standalone image. Prefer full-bleed, hero, and grid layouts over text-heavy ones. Keep captions short and punchy. Avoid text-left-photo-right spreads. Use bold backgrounds and grain effects sparingly for drama. "
      : "";
    const effectiveDescription = (socialPrefix + (userDescription.trim())).trim() || undefined;

    try {
      await runAIDesign(
        projectId,
        occasion,
        resolvedSpreads,
        size,
        themeId,
        (p) => setProgress(p),
        layoutStyle,
        resolvedSpreads === 1 ? singleSpreadTemplateId : undefined,
        thisAttempt,
        effectiveDescription,
      );
      setAttemptCount((n) => n + 1);
      setScreen("preview");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setScreen("error");
    }
  };

  const pulse = (
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 0.3; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1); }
      }
    `}</style>
  );

  return (
    <>
    {/* ── Preview popup (wide) ────────────────────────────────── */}
    <Dialog
      open={open && screen === "preview"}
      onClose={handleClose}
      title="Preview your photobook"
      widthClass="w-[860px]"
    >
      <div className="space-y-4">
        <p className="text-[12px] text-ink-faint">
          All generated spreads are shown below. Approve to start editing, or regenerate for a fresh design.
        </p>
        <SpreadPreviewGrid projectId={projectId} themeId={themeId} size={size} />
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-ink-faint">
            Regenerate uses the same settings but produces a distinctly different result.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button onClick={() => void handleGenerate()}>↺ Regenerate</Button>
            <Button variant="primary" onClick={handleClose}>✓ Start editing</Button>
          </div>
        </div>
      </div>
    </Dialog>

    {/* ── Setup / running / error dialog (narrow) ─────────────── */}
    <Dialog open={open && screen !== "preview"} onClose={handleClose} title="AI Design Everything" widthClass="w-[480px]">
      {screen === "nokey" && (
        <KeySetupScreen onSaved={() => setScreen("setup")} />
      )}

      {screen === "setup" && (
        <div className="flex flex-col gap-5">
        <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">
          {/* API key status */}
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-[12px] text-ink-dim">
              <span className="text-green-400">✓</span> API key saved
            </p>
            <button
              type="button"
              onClick={() => { clearApiKey(); setScreen("nokey"); }}
              className="text-[11px] text-ink-faint hover:text-ink-dim hover:underline"
            >
              Change
            </button>
          </div>

          {photoCount === 0 && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
              <p className="text-[12px] text-amber-400">No photos yet — import photos before generating.</p>
            </div>
          )}

          {/* Occasion picker */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-ink-dim">Occasion</label>
            <div className="grid grid-cols-3 gap-2">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setOccasion(occ)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors duration-150 ${
                    occasion === occ
                      ? "border-accent bg-surface-2 text-ink"
                      : "border-line bg-surface-0 text-ink-dim hover:bg-surface-2"
                  }`}
                >
                  <span className="text-xl">{OCCASION_EMOJI[occ]}</span>
                  <span className="text-[11px] font-medium leading-tight">{OCCASION_LABELS[occ]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Creative brief */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-ink-dim">
              Creative brief <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <textarea
              value={userDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Describe the mood, style, or story — e.g. golden hour ceremony, intimate candid moments, film-photography aesthetic…"
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-lg border border-line bg-surface-0 px-3 py-2.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            {userDescription.length > 800 && (
              <p className="mt-1 text-right text-[10px] text-ink-faint">{userDescription.length}/1000</p>
            )}
          </div>

          {/* Layout Style */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-ink-dim">Layout Style</label>
            <div className="space-y-2">
              {LAYOUT_STYLE_KEYS.map((style) => {
                const cfg = LAYOUT_STYLES[style];
                const active = layoutStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setLayoutStyle(style)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                      active
                        ? "border-accent bg-surface-2"
                        : "border-line bg-surface-0 hover:bg-surface-1"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[12px] font-medium ${active ? "text-ink" : "text-ink-dim"}`}>
                          {cfg.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">{cfg.tagline}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-ink-faint">img : space</p>
                        <p className={`text-[11px] font-medium tabular-nums ${active ? "text-accent" : "text-ink-faint"}`}>
                          {cfg.ratio}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Social mode toggle */}
          <div className="rounded-lg border border-line bg-surface-0 px-3 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={socialMode}
                  onChange={(e) => {
                    setSocialMode(e.target.checked);
                    setSpreadCount("auto");
                  }}
                  className="h-4 w-4 accent-[#c9a36a]"
                />
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink">
                  📱 Social Media Carousel
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Optimizes each slide for Instagram — tighter layouts, bolder visuals, captions over text pages. Max 12 slides.
                </p>
              </div>
            </label>
          </div>

          {/* Spread / slide count */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-ink-dim">
              {socialMode ? "Slides" : "Spreads"}{" "}
              <span className="font-normal text-ink-faint">
                ({spreadCount === "auto" ? `auto: ${resolvedSpreads} from ${photoCount} photos` : `${resolvedSpreads} ${slideLabel}${resolvedSpreads === 1 ? "" : "s"}`})
              </span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={maxSlides}
                step={1}
                value={resolvedSpreads}
                onChange={(e) => setSpreadCount(parseInt(e.target.value))}
                className="flex-1 accent-[#c9a36a]"
              />
              <span className="w-8 text-center text-[13px] font-medium text-ink">{resolvedSpreads}</span>
              {spreadCount !== "auto" && (
                <button
                  type="button"
                  onClick={() => setSpreadCount("auto")}
                  className="text-[11px] text-accent hover:underline"
                >
                  Auto
                </button>
              )}
            </div>
            {resolvedSpreads === 1 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-medium text-ink-dim">Template for this spread</p>
                <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-surface-0 p-2">
                  <button
                    type="button"
                    onClick={() => setSingleSpreadTemplateId(undefined)}
                    className={`rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                      singleSpreadTemplateId === undefined
                        ? "bg-accent text-accent-ink"
                        : "text-ink-dim hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <span className="block font-medium leading-tight">Auto</span>
                    <span className="block text-[10px] opacity-70">densest fit</span>
                  </button>
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSingleSpreadTemplateId(t.id)}
                      className={`rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                        singleSpreadTemplateId === t.id
                          ? "bg-accent text-accent-ink"
                          : "text-ink-dim hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <span className="block font-medium leading-tight">{t.name}</span>
                      <span className="block text-[10px] opacity-70">{t.slots} slot{t.slots !== 1 ? "s" : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-surface-2 px-3 py-2.5">
            <p className="text-[11.5px] text-ink-faint">
              ⚠ This will replace all current {slideLabel}s. Your photos won't be affected and you can edit the result freely.
              {socialMode && " Use Export → Social Media Carousel to download the slides."}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={photoCount === 0}
            onClick={() => void handleGenerate()}
          >
            {socialMode ? "Generate carousel" : "Generate photobook"}
          </Button>
        </div>
        </div>
      )}

      {screen === "running" && (
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
            <span className="text-2xl">✨</span>
          </div>
          <PhaseLabel p={progress} />
          <p className="text-[11px] text-ink-faint">This may take a minute for large photo sets.</p>
        </div>
      )}

      {screen === "error" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
            <p className="text-[13px] font-medium text-danger">Generation failed</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-danger/80">{errorMsg}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setScreen("setup")}>Back</Button>
            <Button variant="primary" onClick={() => void handleGenerate()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {pulse}
    </Dialog>
    </>
  );
}
