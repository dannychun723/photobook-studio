import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { db } from "../db/db";
import { hasApiKey, saveApiKey, clearApiKey } from "../ai/client";
import { runAIDesign, type AIProgress } from "../ai/runAIDesign";
import { applyBookDesign, applyTemplateToSpread, setSpreadBorderDefault, updateSpread } from "../db/spreadOps";
import { TEMPLATES, templateCtx, type LayoutTemplate } from "../layout/templates";
import { BOOK_DESIGNS, type BookDesignPreset } from "../layout/bookDesigns";
import { OCCASION_LABELS, type Occasion, type LayoutStyle } from "../ai/types";
import { useLiveQuery } from "dexie-react-hooks";
import { FILTER_LABELS, FILTER_ORDER } from "./filters";
import { THEMES } from "../themes/themes";
import { FONT_OPTIONS } from "./fonts";
import type { BookSize, BorderStyle, Photo, PhotoFilter, Spread, SpreadBg, TextBlock, TextRole, ThemeId } from "../model/types";
// ─── Shared ───────────────────────────────────────────────────────────────────

// Popular photobook fonts — shown prominently in Text tab
// label: display name  value: full CSS font-family stack (matches FONT_OPTIONS)
const POPULAR_FONTS: { label: string; value: string }[] = [
  { label: "Playfair",    value: "'Playfair Display', Georgia, serif" },
  { label: "Cormorant",   value: "'Cormorant Garamond', Georgia, serif" },
  { label: "EB Garamond", value: "'EB Garamond', Georgia, serif" },
  { label: "Lora",        value: "Lora, Georgia, serif" },
  { label: "Fraunces",    value: "Fraunces, Georgia, serif" },
  { label: "DM Serif",    value: "'DM Serif Display', Georgia, serif" },
  { label: "Josefin",     value: "'Josefin Sans', Arial, sans-serif" },
  { label: "Montserrat",  value: "Montserrat, Arial, sans-serif" },
  { label: "Great Vibes", value: "'Great Vibes', cursive" },
  { label: "Dancing",     value: "'Dancing Script', cursive" },
];

// Background color presets for BG tab
const BG_PRESETS = [
  "#ffffff", "#fafafa", "#f8f4ef", "#f5e6c4",
  "#faeaeb", "#e4ede0", "#111318", "#1a1a1a",
  "#dedad4", "#e8e8e8", "#f3e4c2", "#e8e2ff",
];

// ─── SVG Icons (modern, clean) ────────────────────────────────────────────────

const IconAI = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M8.5 2.5l1.4 3.5 3.5 1.5-3.5 1.5-1.4 3.5-1.4-3.5L3.6 7.5l3.5-1.5 1.4-3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M13 11.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
  </svg>
);

const IconLayout = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1.5" y="1.5" width="6" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9.5" y="1.5" width="6" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="9.5" y="9" width="6" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IconBorder = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="2" y="2" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    <rect x="4.5" y="4.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" strokeDasharray="2.5 2"/>
  </svg>
);

const IconText = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M2.5 4.5h12M8.5 4.5v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M5.5 13.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconBg = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="1.5" y="2.5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M1.5 9l4-3.5 3 3 2.5-2 5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M5 15h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8.5 12.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);


const IconRotate = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M14 8.5A5.5 5.5 0 1 1 8.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8.5 1l3 2-3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconTheme = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8.5 2v3M8.5 12v3M2 8.5h3M12 8.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconFilter = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <circle cx="5.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11.5" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 6.5h7M2 10.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// ─── AI Design tab ────────────────────────────────────────────────────────────

const OCCASIONS: Occasion[] = ["wedding", "portrait", "travel", "family", "event", "newborn"];

// Maps book design category → AI layout style for the generate call
const CATEGORY_LAYOUT_STYLE: Record<BookDesignPreset["category"], LayoutStyle> = {
  editorial:    "editorial",
  documentary:  "editorial",
  portfolio:    "editorial",
  classic:      "gallery",
  portrait:     "gallery",
  modern:       "gallery",
  seasonal:     "gallery",
  wedding:      "storyteller",
  travel:       "storyteller",
  family:       "storyteller",
  pet:          "storyteller",
};

function autoSpreads(n: number) { return Math.max(1, Math.min(40, Math.ceil(n / 2.5))); }

interface AITabProps {
  projectId: string;
  size: BookSize;
  themeId: ThemeId;
}

function AITab({ projectId, size, themeId }: AITabProps) {
  const [occasion, setOccasion] = useState<Occasion>("wedding");
  const [brief, setBrief] = useState<string>(() => localStorage.getItem(`pb_ai_desc_${projectId}`) ?? "");
  const [selectedDesignId, setSelectedDesignId] = useState<string>(BOOK_DESIGNS[0]?.id ?? "");
  const [spreadCount, setSpreadCount] = useState<number | "auto">("auto");
  const [screen, setScreen] = useState<"key" | "setup" | "running" | "done" | "error">(
    hasApiKey() ? "setup" : "key",
  );
  const [keyDraft, setKeyDraft] = useState("");
  const [keyErr, setKeyErr] = useState("");

  // Reload brief from localStorage when switching to a different project
  useEffect(() => {
    setBrief(localStorage.getItem(`pb_ai_desc_${projectId}`) ?? "");
  }, [projectId]);
  const [progress, setProgress] = useState<AIProgress>({ phase: "analyzing" });
  const [errorMsg, setErrorMsg] = useState("");

  const photoCount = useLiveQuery(
    () => db.photos.where("projectId").equals(projectId).count(),
    [projectId], 0,
  ) ?? 0;

  const resolvedSpreads = Math.min(
    spreadCount === "auto" ? autoSpreads(photoCount) : spreadCount,
    40,
  );

  const handleSaveKey = () => {
    const k = keyDraft.trim();
    if (!k.startsWith("sk-ant-") || k.length < 20) {
      setKeyErr("Key should start with sk-ant- and be at least 20 chars.");
      return;
    }
    saveApiKey(k);
    setScreen("setup");
  };

  const handleGenerate = async () => {
    if (photoCount === 0) { setErrorMsg("Import photos first."); setScreen("error"); return; }
    // Persist brief before running in case of component remount on completion
    localStorage.setItem(`pb_ai_desc_${projectId}`, brief);
    setScreen("running");
    try {
      const selectedDesign = BOOK_DESIGNS.find((d) => d.id === selectedDesignId);
      const resolvedLayoutStyle: LayoutStyle = selectedDesign
        ? CATEGORY_LAYOUT_STYLE[selectedDesign.category]
        : "storyteller";
      await runAIDesign(
        projectId, occasion, resolvedSpreads, size, themeId,
        (p) => setProgress(p),
        resolvedLayoutStyle, undefined, 0, brief.trim() || undefined,
      );
      setScreen("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setScreen("error");
    }
  };

  if (screen === "key") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-[12px] font-medium text-ink">Anthropic API key</p>
        <p className="text-[11px] text-ink-faint">
          Paste your key (sk-ant-…). It's saved locally in your browser only.
        </p>
        <input
          type="password"
          autoFocus
          value={keyDraft}
          onChange={(e) => { setKeyDraft(e.target.value); setKeyErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey(); }}
          placeholder="sk-ant-..."
          className="w-full rounded-lg border border-line bg-surface-0 px-3 py-2 font-mono text-[11px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        {keyErr && <p className="text-[10px] text-danger">{keyErr}</p>}
        <button
          type="button"
          onClick={handleSaveKey}
          className="w-full rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-accent-ink"
        >
          Save key &amp; continue
        </button>
        <p className="text-[10px] text-ink-faint">Get your key at console.anthropic.com → API Keys.</p>
      </div>
    );
  }

  if (screen === "running") {
    const pct = progress.phase === "analyzing" && progress.totalPhotos
      ? Math.round(((progress.analyzed ?? 0) / progress.totalPhotos) * 100)
      : null;
    return (
      <div className="flex flex-col items-center gap-5 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
          <IconAI />
        </div>
        {progress.phase === "analyzing" && (
          <>
            <p className="text-[12px] font-medium text-ink">Analyzing photos…</p>
            <p className="text-[11px] text-ink-faint">{progress.analyzed ?? 0} / {progress.totalPhotos ?? "?"}</p>
            {pct !== null && (
              <div className="w-full overflow-hidden rounded-full bg-surface-3" style={{ height: 6 }}>
                <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            )}
          </>
        )}
        {progress.phase === "designing" && (
          <p className="text-[12px] font-medium text-ink">Crafting your story…</p>
        )}
        {progress.phase === "writing" && (
          <p className="text-[12px] font-medium text-ink">Building your photobook…</p>
        )}
        <p className="text-[10px] text-ink-faint">This may take a minute for large photo sets.</p>
      </div>
    );
  }

  if (screen === "done") {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-500/40 bg-green-500/10">
          <span className="text-2xl">✓</span>
        </div>
        <p className="text-[13px] font-medium text-ink">Photobook generated!</p>
        <p className="text-[11px] text-ink-faint">Your pages have been arranged. Edit them in the canvas.</p>
        <button
          type="button"
          onClick={() => setScreen("setup")}
          className="w-full rounded-lg border border-line px-3 py-2 text-[11px] text-ink-dim hover:bg-surface-2"
        >
          ↺ Generate again
        </button>
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
          <p className="text-[11px] font-medium text-danger">Generation failed</p>
          <p className="mt-1 text-[10px] text-danger/80 whitespace-pre-wrap">{errorMsg}</p>
        </div>
        <button
          type="button"
          onClick={() => setScreen("setup")}
          className="w-full rounded-lg border border-line px-3 py-2 text-[11px] text-ink-dim hover:bg-surface-2"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
        <span className="text-[10px] text-ink-dim"><span className="text-green-400">✓</span> API key saved</span>
        <button
          type="button"
          onClick={() => { clearApiKey(); setScreen("key"); }}
          className="text-[10px] text-ink-faint hover:underline"
        >
          Change
        </button>
      </div>

      {photoCount === 0 && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
          <p className="text-[10px] text-amber-400">Add photos to the Photos tab first.</p>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[10px] font-medium text-ink-dim">Occasion</p>
        <div className="grid grid-cols-3 gap-1">
          {OCCASIONS.map((occ) => (
            <button
              key={occ}
              type="button"
              onClick={() => setOccasion(occ)}
              className={`flex items-center justify-center rounded-lg border px-1 py-2 text-center transition-colors ${
                occasion === occ
                  ? "border-accent bg-surface-2 text-ink"
                  : "border-line bg-surface-0 text-ink-faint hover:bg-surface-2"
              }`}
            >
              <span className="text-[10px] font-medium leading-tight">{OCCASION_LABELS[occ]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-medium text-ink-dim">Brief <span className="font-normal text-ink-faint">(optional)</span></p>
        <textarea
          value={brief}
          onChange={(e) => {
            setBrief(e.target.value);
            localStorage.setItem(`pb_ai_desc_${projectId}`, e.target.value);
          }}
          placeholder="Mood, style, story…"
          rows={3}
          maxLength={1000}
          className="w-full resize-none rounded-lg border border-line bg-surface-0 px-3 py-2 text-[11px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <p className="mb-1 text-[10px] font-medium text-ink-dim">Style</p>
        <div className="overflow-hidden rounded-lg border border-line">
          {BOOK_DESIGNS.map((design) => {
            const active = selectedDesignId === design.id;
            return (
              <button
                key={design.id}
                type="button"
                onClick={() => setSelectedDesignId(design.id)}
                className={`flex w-full items-start gap-2 border-b border-line/40 px-2.5 py-2 text-left last:border-0 transition-colors ${
                  active ? "bg-surface-2" : "bg-surface-0 hover:bg-surface-1"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-medium ${active ? "text-ink" : "text-ink-dim"}`}>
                      {design.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-px text-[8px] text-ink-faint">
                      {DESIGN_CATEGORY_LABELS[design.category]}
                    </span>
                  </div>
                  <span className="line-clamp-1 text-[9px] leading-tight text-ink-faint">
                    {design.description}
                  </span>
                </div>
                {active && <span className="mt-0.5 shrink-0 text-[10px] text-accent">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-medium text-ink-dim">
          Pages <span className="font-normal text-ink-faint">({resolvedSpreads}{spreadCount === "auto" ? " auto" : ""})</span>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="range" min={1} max={40} step={1}
            value={resolvedSpreads}
            onChange={(e) => setSpreadCount(parseInt(e.target.value))}
            className="flex-1 accent-[#c9a36a]"
          />
          <span className="w-6 text-center text-[12px] font-medium text-ink">{resolvedSpreads}</span>
          {spreadCount !== "auto" && (
            <button
              type="button"
              onClick={() => setSpreadCount("auto")}
              className="text-[10px] text-accent hover:underline"
            >
              Auto
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] text-ink-faint">
        ⚠ This replaces all current pages. Photos are not affected.
      </p>

      <button
        type="button"
        disabled={photoCount === 0}
        onClick={() => void handleGenerate()}
        className="w-full rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-accent-ink disabled:opacity-40"
      >
        ✨ Generate photobook
      </button>
    </div>
  );
}

// ─── Layout tab ───────────────────────────────────────────────────────────────

type LayoutPageMode = "page" | "double";

function TemplateSVG({ template, size, mode }: { template: LayoutTemplate; size: BookSize; mode: LayoutPageMode }) {
  const ctx = templateCtx(size);
  const allFrames = template.frames(ctx);
  const allTexts = template.texts?.(ctx) ?? [];

  // "page" mode → show only left-page frames (x + width ≤ pageW) scaled to portrait
  // "double" mode → full spread landscape view
  const isPage = mode === "page";
  const W = isPage ? ctx.pageW : ctx.pageW * 2;
  const H = ctx.pageH;

  const frames = isPage
    ? allFrames.filter((f) => f.x + f.width <= ctx.pageW + 2)
    : allFrames;

  const texts = isPage
    ? allTexts.filter((t) => t.x + t.width / 2 < ctx.pageW)
    : allTexts;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block" }}>
      <rect width={W} height={H} fill="#ffffff" rx={2} />
      {!isPage && (
        <line x1={ctx.pageW} y1={0} x2={ctx.pageW} y2={H} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
      )}
      {frames.map((f, i) => (
        <rect key={i} x={f.x} y={f.y} width={f.width} height={f.height} fill="#c9c4bd" rx={2} />
      ))}
      {texts.map((t, i) => (
        <g key={`tx${i}`}>
          <rect x={t.x + t.width * 0.1} y={t.y + 1} width={t.width * 0.55} height={2.2} fill="#d8d4ce" rx={1} />
          <rect x={t.x + t.width * 0.2} y={t.y + 5} width={t.width * 0.38} height={1.8} fill="#e0dbd5" rx={1} />
        </g>
      ))}
    </svg>
  );
}

function LayoutsTab({ activeSpreadId, size }: { activeSpreadId: string | null; size: BookSize }) {
  const [applying, setApplying] = useState<string | null>(null);
  const [mode, setMode] = useState<LayoutPageMode>("page");

  const handleApply = async (templateId: string) => {
    if (!activeSpreadId || applying) return;
    setApplying(templateId);
    try {
      await applyTemplateToSpread(activeSpreadId, templateId, size);
    } finally {
      setApplying(null);
    }
  };

  // Filter templates by mode: "page" shows single-page templates (no crossesGutter),
  // "double" shows spread-spanning templates
  const ctx = templateCtx(size);
  const visibleTemplates = TEMPLATES.filter((t) => {
    const frames = t.frames(ctx);
    const spansGutter = frames.some((f) => f.x < ctx.pageW && f.x + f.width > ctx.pageW + 2);
    return mode === "double" ? spansGutter || t.crossesGutter : !spansGutter && !t.crossesGutter;
  });

  // If no page-mode templates found, show all
  const templates = visibleTemplates.length > 0 ? visibleTemplates : TEMPLATES;

  const bySlots = new Map<number, LayoutTemplate[]>();
  for (const t of templates) {
    const group = bySlots.get(t.slots) ?? [];
    group.push(t);
    bySlots.set(t.slots, group);
  }
  const slotGroups = [...bySlots.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="flex flex-col min-h-0">
      {/* Page / Double-page tabs */}
      <div className="flex shrink-0 border-b border-line px-3">
        {(["page", "double"] as LayoutPageMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`mr-4 py-2.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
              mode === m
                ? "border-accent text-ink"
                : "border-transparent text-ink-faint hover:text-ink-dim"
            }`}
          >
            {m === "page" ? "Page" : "Double-page"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        {!activeSpreadId && (
          <p className="text-center text-[11px] text-ink-faint py-4">Select a page to apply a layout.</p>
        )}
        {slotGroups.map(([slots, tpls]) => (
          <div key={slots}>
            <p className="mb-2 text-[10px] font-medium text-ink-faint">
              {slots} {slots === 1 ? "Photo" : "Photos"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {tpls.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.name}
                  disabled={!activeSpreadId || applying === t.id}
                  onClick={() => void handleApply(t.id)}
                  className={`group overflow-hidden rounded-lg border bg-white transition-colors ${
                    activeSpreadId
                      ? "border-line hover:border-accent/60 hover:shadow-sm cursor-pointer"
                      : "border-line opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div
                    className="w-full"
                    style={{ aspectRatio: mode === "page" ? `${ctx.pageW} / ${ctx.pageH}` : "2 / 1" }}
                  >
                    <TemplateSVG template={t} size={size} mode={mode} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Border tab ───────────────────────────────────────────────────────────────

function BorderTab({ activeSpreadId, activeSpread }: { activeSpreadId: string | null; activeSpread: Spread | null }) {
  const options: { value: BorderStyle; label: string; desc: string }[] = [
    { value: "none",    label: "None",      desc: "Full bleed — photos touch edges" },
    { value: "white",   label: "White Mat", desc: "Classic gallery mat border" },
    { value: "keyline", label: "Keyline",   desc: "Subtle thin rule border" },
    { value: "soft",    label: "Soft Edge", desc: "Fade to white at frame edges" },
  ];
  const current = activeSpread?.borderDefault; // undefined = not explicitly set (theme default applies)

  return (
    <div className="flex flex-col gap-2 p-3">
      {!activeSpreadId && (
        <p className="text-center text-[11px] text-ink-faint py-4">Select a page to change border.</p>
      )}
      {current !== undefined && current !== "none" && activeSpreadId && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void setSpreadBorderDefault(activeSpreadId, "none")}
            className="text-[10px] text-ink-faint hover:text-ink"
          >↺ Reset to none</button>
        </div>
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={!activeSpreadId}
          onClick={() => activeSpreadId && void setSpreadBorderDefault(activeSpreadId, opt.value)}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
            current === opt.value && activeSpreadId
              ? "border-accent bg-surface-2"
              : "border-line bg-surface-0 hover:bg-surface-1"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span className="relative flex h-8 w-12 shrink-0 items-center justify-center rounded border border-line/60 bg-[#dedad4]">
            <span className={`absolute inset-[5px] rounded-sm bg-ink-faint/40 ${
              opt.value === "white"   ? "ring-[3px] ring-white" :
              opt.value === "keyline" ? "ring-[1px] ring-ink-faint/70" :
              opt.value === "soft"    ? "opacity-40" : ""
            }`} style={opt.value === "soft" ? { boxShadow: "inset 0 0 6px 3px white" } : undefined} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className={`text-[12px] font-medium ${current === opt.value && activeSpreadId ? "text-ink" : "text-ink-dim"}`}>
              {opt.label}
            </span>
            <span className="text-[10px] text-ink-faint">{opt.desc}</span>
          </span>
          {current === opt.value && activeSpreadId && (
            <span className="ml-auto shrink-0 text-[11px] text-accent">✓</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Text tab ─────────────────────────────────────────────────────────────────

type FontCategory = "all" | "serif" | "sans" | "script" | "display" | "mono";

const CATEGORY_LABELS: Record<FontCategory, string> = {
  all: "All", serif: "Serif", sans: "Sans", script: "Script", display: "Display", mono: "Mono",
};

function TextTab({
  activeSpreadId,
  activeSpread,
  size,
  selectedTextId,
}: {
  activeSpreadId: string | null;
  activeSpread: Spread | null;
  size: BookSize;
  selectedTextId: string | null;
}) {
  const selectedText = activeSpread?.texts.find((t) => t.id === selectedTextId) ?? null;

  const [adding, setAdding] = useState<TextRole | null>(null);
  const [selectedFont, setSelectedFont] = useState("'Playfair Display', Georgia, serif");
  const [fontSize, setFontSize] = useState(35);
  const [fontSearch, setFontSearch] = useState("");
  const [fontCategory, setFontCategory] = useState<FontCategory>("all");

  // Sync font/size from selected text block
  useEffect(() => {
    if (selectedText) {
      if (selectedText.fontFamily) setSelectedFont(selectedText.fontFamily);
      if (selectedText.fontSize) setFontSize(selectedText.fontSize);
    }
  }, [selectedText?.id]);  // only re-sync when selection changes, not on every field edit

  const filteredFonts = FONT_OPTIONS.filter((f) => {
    const matchesSearch = f.label.toLowerCase().includes(fontSearch.toLowerCase());
    const matchesCat = fontCategory === "all" || f.category === fontCategory;
    return matchesSearch && matchesCat;
  });

  const applyFont = async (fontValue: string) => {
    setSelectedFont(fontValue);
    void document.fonts.load(`16px ${fontValue}`);
    if (!activeSpreadId) return;
    if (selectedText) {
      const tid = selectedText.id;
      await updateSpread(activeSpreadId, (s) => ({
        ...s,
        texts: s.texts.map((t) => (t.id === tid ? { ...t, fontFamily: fontValue } : t)),
      }));
    }
  };

  const applyFontSize = async (sz: number) => {
    setFontSize(sz);
    if (!activeSpreadId) return;
    if (selectedText) {
      const tid = selectedText.id;
      await updateSpread(activeSpreadId, (s) => ({
        ...s,
        texts: s.texts.map((t) => (t.id === tid ? { ...t, fontSize: sz } : t)),
      }));
    }
  };

  const addTextBlock = async (role: TextRole) => {
    if (!activeSpreadId || adding) return;
    setAdding(role);
    try {
      const defaults: Record<TextRole, { text: string; y: number }> = {
        heading: { text: "Heading",   y: size.pageHeightMm * 0.08 },
        body:    { text: "Body text", y: size.pageHeightMm * 0.22 },
        caption: { text: "Caption",   y: size.pageHeightMm * 0.85 },
      };
      const { text, y } = defaults[role];
      await updateSpread(activeSpreadId, (s) => {
        const maxZ = s.texts.reduce((m, t) => Math.max(m, t.z), 0);
        const block: TextBlock = {
          id: crypto.randomUUID(),
          role,
          text,
          x: 10,
          y,
          width: size.pageWidthMm * 2 - 20,
          rotation: 0,
          z: maxZ + 1,
          align: "center",
          fontSize,
          fontFamily: selectedFont,
          fontColor: "#000000",
        };
        return { ...s, texts: [...s.texts, block] };
      });
    } finally {
      setAdding(null);
    }
  };

  const applyToAll = async () => {
    if (!activeSpreadId || !activeSpread) return;
    await updateSpread(activeSpreadId, (s) => ({
      ...s,
      texts: s.texts.map((t) => ({ ...t, fontFamily: selectedFont, fontSize })),
    }));
  };

  const textTypes: { role: TextRole; label: string; desc: string }[] = [
    { role: "heading", label: "Heading",  desc: "Large title" },
    { role: "body",    label: "Body",     desc: "Paragraph" },
    { role: "caption", label: "Caption",  desc: "Small label" },
  ];

  return (
    <div className="flex flex-col">
      {/* ── Controls (sticky top) ── */}
      <div className="shrink-0 border-b border-line bg-surface-1 px-3 py-2.5">
        {!activeSpreadId && (
          <p className="mb-2 text-center text-[10px] text-ink-faint">Select a page to add text</p>
        )}
        {selectedText && (
          <p className="mb-2 rounded-md bg-accent/10 px-2 py-1 text-[10px] text-accent">
            Editing selected text — font changes apply instantly
          </p>
        )}

        {/* Apply to all */}
        {activeSpread && activeSpread.texts.length > 0 && (
          <button
            type="button"
            onClick={() => void applyToAll()}
            className="mb-2 w-full rounded-lg border border-line py-1.5 text-[10px] text-ink-dim transition-colors hover:bg-surface-2"
          >
            Apply to all
          </button>
        )}

        {/* Heading / Body / Caption */}
        <div className="mb-2 flex gap-1.5">
          {textTypes.map(({ role, label }) => (
            <button
              key={role}
              type="button"
              disabled={!activeSpreadId || adding !== null}
              onClick={() => void addTextBlock(role)}
              className={`flex-1 rounded-lg border border-line py-1.5 text-center transition-colors hover:bg-surface-2 disabled:opacity-40 ${
                role === "heading" ? "text-[12px] font-bold text-ink-dim" :
                role === "body"    ? "text-[11px] text-ink-dim" :
                                     "text-[9px] text-ink-faint"
              }`}
            >
              {label}
              {adding === role && "…"}
            </button>
          ))}
        </div>

        {/* Size slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-faint shrink-0">Size</span>
          <input
            type="range" min={8} max={72} step={1} value={fontSize}
            onChange={(e) => void applyFontSize(Number(e.target.value))}
            className="flex-1 accent-[#c9a36a]"
          />
          <span className="w-8 text-right text-[11px] tabular-nums text-ink-faint shrink-0">{fontSize}pt</span>
        </div>
      </div>

      {/* ── Font browser ── */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-3 py-2">
        {/* Popular pills */}
        <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint">Popular</p>
        <div className="flex flex-wrap gap-1">
          {POPULAR_FONTS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => void applyFont(value)}
              title={label}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                selectedFont === value
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-line text-ink-faint hover:border-surface-3 hover:text-ink-dim"
              }`}
              style={{ fontFamily: value }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="5" cy="5" r="3.5"/><path d="M8.5 8.5l2 2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={fontSearch}
            onChange={(e) => setFontSearch(e.target.value)}
            placeholder="Search fonts…"
            className="w-full rounded-lg border border-line bg-surface-0 py-1.5 pl-7 pr-3 text-[11px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          {fontSearch && (
            <button
              type="button"
              onClick={() => setFontSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-faint hover:text-ink"
            >✕</button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(["all", "serif", "sans", "script", "display", "mono"] as FontCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFontCategory(cat)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] transition-colors ${
                fontCategory === cat
                  ? "bg-accent/15 text-accent"
                  : "text-ink-faint hover:text-ink-dim"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable font list */}
      <div className="min-h-0 overflow-y-auto">
        {filteredFonts.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-ink-faint">No fonts match "{fontSearch}"</p>
        ) : (
          filteredFonts.map((f) => {
            const isSelected = selectedFont === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => void applyFont(f.value)}
                className={`flex w-full items-center border-b border-line/40 px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? "bg-accent/10 pl-3 border-l-2 border-l-accent"
                    : "hover:bg-surface-2"
                }`}
              >
                <span
                  className="flex-1 truncate text-[16px] leading-tight text-ink"
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </span>
                {isSelected && <span className="ml-2 shrink-0 text-[10px] text-accent">✓</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Background tab ───────────────────────────────────────────────────────────

function BGTab({
  activeSpreadId,
  activeSpread,
  photos,
  size,
}: {
  activeSpreadId: string | null;
  activeSpread: Spread | null;
  photos: Photo[];
  size: BookSize;
}) {
  const [mode, setMode] = useState<"solid" | "gradient" | "photo">("solid");
  const [colorA, setColorA] = useState("#ffffff");
  const [colorB, setColorB] = useState("#f3e4c2");
  // Eagerly load thumbnails for all photos (small grid — no IntersectionObserver needed)
  const [thumbUrls, setThumbUrls] = useState<Map<string, string>>(new Map());

  const currentBg = activeSpread?.bg;
  const bgLayers = activeSpread?.bgLayers ?? [];

  const spreadW = size.pageWidthMm * 2;
  const spreadH = size.pageHeightMm;

  // Compute auto cover+10% padded dimensions in mm — mirrors the canvas/export algorithm
  const getAutoDims = (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return null;
    const imgAspect = photo.width / photo.height;
    const canvasAspect = spreadW / spreadH;
    let autoW: number, autoH: number;
    if (imgAspect > canvasAspect) { autoH = spreadH; autoW = imgAspect * spreadH; }
    else { autoW = spreadW; autoH = spreadW / imgAspect; }
    const minW = spreadW * 1.1, minH = spreadH * 1.1;
    if (autoW < minW || autoH < minH) {
      const bump = Math.max(minW / autoW, minH / autoH);
      autoW *= bump; autoH *= bump;
    }
    return { autoW, autoH };
  };
  const currentBgColor = currentBg?.color ?? activeSpread?.background ?? "#ffffff";

  // Sync mode tab when the active spread's bg type changes
  useEffect(() => {
    if (currentBg?.type === "gradient") setMode("gradient");
    else if (currentBg?.type === "photo" || bgLayers.length > 0) setMode("photo");
  }, [currentBg?.type, bgLayers.length]);

  // Eagerly load thumbnails for all project photos
  useEffect(() => {
    if (photos.length === 0) return;
    let cancelled = false;
    const revoke: string[] = [];
    const loaded = new Map<string, string>();
    void Promise.all(
      photos.map(async (photo) => {
        const blobs = await db.photoBlobs.get(photo.id);
        if (blobs?.thumb && !cancelled) {
          const url = URL.createObjectURL(blobs.thumb);
          revoke.push(url);
          loaded.set(photo.id, url);
        }
      }),
    ).then(() => { if (!cancelled) setThumbUrls(new Map(loaded)); });
    return () => {
      cancelled = true;
      revoke.forEach((u) => URL.revokeObjectURL(u));
    };
  // Re-run when photo list changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length, photos[0]?.id]);

  const setBg = async (bg: SpreadBg | undefined) => {
    if (!activeSpreadId) return;
    await updateSpread(activeSpreadId, (s) => ({ ...s, bg }));
  };

  const toggleBgLayer = async (photo: Photo) => {
    if (!activeSpreadId) return;
    const isActive = bgLayers.some((l) => l.photoId === photo.id);
    if (isActive) {
      await updateSpread(activeSpreadId, (s) => ({
        ...s, bgLayers: (s.bgLayers ?? []).filter((l) => l.photoId !== photo.id),
      }));
    } else {
      await updateSpread(activeSpreadId, (s) => ({
        ...s, bgLayers: [...(s.bgLayers ?? []), { id: nanoid(), photoId: photo.id, opacity: 0.85 }],
      }));
    }
  };

  const updateLayerOpacity = async (layerId: string, opacity: number) => {
    if (!activeSpreadId) return;
    await updateSpread(activeSpreadId, (s) => ({
      ...s, bgLayers: (s.bgLayers ?? []).map((l) => l.id === layerId ? { ...l, opacity } : l),
    }));
  };

  const removeLayer = async (layerId: string) => {
    if (!activeSpreadId) return;
    await updateSpread(activeSpreadId, (s) => ({
      ...s, bgLayers: (s.bgLayers ?? []).filter((l) => l.id !== layerId),
    }));
  };

  const hasAnyBg = !!(activeSpread?.bg || bgLayers.length > 0);

  return (
    <div className="flex flex-col gap-3 p-3">
      {!activeSpreadId && (
        <p className="text-center text-[11px] text-ink-faint py-4">Select a page to change background.</p>
      )}

      {/* Mode selector */}
      <div className="flex overflow-hidden rounded-lg border border-line">
        {(["solid", "gradient", "photo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[11px] transition-colors ${
              mode === m ? "bg-surface-2 text-ink" : "text-ink-faint hover:bg-surface-1"
            }`}
          >
            {m === "solid" ? "Solid" : m === "gradient" ? "Gradient" : "Photo"}
          </button>
        ))}
      </div>

      {mode === "solid" && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-ink-faint">Current: <span style={{ color: currentBgColor }}>■</span> {currentBgColor}</p>
          <div className="grid grid-cols-6 gap-1.5">
            {BG_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!activeSpreadId}
                onClick={() => void setBg({ type: "solid", color: c })}
                className="relative h-8 w-8 rounded-md border border-line/60 transition-transform hover:scale-110 disabled:opacity-40"
                style={{ background: c }}
                title={c}
              >
                {currentBgColor === c && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px]">
                    {c === "#111318" || c === "#1a1a1a" ? (
                      <span className="text-white">✓</span>
                    ) : (
                      <span className="text-black/60">✓</span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorA}
              onChange={(e) => setColorA(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent"
            />
            <input
              type="text"
              value={colorA}
              onChange={(e) => setColorA(e.target.value)}
              placeholder="#ffffff"
              className="flex-1 rounded-lg border border-line bg-surface-0 px-2 py-1.5 font-mono text-[11px] text-ink focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              disabled={!activeSpreadId}
              onClick={() => void setBg({ type: "solid", color: colorA })}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-ink-dim transition-colors hover:bg-surface-2 disabled:opacity-40"
            >
              Set
            </button>
          </div>
        </div>
      )}

      {mode === "gradient" && (
        <div className="flex flex-col gap-3">
          <div
            className="h-12 w-full rounded-lg border border-line/60"
            style={{ background: `linear-gradient(to bottom, ${colorA}, ${colorB})` }}
          />
          <div className="flex items-center gap-2">
            <input type="color" value={colorA} onChange={(e) => setColorA(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-line" />
            <span className="text-[10px] text-ink-faint">Top</span>
            <span className="flex-1 text-center text-[14px] text-ink-faint">→</span>
            <span className="text-[10px] text-ink-faint">Bottom</span>
            <input type="color" value={colorB} onChange={(e) => setColorB(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-line" />
          </div>
          <button
            type="button"
            disabled={!activeSpreadId}
            onClick={() => void setBg({ type: "gradient", color: colorA, colorB })}
            className="w-full rounded-lg bg-accent/10 border border-accent/40 px-3 py-2 text-[12px] text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
          >
            Apply gradient
          </button>
        </div>
      )}

      {mode === "photo" && (
        <div className="flex flex-col gap-3">
          {/* ── Active layers ── */}
          {(currentBg?.type === "photo" || bgLayers.length > 0) && (
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Active layers</p>

              {/* Primary BG photo */}
              {currentBg?.type === "photo" && currentBg.photoId && (() => {
                const dims = getAutoDims(currentBg.photoId);
                if (!dims) return null;
                const { autoW, autoH } = dims;
                const effectiveW = currentBg.w ?? autoW;
                const effectiveH = currentBg.h ?? autoH;
                const extraW = effectiveW - spreadW;
                const extraH = effectiveH - spreadH;
                const sizeVal = Math.round(effectiveW / autoW * 100);
                const horizVal = extraW > 0 && currentBg.x !== undefined
                  ? Math.round(Math.min(100, Math.max(0, -currentBg.x / extraW * 100))) : 50;
                const vertVal = extraH > 0 && currentBg.y !== undefined
                  ? Math.round(Math.min(100, Math.max(0, -currentBg.y / extraH * 100))) : 50;
                return (
                  <div className="overflow-hidden rounded-xl border border-line/60 bg-surface-0 shadow-sm">
                    <div className="flex items-center gap-2.5 p-2.5">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                        {thumbUrls.get(currentBg.photoId)
                          ? <img src={thumbUrls.get(currentBg.photoId)} alt="" className="h-full w-full object-cover" draggable={false} />
                          : <div className="h-full w-full bg-surface-2" />
                        }
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[11px] font-medium text-ink">Background</span>
                        <span className="text-[10px] tabular-nums text-ink-faint">
                          {Math.round((currentBg.opacity ?? 1) * 100)}% opacity
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void setBg(undefined)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Remove background"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Opacity */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Opacity</p>
                      <input type="range" min={10} max={100} step={1}
                        value={Math.round((currentBg.opacity ?? 1) * 100)}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bg: s.bg ? { ...s.bg, opacity: Number(e.target.value) / 100 } : s.bg,
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                    {/* Size */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Size</p>
                        <span className="text-[9px] tabular-nums text-ink-faint">{sizeVal}%</span>
                      </div>
                      <input type="range" min={10} max={200} step={5}
                        value={sizeVal}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          const pct = Number(e.target.value) / 100;
                          const newW = autoW * pct;
                          const newH = autoH * pct;
                          const curX = currentBg.x ?? (spreadW - effectiveW) / 2;
                          const curY = currentBg.y ?? (spreadH - effectiveH) / 2;
                          const fx = (spreadW / 2 - curX) / effectiveW;
                          const fy = (spreadH / 2 - curY) / effectiveH;
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bg: s.bg ? {
                              ...s.bg, w: newW, h: newH,
                              x: spreadW / 2 - fx * newW,
                              y: spreadH / 2 - fy * newH,
                            } : s.bg,
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                    {/* Vertical */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Vertical</p>
                        <span className="text-[9px] text-ink-faint">Top · Bottom</span>
                      </div>
                      <input type="range" min={0} max={100} step={1}
                        value={vertVal}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          const val = Number(e.target.value);
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bg: s.bg ? {
                              ...s.bg,
                              w: s.bg.w ?? autoW,
                              h: s.bg.h ?? autoH,
                              y: -extraH * (val / 100),
                            } : s.bg,
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                    {/* Horizontal */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Horizontal</p>
                        <span className="text-[9px] text-ink-faint">Left · Right</span>
                      </div>
                      <input type="range" min={0} max={100} step={1}
                        value={horizVal}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          const val = Number(e.target.value);
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bg: s.bg ? {
                              ...s.bg,
                              w: s.bg.w ?? autoW,
                              h: s.bg.h ?? autoH,
                              x: -extraW * (val / 100),
                            } : s.bg,
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Extra bgLayers */}
              {bgLayers.map((layer) => {
                const ld = getAutoDims(layer.photoId);
                const lAutoW = ld?.autoW ?? spreadW;
                const lAutoH = ld?.autoH ?? spreadH;
                const lEffW = layer.w ?? lAutoW;
                const lEffH = layer.h ?? lAutoH;
                const lExtraW = lEffW - spreadW;
                const lExtraH = lEffH - spreadH;
                const lSizeVal = Math.round(lEffW / lAutoW * 100);
                const lHorizVal = lExtraW > 0 && layer.x !== undefined
                  ? Math.round(Math.min(100, Math.max(0, -layer.x / lExtraW * 100))) : 50;
                const lVertVal = lExtraH > 0 && layer.y !== undefined
                  ? Math.round(Math.min(100, Math.max(0, -layer.y / lExtraH * 100))) : 50;
                return (
                  <div key={layer.id} className="overflow-hidden rounded-xl border border-line/60 bg-surface-0 shadow-sm">
                    <div className="flex items-center gap-2.5 p-2.5">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                        {thumbUrls.get(layer.photoId)
                          ? <img src={thumbUrls.get(layer.photoId)} alt="" className="h-full w-full object-cover" draggable={false} />
                          : <div className="h-full w-full bg-surface-2" />
                        }
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[11px] font-medium text-ink">Layer</span>
                        <span className="text-[10px] tabular-nums text-ink-faint">
                          {Math.round((layer.opacity ?? 0.85) * 100)}% brightness
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeLayer(layer.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Remove layer"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Brightness */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Brightness</p>
                      <input type="range" min={10} max={100} step={1}
                        value={Math.round((layer.opacity ?? 0.85) * 100)}
                        onChange={(e) => void updateLayerOpacity(layer.id, Number(e.target.value) / 100)}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                    {/* Size */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Size</p>
                        <span className="text-[9px] tabular-nums text-ink-faint">{lSizeVal}%</span>
                      </div>
                      <input type="range" min={10} max={200} step={5}
                        value={lSizeVal}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          const pct = Number(e.target.value) / 100;
                          const newW = lAutoW * pct;
                          const newH = lAutoH * pct;
                          const curX = layer.x ?? (spreadW - lEffW) / 2;
                          const curY = layer.y ?? (spreadH - lEffH) / 2;
                          const fx = (spreadW / 2 - curX) / lEffW;
                          const fy = (spreadH / 2 - curY) / lEffH;
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bgLayers: (s.bgLayers ?? []).map((l) =>
                              l.id === layer.id ? {
                                ...l, w: newW, h: newH,
                                x: spreadW / 2 - fx * newW,
                                y: spreadH / 2 - fy * newH,
                              } : l
                            ),
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                    {/* Vertical */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Vertical</p>
                        <span className="text-[9px] text-ink-faint">Top · Bottom</span>
                      </div>
                      <input type="range" min={0} max={100} step={1}
                        value={lVertVal}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          const val = Number(e.target.value);
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bgLayers: (s.bgLayers ?? []).map((l) =>
                              l.id === layer.id ? {
                                ...l,
                                w: l.w ?? lAutoW,
                                h: l.h ?? lAutoH,
                                y: -lExtraH * (val / 100),
                              } : l
                            ),
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                    {/* Horizontal */}
                    <div className="border-t border-line/30 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Horizontal</p>
                        <span className="text-[9px] text-ink-faint">Left · Right</span>
                      </div>
                      <input type="range" min={0} max={100} step={1}
                        value={lHorizVal}
                        onChange={(e) => {
                          if (!activeSpreadId) return;
                          const val = Number(e.target.value);
                          void updateSpread(activeSpreadId, (s) => ({
                            ...s, bgLayers: (s.bgLayers ?? []).map((l) =>
                              l.id === layer.id ? {
                                ...l,
                                w: l.w ?? lAutoW,
                                h: l.h ?? lAutoH,
                                x: -lExtraW * (val / 100),
                              } : l
                            ),
                          }));
                        }}
                        className="w-full cursor-pointer accent-[#c9a36a]" style={{ height: 4 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Photo grid ── */}
          {photos.length === 0 ? (
            <p className="text-center text-[11px] text-ink-faint py-4">Add photos first in the Photos tab.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-ink-faint">Click to add/remove as a background layer. Click photo on canvas to drag or resize.</p>
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((photo) => {
                  const inLayer = bgLayers.some((l) => l.photoId === photo.id);
                  const isPrimary = currentBg?.type === "photo" && currentBg.photoId === photo.id;
                  const isActive = inLayer || isPrimary;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      disabled={!activeSpreadId || isPrimary}
                      onClick={() => void toggleBgLayer(photo)}
                      className={`relative overflow-hidden rounded-md border transition-all ${
                        isActive ? "border-accent ring-1 ring-accent" : "border-line/60 hover:border-accent/50"
                      } disabled:opacity-40`}
                      style={{ aspectRatio: "1" }}
                      title={isPrimary ? "Primary background (remove via layer list)" : undefined}
                    >
                      {thumbUrls.get(photo.id) ? (
                        <img src={thumbUrls.get(photo.id)} alt="" className="h-full w-full object-cover" draggable={false} />
                      ) : (
                        <div className="h-full w-full bg-surface-2" />
                      )}
                      {isActive && (
                        <span className="absolute inset-0 flex items-center justify-center bg-accent/20 text-[16px]">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {hasAnyBg && (
        <button
          type="button"
          onClick={() => {
            if (!activeSpreadId) return;
            void updateSpread(activeSpreadId, (s) => ({ ...s, bg: undefined, bgLayers: [] }));
          }}
          className="w-full rounded-lg border border-line px-3 py-1.5 text-[11px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Reset to theme default
        </button>
      )}
    </div>
  );
}

// ─── Rotate tab ───────────────────────────────────────────────────────────────

function RotateTab({
  activeSpreadId,
  activeSpread,
  selectedFrameId,
}: {
  activeSpreadId: string | null;
  activeSpread: Spread | null;
  selectedFrameId: string | null;
}) {
  const selectedFrame = activeSpread?.frames.find((f) => f.id === selectedFrameId);
  const rotation = selectedFrame?.rotation ?? 0;

  if (!activeSpreadId) {
    return <p className="p-4 text-center text-[11px] text-ink-faint">Select a page first.</p>;
  }

  if (!selectedFrame) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2">
          <IconRotate />
        </div>
        <p className="text-[12px] font-medium text-ink">Rotate Frame</p>
        <p className="text-[11px] text-ink-faint">Click a photo frame in the canvas to select it, then rotate it here.</p>
      </div>
    );
  }

  const setRotation = (deg: number) => {
    const fid = selectedFrameId;
    void updateSpread(activeSpreadId!, (s) => ({
      ...s,
      frames: s.frames.map((f) => f.id === fid ? { ...f, rotation: deg } : f),
    }));
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium text-ink">Rotate</p>
          <p className="text-[10px] text-ink-faint">Drag the slider or use buttons to rotate the selected frame.</p>
        </div>
        {rotation !== 0 && (
          <button type="button" onClick={() => setRotation(0)} className="text-[10px] text-ink-faint hover:text-ink">
            ↺ Reset
          </button>
        )}
      </div>

      {/* Rotation display */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/40 bg-surface-2">
          <div
            className="h-8 w-8 rounded border-2 border-accent bg-surface-3"
            style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.1s" }}
          />
        </div>
        <span className="text-[20px] font-bold text-ink tabular-nums">{Math.round(rotation)}°</span>
      </div>

      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={rotation}
        onChange={(e) => setRotation(Number(e.target.value))}
        className="w-full accent-[#c9a36a]"
      />

      {/* Quick rotate buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setRotation(((rotation - 90) % 360 + 360) % 360 > 180 ? ((rotation - 90) % 360 + 360) % 360 - 360 : ((rotation - 90) % 360 + 360) % 360)}
          className="rounded-lg border border-line py-2 text-[12px] text-ink-dim transition-colors hover:bg-surface-2"
        >
          ↺ 90° CCW
        </button>
        <button
          type="button"
          onClick={() => setRotation(0)}
          className="rounded-lg border border-line py-2 text-[12px] text-ink-dim transition-colors hover:bg-surface-2"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setRotation(((rotation + 90) % 360 + 360) % 360 > 180 ? ((rotation + 90) % 360 + 360) % 360 - 360 : ((rotation + 90) % 360 + 360) % 360)}
          className="rounded-lg border border-line py-2 text-[12px] text-ink-dim transition-colors hover:bg-surface-2"
        >
          ↻ 90° CW
        </button>
      </div>

      {/* Flip options */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRotation(-rotation)}
          className="rounded-lg border border-line py-2 text-[12px] text-ink-dim transition-colors hover:bg-surface-2"
        >
          Flip vertical
        </button>
        <button
          type="button"
          onClick={() => setRotation(180 - rotation)}
          className="rounded-lg border border-line py-2 text-[12px] text-ink-dim transition-colors hover:bg-surface-2"
        >
          Flip horizontal
        </button>
      </div>
    </div>
  );
}

// ─── Theme tab ────────────────────────────────────────────────────────────────

const DESIGN_CATEGORY_LABELS: Record<BookDesignPreset["category"], string> = {
  editorial: "Editorial", classic: "Classic", modern: "Modern",
  documentary: "Documentary", portrait: "Portrait",
  wedding: "Wedding", travel: "Travel", family: "Family",
  portfolio: "Portfolio", seasonal: "Seasonal", pet: "Pet",
};

function ThemeTab({ projectId, currentThemeId, size }: { projectId: string; currentThemeId: ThemeId; size: BookSize }) {
  const [applying, setApplying] = useState(false);
  const [designApplying, setDesignApplying] = useState<string | null>(null);
  const [designDone, setDesignDone] = useState<string | null>(null);

  const apply = async (themeId: ThemeId) => {
    if (themeId === currentThemeId || applying) return;
    setApplying(true);
    await db.projects.update(projectId, { themeId, updatedAt: Date.now() });
    setApplying(false);
  };

  const applyDesign = async (design: BookDesignPreset) => {
    if (designApplying) return;
    setDesignApplying(design.id);
    setDesignDone(null);
    try {
      await applyBookDesign(projectId, design.id, size);
      setDesignDone(design.id);
    } finally {
      setDesignApplying(null);
    }
  };

  return (
    <div className="flex flex-col">
      {/* ── Color themes ── */}
      <div className="border-b border-line py-1">
        {THEMES.map((theme) => {
          const isActive = theme.id === currentThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              disabled={applying}
              onClick={() => void apply(theme.id)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${
                isActive ? "bg-surface-2" : ""
              }`}
            >
              <span
                className="relative h-8 w-12 shrink-0 overflow-hidden rounded border border-line/60"
                style={{ background: theme.background }}
              >
                <span className="absolute" style={{ left: "8%", top: "12%", width: "38%", height: "76%",
                  background: theme.swatchAccent + "22", border: `0.5px solid ${theme.swatchAccent}33` }} />
                <span className="absolute" style={{ left: "52%", top: "12%", width: "40%", height: "35%",
                  background: theme.swatchAccent + "22", border: `0.5px solid ${theme.swatchAccent}33` }} />
                <span className="absolute" style={{ left: "52%", top: "53%", width: "40%", height: "35%",
                  background: theme.swatchAccent + "22", border: `0.5px solid ${theme.swatchAccent}33` }} />
                <span className="absolute inset-y-0" style={{ left: "50%", width: "0.5px", background: theme.swatchAccent + "20" }} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={`text-[11px] font-medium ${isActive ? "text-accent" : "text-ink"}`}>
                  {theme.label}
                </span>
                <span className="text-[9px] text-ink-faint leading-tight">{theme.description}</span>
              </span>
              {isActive && <span className="ml-auto shrink-0 text-[10px] text-accent">✓</span>}
            </button>
          );
        })}
      </div>

      {/* ── Book design presets ── */}
      <div className="flex flex-col gap-0 py-2">
        <div className="px-3 pb-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Book Designs</p>
          <p className="mt-0.5 text-[9px] text-ink-faint">Apply a layout sequence to your entire photobook</p>
        </div>
        {BOOK_DESIGNS.map((design) => (
          <button
            key={design.id}
            type="button"
            disabled={!!designApplying}
            onClick={() => void applyDesign(design)}
            className="flex items-start gap-2 border-t border-line/40 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-ink">{design.name}</span>
                <span className="rounded-full bg-surface-3 px-1.5 py-px text-[8px] text-ink-faint">
                  {DESIGN_CATEGORY_LABELS[design.category]}
                </span>
              </div>
              <span className="text-[9px] leading-tight text-ink-faint">{design.description}</span>
            </div>
            <span className="ml-auto shrink-0 text-[10px]">
              {designApplying === design.id ? (
                <span className="text-accent">…</span>
              ) : designDone === design.id ? (
                <span className="text-green-400">✓</span>
              ) : null}
            </span>
          </button>
        ))}
        <p className="px-3 pt-1.5 text-[9px] text-ink-faint">⚠ Replaces all page layouts — photos are kept</p>
      </div>
    </div>
  );
}

// ─── Filter tab ───────────────────────────────────────────────────────────────

function FilterTab({ activeSpreadId, activeSpread }: { activeSpreadId: string | null; activeSpread: Spread | null }) {
  const current = activeSpread?.filter ?? "none";

  return (
    <div className="flex flex-col gap-2 p-3">
      {!activeSpreadId && (
        <p className="text-center text-[11px] text-ink-faint py-4">Select a page to apply a filter.</p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-ink-faint">Color grading applied to all photos on this page.</p>
        {current !== "none" && activeSpreadId && (
          <button
            type="button"
            onClick={() => void updateSpread(activeSpreadId, (s) => ({ ...s, filter: "none" }))}
            className="shrink-0 text-[10px] text-ink-faint hover:text-ink"
          >↺ Reset</button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {FILTER_ORDER.map((f: PhotoFilter) => (
          <button
            key={f}
            type="button"
            disabled={!activeSpreadId}
            onClick={() =>
              activeSpreadId && void updateSpread(activeSpreadId, (s) => ({ ...s, filter: f }))
            }
            className={`flex items-center rounded-lg border px-3 py-2 text-left transition-colors ${
              current === f && activeSpreadId
                ? "border-accent bg-surface-2 text-ink"
                : "border-line bg-surface-0 text-ink-dim hover:bg-surface-1"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span className="flex-1 text-[12px]">{FILTER_LABELS[f]}</span>
            {current === f && activeSpreadId && (
              <span className="text-[10px] text-accent">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type Tab = "ai" | "layout" | "border" | "text" | "bg" | "rotate" | "theme" | "filter";

const TAB_CONFIG: { id: Tab; Icon: () => React.JSX.Element; label: string; short: string }[] = [
  { id: "ai",      Icon: IconAI,      label: "AI Design",  short: "AI"     },
  { id: "layout",  Icon: IconLayout,  label: "Layouts",    short: "Layout" },
  { id: "border",  Icon: IconBorder,  label: "Border",     short: "Border" },
  { id: "text",    Icon: IconText,    label: "Text",       short: "Text"   },
  { id: "bg",      Icon: IconBg,      label: "Background", short: "BG"     },
  { id: "rotate",  Icon: IconRotate,  label: "Rotate",     short: "Rotate" },
  { id: "theme",   Icon: IconTheme,   label: "Theme",      short: "Theme"  },
  { id: "filter",  Icon: IconFilter,  label: "Filter",     short: "Filter" },
];

interface LeftPanelProps {
  projectId: string;
  themeId: ThemeId;
  photos: Photo[];
  activeSpreadId: string | null;
  activeSpread: Spread | null;
  size: BookSize;
  selectedFrameId: string | null;
  selectedTextId: string | null;
}

export function LeftPanel({
  projectId, themeId, photos,
  activeSpreadId, activeSpread, size, selectedFrameId, selectedTextId,
}: LeftPanelProps) {
  const [tab, setTab] = useState<Tab | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const toggleTab = (id: Tab) => setTab((prev) => (prev === id ? null : id));

  useEffect(() => {
    if (!tab) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        stripRef.current?.contains(e.target as Node) ||
        drawerRef.current?.contains(e.target as Node)
      ) return;
      setTab(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [tab]);

  const drawerTitle = TAB_CONFIG.find((c) => c.id === tab)?.label ?? "";

  return (
    <aside className="relative z-20 w-12 shrink-0 border-r border-line bg-surface-1">
      {/* Vertical icon strip — fills the full aside height */}
      <div
        ref={stripRef}
        className="flex h-full w-12 flex-col items-center overflow-y-auto py-1"
      >
        {TAB_CONFIG.map(({ id, Icon, label, short }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => toggleTab(id)}
            className={`relative flex w-full flex-col items-center gap-0.5 px-1 py-2 transition-colors ${
              tab === id ? "text-accent" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {tab === id && (
              <span className="absolute left-0 inset-y-1 w-0.5 rounded-r bg-accent" />
            )}
            <Icon />
            <span className={`text-[8px] leading-none font-medium ${tab === id ? "text-accent" : "text-ink-faint"}`}>
              {short}
            </span>
          </button>
        ))}
      </div>

      {/* Side drawer — floats over the canvas, never shifts layout */}
      {tab && (
        <div
          ref={drawerRef}
          className="absolute bottom-0 left-full top-0 z-30 overflow-hidden border-r border-line bg-surface-1 shadow-[2px_0_12px_rgba(0,0,0,0.10)]"
          style={{ display: "flex", flexDirection: "column", width: 240 }}
        >
          {/* Drawer header */}
          <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[11px] font-semibold text-ink">{drawerTitle}</span>
            <button
              type="button"
              onClick={() => setTab(null)}
              className="text-[14px] text-ink-faint transition-colors hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* Drawer content with scrollbar */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "ai" && <AITab projectId={projectId} size={size} themeId={themeId} />}
            {tab === "layout" && <LayoutsTab activeSpreadId={activeSpreadId} size={size} />}
            {tab === "border" && <BorderTab activeSpreadId={activeSpreadId} activeSpread={activeSpread} />}
            {tab === "text" && <TextTab activeSpreadId={activeSpreadId} activeSpread={activeSpread} size={size} selectedTextId={selectedTextId} />}
            {tab === "bg" && <BGTab activeSpreadId={activeSpreadId} activeSpread={activeSpread} photos={photos} size={size} />}
            {tab === "rotate" && (
              <RotateTab activeSpreadId={activeSpreadId} activeSpread={activeSpread} selectedFrameId={selectedFrameId} />
            )}
            {tab === "theme" && <ThemeTab projectId={projectId} currentThemeId={themeId} size={size} />}
            {tab === "filter" && <FilterTab activeSpreadId={activeSpreadId} activeSpread={activeSpread} />}
          </div>
        </div>
      )}
    </aside>
  );
}
