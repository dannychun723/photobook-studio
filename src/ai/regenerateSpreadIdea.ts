// Per-spread "Idea" regeneration — rewrites text and/or swaps layout for the active page.
// Called by the Idea button in the TopBar. Each call increments `attempt` so the
// AI produces a different result every time.

import { getClient, AI_MODEL } from "./client";
import { applyTemplate } from "../layout/apply";
import { TEMPLATES, getTemplate } from "../layout/templates";
import type { BookSize, Spread, TextBlock } from "../model/types";

export type IdeaMode = "text" | "layout" | "both";

// Pick a random template from ALL available templates that can accommodate
// the given photo count, always different from the current one.
// Allow templates with up to (photoCount + 3) slots so a few frames can be
// empty without overwhelming the spread with placeholders.
function pickRandomTemplate(spread: Spread): string {
  const photoCount = spread.frames.filter((f) => f.photoId).length;
  const maxSlots = Math.max(photoCount, photoCount + 3);
  const minSlots = Math.max(1, photoCount);

  const candidates = TEMPLATES.filter(
    (t) => t.slots >= minSlots && t.slots <= maxSlots && t.id !== spread.templateId,
  );

  // If nothing fits (very unusual edge case), fall through to any different template
  const pool = candidates.length > 0
    ? candidates
    : TEMPLATES.filter((t) => t.id !== spread.templateId);

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].id;
}

export async function regenerateSpreadLayout(
  spread: Spread,
  size: BookSize,
): Promise<Spread> {
  const templateId = pickRandomTemplate(spread);
  const template = getTemplate(templateId);
  if (!template) return spread;

  const reapplied = applyTemplate(spread, template, size);
  // Keep existing user-authored text — only swap the photo frames
  return { ...reapplied, texts: spread.texts };
}

export async function regenerateSpreadText(
  spread: Spread,
  brief: string,
  attempt: number,
): Promise<TextBlock[]> {
  if (spread.texts.length === 0) return [];

  const client = getClient();

  const textList = spread.texts
    .map((t) => `id=${t.id} role=${t.role}: "${t.text}"`)
    .join("\n");

  const varietySeeds = [
    "poetic and lyrical",
    "warm and conversational",
    "brief and impactful",
    "nostalgic and reflective",
    "joyful and celebratory",
    "elegant and understated",
    "storytelling and narrative",
    "intimate and personal",
  ];
  const style = varietySeeds[attempt % varietySeeds.length];

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 512,
    system: `You are a professional photobook copywriter specialising in ${style} copy.
Your job: rewrite the given text blocks for a photobook spread so they feel fresh and original.
Rules:
- Heading: ≤ 8 words
- Body: ≤ 40 words
- Caption: ≤ 15 words
- Keep the emotional tone tied to the brief
- Return ONLY a valid JSON object, no markdown, no explanation.
Format: {"texts":[{"id":"<exact id>","text":"<new text>"},...]}`,
    messages: [
      {
        role: "user",
        content: `Brief: "${brief || "A beautiful photobook"}"
Style tone for this attempt: ${style}
Attempt #${attempt + 1} — make this noticeably different from typical phrasing.

Text blocks to rewrite:
${textList}

Return the JSON.`,
      },
    ],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return spread.texts;

  let parsed: { texts: Array<{ id: string; text: string }> };
  try {
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch {
    return spread.texts;
  }

  return spread.texts.map((t) => {
    const hit = parsed.texts.find((r) => r.id === t.id);
    return hit?.text ? { ...t, text: hit.text } : t;
  });
}

export async function applyIdea(
  spread: Spread,
  mode: IdeaMode,
  size: BookSize,
  brief: string,
  attempt: number,
): Promise<Spread> {
  let updated = { ...spread };

  if (mode === "layout" || mode === "both") {
    updated = await regenerateSpreadLayout(updated, size);
  }

  if (mode === "text" || mode === "both") {
    const newTexts = await regenerateSpreadText(spread, brief, attempt);
    updated = { ...updated, texts: newTexts };
  }

  return updated;
}
