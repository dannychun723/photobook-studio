// Book structure design — converts photo analyses into a sequenced spread plan.
// Uses Claude tool calling so the output is always valid structured data (no JSON parsing).
// Cites: R-S1 (scene-setter), R-S2 (narrative arc), R-S4 (hero/detail roles),
// R-S5 (visual rhythm), R-S7 (closing image), R-S8 (curation).

import type { Photo, ThemeId } from "../model/types";
import type { Occasion, PhotoAnalysis, AISpreadDesign, AIBookDesign, LayoutStyle } from "./types";
import { LAYOUT_STYLES } from "./types";
import { TYPOGRAPHY_PRESETS } from "./typographyPresets";
import { AI_MODEL, getClient } from "./client";

// Keep as array so regenerations can randomly exclude optional templates
const TEMPLATE_ENTRIES = [
  // Required — always included (needed for rule 1/2: first+last spread)
  { id: "full-bleed-spread",      required: true,  line: "full-bleed-spread — 1 photo, cinematic hero; scene setter or closer" },
  { id: "breather-right",         required: true,  line: "breather-right — 1 photo, quiet white-space spread; use after dense grids or between chapters" },
  { id: "panoramic-spread",       required: true,  line: "panoramic-spread — 1 wide photo across full spread" },
  // Optional — may be excluded on regenerations to force variety
  { id: "full-bleed-pages",       required: false, line: "full-bleed-pages — 2 photos, two hero images one per page" },
  { id: "two-up",                 required: false, line: "two-up — 2 photos, two related moments side by side" },
  { id: "hero-left-details",      required: false, line: "hero-left-details — 5 photos, large hero left + 4 small details right" },
  { id: "hero-right-details",     required: false, line: "hero-right-details — 5 photos, 4 small details left + large hero right" },
  { id: "grid-2x2",               required: false, line: "grid-2x2 — 4 photos, candid moment cluster" },
  { id: "grid-3x3",               required: false, line: "grid-3x3 — 9 photos, high-energy grid (use sparingly, max 1 per 6 spreads)" },
  { id: "pano-strip",             required: false, line: "pano-strip — 3 photos in a horizontal row" },
  { id: "portrait-landscape",     required: false, line: "portrait-landscape — 2 photos, portrait + landscape pairing" },
  { id: "square-strip",           required: false, line: "square-strip — 3 square-cropped images in a strip" },
  { id: "text-left-photo-right",  required: false, line: "text-left-photo-right — 1 photo + heading/body text; chapter openers only (max 1 per 5 spreads)" },
];

const ALL_TEMPLATES = TEMPLATE_ENTRIES.map((t) => t.line).join("\n");

// On regenerations, randomly exclude 4 optional templates so the AI is forced
// into different layout combinations — guaranteed structural variety.
function pickTemplates(attempt: number): string {
  if (attempt === 0) return ALL_TEMPLATES;
  const optional = TEMPLATE_ENTRIES.filter((t) => !t.required);
  const shuffled = [...optional].sort(() => Math.random() - 0.5);
  const excluded = new Set(shuffled.slice(0, 4).map((t) => t.id));
  return TEMPLATE_ENTRIES
    .filter((t) => t.required || !excluded.has(t.id))
    .map((t) => t.line)
    .join("\n");
}

// Different editorial personas shift the AI's creative voice on each regeneration
const CREATIVE_PERSONAS = [
  "You are a world-class photobook creative director. Your designs are cinematic, emotionally resonant, and visually sophisticated — the kind of editorial quality seen in fine-art photography books.",
  "You are a bold documentary photography editor. Your designs are raw, authentic, and rhythmically powerful — images flow like a film reel, honest and unapologetic.",
  "You are a luxury fine-art book designer. Your designs breathe — generous white space, deliberate pacing, each spread a moment of stillness before the next revelation.",
  "You are an avant-garde editorial art director. Your designs surprise — unexpected juxtapositions, bold rhythm changes, images that challenge predictable sequences.",
  "You are an intimate portrait book specialist. Your designs build emotional connection — close moments, breathing room, a story told through faces, gestures, and quiet details.",
  "You are a high-energy magazine creative director. Your designs crackle with momentum — dense clusters, dramatic hero shots, the pace of a magazine spread at its peak.",
];

// Tool input schema — produces complete, print-ready spreads including wording and typography.
// Defined as a plain object (not const) so required[] stays mutable for the SDK.
function buildDesignTool() {
  return {
    name: "design_photobook",
    description:
      "Output the complete spread-by-spread layout plan for the photobook, " +
      "including all wording, border styles, and a book-wide typography preset so the book is ready to print with no further editing.",
    input_schema: {
      type: "object" as const,
      properties: {
        bookTypographyPreset: {
          type: "string" as const,
          enum: TYPOGRAPHY_PRESETS.map((p) => p.name),
          description:
            "Choose ONE typography preset for the ENTIRE book — applied consistently to all heading, body, and caption text on every spread. " +
            "Pick based on occasion and mood: weddings/portraits/heritage → Classic Editorial, Romantic Script, or Luxury Cinzel; " +
            "travel/events/documentary → Documentary or Modern Bold; family/newborn → Warm Humanist or Contemporary Fraunces; " +
            "fine-art/gallery → Minimal Clean or Editorial Contrast; all-serif richness → Heritage Serif.",
        },
        spineColor: {
          type: "string" as const,
          description:
            "Optional CSS hex color for the spine strip on the cover spread (e.g. '#1a2744', '#c4962a', '#3a1a1a'). " +
            "Should complement the book's overall color palette and the cover photo mood. Leave unset to keep warm gold (#c4962a) default.",
        },
        spreads: {
          type: "array" as const,
          description: "Ordered spread designs from first to last page",
          items: {
            type: "object" as const,
            properties: {
              templateId: {
                type: "string" as const,
                description: "Exact template identifier (e.g. 'full-bleed-spread')",
              },
              photoIds: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Photo IDs assigned to this spread's frames, in order",
              },
              chapterHint: {
                type: "string" as const,
                description: "Short chapter label for the first spread of a new chapter (optional). Use evocative location or narrative labels — NEVER 'D1', 'D2', 'Day 1', 'Day 2', or any date-derived label.",
              },
              title: {
                type: "string" as const,
                description:
                  "Heading text — 2–4 words max, punchy and editorial. REQUIRED for 'text-left-photo-right' and 'breather-right'. Optional for panoramic spreads.",
              },
              body: {
                type: "string" as const,
                description:
                  "Body text for 'text-left-photo-right' only — evocative prose, not descriptive. Write as many words as the moment deserves; one rich sentence or two is ideal. Often better left empty for minimalist layouts.",
              },
              caption: {
                type: "string" as const,
                description:
                  "Ultra-short caption ≤5 words: a place name, date, or single atmospheric phrase. Favour brevity — one powerful word beats five average ones.",
              },
              borderStyle: {
                type: "string" as const,
                enum: ["none", "white", "keyline"],
                description:
                  "'none' = photos fill edge to edge (cinematic). 'white' = elegant white mat frame. 'keyline' = subtle gray outline (editorial).",
              },
              bgColor: {
                type: "string" as const,
                description:
                  "Optional CSS color for spread background (e.g. '#1a1a2e', 'rgb(240,230,210)'). Omit to use theme default. Use sparingly — max 2–3 spreads per book, and only when the mood demands it (dark drama, warm nostalgia, etc.).",
              },
              bgColorB: {
                type: "string" as const,
                description:
                  "Optional gradient end color. When set alongside bgColor, creates a top-to-bottom linear gradient background. Leave unset for solid color.",
              },
              photoGrain: {
                type: "number" as const,
                description:
                  "Optional film-grain intensity 0–40 applied to all photos in this spread. Use for moody/vintage feel. 0 = none, 20 = subtle, 40 = strong. Omit or set 0 for clean modern look.",
              },
              pageRole: {
                type: "string" as const,
                enum: ["front-cover", "back-cover"],
                description:
                  "Optional: mark the first spread as 'front-cover' and the last spread as 'back-cover'. Only these two roles exist — never assign to interior spreads.",
              },
            },
            required: ["templateId", "photoIds"] as string[],
          },
        },
      },
      required: ["bookTypographyPreset", "spreads"] as string[],
    },
  };
}

const REGEN_DIRECTIVES = [
  "Rethink the chapter structure completely — shift where the narrative breaks fall.",
  "Lead with an unexpected intimate moment instead of the obvious scene-setter.",
  "Use more breathing room — add extra breather-right spreads between chapters.",
  "Make it denser and more energetic — lean on grids and multi-photo spreads.",
  "Alternate tempo more aggressively — cinematic solo shots followed by rapid-fire grids.",
  "Let secondary moments lead — promote supporting shots to hero position.",
  "Within each date group, lead with the strongest emotional peak instead of the chronological opener.",
  "Open with a detail shot, not the widest establishing frame.",
  "Use panoramic-spread more — let landscape moments breathe across the full spread.",
  "Cluster all the candid moments together in an energy-burst section mid-book.",
];

export async function designBook(
  analyses: PhotoAnalysis[],
  occasion: Occasion,
  themeId: ThemeId,
  targetSpreads: number,
  layoutStyle: LayoutStyle = "storyteller",
  attempt: number = 0,
  userDescription?: string,
  photos: Pick<Photo, "id" | "takenAt" | "importedAt">[] = [],
): Promise<AIBookDesign> {
  const client = getClient();
  const styleConfig = LAYOUT_STYLES[layoutStyle];

  // Build date-group map: photos sorted chronologically → D1, D2, D3...
  // Photos captured on the same calendar day get the same label so the AI
  // knows to keep them together and never mix moments from different days.
  const dateGroupByPhotoId = new Map<string, string>();
  if (photos.length > 0) {
    const seenDates = new Map<string, number>();
    for (const p of photos) {
      const ts = p.takenAt ?? p.importedAt;
      const dateKey = new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD UTC
      if (!seenDates.has(dateKey)) seenDates.set(dateKey, seenDates.size + 1);
      dateGroupByPhotoId.set(p.id, `D${seenDates.get(dateKey)}`);
    }
  }
  const totalDays = new Set(dateGroupByPhotoId.values()).size || 1;

  // Compact photo list — includes date group and color temperature for sequencing
  const photoList = analyses.map((a, i) => ({
    idx: i,
    id: a.photoId,
    scene: a.sceneType,
    key: a.isKeyMoment,
    score: a.compositionScore,
    role: a.suggestedRole,
    chapter: a.chapter,
    color: a.colorTemperature ?? "neutral",
    date: dateGroupByPhotoId.get(a.photoId) ?? "D1",
  }));

  const availableTemplates = pickTemplates(attempt);
  const persona = CREATIVE_PERSONAS[attempt % CREATIVE_PERSONAS.length];

  // On regenerations, open with a hard override so the AI reads it before anything else
  const regenHeader = attempt > 0
    ? `🔄 REGENERATION #${attempt} — client rejected previous design. You MUST produce a COMPLETELY DIFFERENT result.\n` +
      `DIRECTIVE: ${REGEN_DIRECTIVES[Math.floor(Math.random() * REGEN_DIRECTIVES.length)]}\n` +
      `You have only ${availableTemplates.split("\n").length} templates available this round (some removed to force fresh choices).\n` +
      `Unique session seed: ${Math.floor(Math.random() * 999983)} — let this drive genuinely different decisions.\n\n`
    : "";

  const clientBrief = userDescription?.trim()
    ? `CLIENT BRIEF — let this drive all layout, wording, and mood choices:\n"${userDescription.trim()}"\n\n`
    : "";

  const prompt = `${regenHeader}${clientBrief}Design a COMPLETE, PRINT-READY ${occasion} photobook (theme: ${themeId}, style: ${styleConfig.label}) targeting ${targetSpreads} spreads.
Every spread must include actual wording — no placeholder text. The result must be ready to send to a print lab.

PHOTO LIBRARY — ALL ${analyses.length} photos below MUST be used. Every photo ID must appear exactly once across all spreads. No photo may be skipped:
${JSON.stringify(photoList)}

AVAILABLE TEMPLATES (only these — no others):
${availableTemplates}

LAYOUT STYLE: ${styleConfig.label} (image:whitespace = ${styleConfig.ratio})
${styleConfig.templateBias}

CORE LAYOUT RULES — follow every one precisely:
1. Spread 1: MUST be full-bleed-spread or panoramic-spread (most striking image — sets the entire mood)
2. Final spread: MUST be full-bleed-spread or breather-right (calm, reflective closer)
3. Visual rhythm: NO template repeated on back-to-back spreads; insert breather-right after any grid spread
4. Hero treatment: any photo with key=true or role="hero" MUST go in a hero-position template
5. MANDATORY: Use ALL ${analyses.length} photo IDs exactly once — assign every single photo ID to a frame. Never duplicate, never omit. Add extra spreads beyond ${targetSpreads} if needed to fit all photos
6. Color harmony: group photos with matching color temperature (warm/cool/neutral) on adjacent spreads where natural — avoid jarring warm→cool transitions mid-chapter
7. DATE GROUPING (mandatory — overrides creative reordering):
   - Each photo has a \`date\` field (D1 = first calendar day, D2 = second, etc.). This book spans ${totalDays} day${totalDays === 1 ? "" : "s"}.
   - Photos with the SAME date MUST appear on consecutive spreads — preserve chronological order within each day
   - NEVER place photos from different date groups on the same spread (a D1 and D2 photo must never share one spread)
   - When a new date group begins, open that section with a natural chapter break: breather-right, full-bleed-spread, or text-left-photo-right
   - The \`date\` field is internal ordering metadata ONLY — NEVER write "D1", "D2", "Day 1", "Day 2", or any date-derived label in chapterHint, title, body, or caption. Use evocative narrative or location labels instead.
8. Spread count: output at least ${targetSpreads} spreads; add more only if required so every photo has a slot
9. Template IDs: use exact identifiers from the list above

TEXT RULES — short, clean, eye-catching wording only:
• "text-left-photo-right": set title (2–4 punchy words, impact over length) + body (evocative prose — write as much as the moment deserves, one or two rich sentences; avoid generic filler)
• "breather-right": set title (2–3 words only — quiet, poetic, memorable)
• "panoramic-spread": set caption (≤6 words — location or single atmospheric word/phrase)
• "portrait-landscape", "two-up", "hero-left-details", "hero-right-details", "pano-strip", "square-strip": set caption only (≤5 words — date, place, or single mood word)
• TONE: minimal, editorial, typographer-approved — less is always more; never fill space with long text
• Match the ${occasion} aesthetic — weddings: "I Do.", "Golden Hour", "Always"; travel: "Rome, 6am", "Beyond the Ridge"; family: "Home", "Sunday Light"
• Never write generic filler like "A beautiful moment", "precious memories", or anything clichéd

BORDER RULES — set borderStyle for every spread:
• full-bleed-spread, full-bleed-pages, panoramic-spread, grid-2x2, grid-3x3, pano-strip, square-strip → "none"
• two-up, hero-left-details, hero-right-details, portrait-landscape → "white"
• text-left-photo-right, breather-right → "none"
• Override allowed if a specific mood calls for it

BACKGROUND COLOR RULES — use bgColor/bgColorB sparingly for maximum impact:
• Only apply to 2–3 spreads maximum in the whole book — overuse kills the effect
• Use for: opening/closing full-bleed spreads with dark dramatic photos, chapter-break breather spreads with a distinct mood, or the front/back cover spreads
• Suggested approaches: dark cinematic (#0d0d0d, '#1a1a2e') for night/moody shots; warm cream (#f5ede0, '#e8d5b7') for golden-hour or nostalgic content; gradient pairs for extra depth
• Most spreads should omit bgColor entirely and use the theme's paper background

GRAIN RULES — add photoGrain for vintage/film aesthetic:
• Use photoGrain 15–25 on 2–3 spreads for subtle film texture; 30–40 for heavy vintage look
• Match grain to photo mood: old family shots, black & white, moody/dramatic content benefit most
• Modern clean portraits, bright events → omit grain (0 or unset)

COVER RULES:
• If this book has ≥ 3 spreads, set pageRole: "front-cover" on the first spread and pageRole: "back-cover" on the last spread
• Never set pageRole on interior spreads

TYPOGRAPHY RULES — set bookTypographyPreset once for the whole book:
${TYPOGRAPHY_PRESETS.map((p) => `• "${p.name}" — ${p.description}`).join("\n")}

Choose the preset whose tone best fits this ${occasion} book and the ${styleConfig.label} style.
The chosen fonts are applied to ALL heading/body/caption text across every spread — this is the book's visual signature.
Text colors automatically adapt: dark text on light paper spreads, light text on dark-background spreads.

SPINE COLOR RULES:
• Choose a color that complements the cover photo and the book's dominant palette
• Navy/dark: #1a2744 (sophisticated), #1c1c2e (moody), #0d1b2a (deep ocean)
• Earth/warm: #c4962a (gold), #8b4513 (walnut), #3d2b1f (espresso)
• Neutral: #3a3d47 (slate), #1a1c22 (charcoal), #2e2e2e (graphite)
• For weddings, blush, or florals: #5c3a4a (burgundy rose), #7a4f3a (terracotta)
• Omit to keep warm gold default (#c4962a)`;

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: `${persona} You MUST call the design_photobook tool with your complete answer.`,
    tools: [buildDesignTool()],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: prompt }],
  });

  const defaultPreset = TYPOGRAPHY_PRESETS[0].name;

  // Path 1: model called the tool — input is already parsed JSON, no string parsing needed
  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (toolBlock?.type === "tool_use") {
    const result = toolBlock.input as { spreads: AISpreadDesign[]; bookTypographyPreset?: string; spineColor?: string };
    if (Array.isArray(result?.spreads) && result.spreads.length > 0) {
      return {
        spreads: result.spreads,
        bookTypographyPreset: result.bookTypographyPreset ?? defaultPreset,
        spineColor: result.spineColor,
      };
    }
  }

  // Path 2: model replied with text — extract JSON robustly
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const text = raw.replace(/```(?:json)?\n?/gi, "").trim();
  const parsed = extractBookJSON(text);

  if (!parsed || !Array.isArray(parsed.spreads) || parsed.spreads.length === 0) {
    console.error("[designBook] Could not parse response:", raw.slice(0, 400));
    throw new Error("AI returned no valid design. Please try again.");
  }

  return {
    spreads: parsed.spreads,
    bookTypographyPreset: parsed.bookTypographyPreset ?? defaultPreset,
    spineColor: parsed.spineColor,
  };
}

function extractBookJSON(text: string): { spreads: AISpreadDesign[]; bookTypographyPreset?: string; spineColor?: string } | null {
  // Strategy 1: direct parse
  try {
    const p = JSON.parse(text) as { spreads: AISpreadDesign[]; bookTypographyPreset?: string; spineColor?: string };
    if (Array.isArray(p?.spreads)) return p;
  } catch { /* try next */ }

  // Strategy 2: count braces to find the outermost JSON object
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          const p = JSON.parse(text.slice(start, i + 1)) as { spreads: AISpreadDesign[]; bookTypographyPreset?: string; spineColor?: string };
          if (Array.isArray(p?.spreads)) return p;
        } catch { /* fall through */ }
        break;
      }
    }
  }
  return null;
}
