// AI caption generation for a spread (R-T5: suggests 3 options, human picks one).
// Only ~320px thumbnails go to the API — privacy boundary defined in CLAUDE.md.

import { db } from "../db/db";
import type { Occasion } from "./types";
import { AI_MODEL, getClient } from "./client";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function parseCaptions(text: string): string[] {
  const match = text.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]) as unknown[];
      const captions = arr.filter((x): x is string => typeof x === "string").slice(0, 3);
      if (captions.length > 0) return captions;
    } catch { /* fall through */ }
  }
  return ["A moment worth remembering.", "Together, always.", "The story continues."];
}

export async function captionSpread(
  photoIds: string[],
  occasion?: Occasion,
  chapterHint?: string,
): Promise<string[]> {
  const client = getClient();

  const imageBlocks: {
    type: "image";
    source: { type: "base64"; media_type: "image/jpeg"; data: string };
  }[] = [];

  for (const pid of photoIds.slice(0, 4)) {
    try {
      const blobs = await db.photoBlobs.get(pid);
      if (!blobs?.thumb) continue;
      const data = await blobToBase64(blobs.thumb);
      imageBlocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    } catch { /* skip unavailable blobs */ }
  }

  const context = [
    occasion && `occasion: ${occasion}`,
    chapterHint && `chapter: "${chapterHint}"`,
  ]
    .filter(Boolean)
    .join(", ");

  const textPrompt =
    `${imageBlocks.length > 0 ? "Looking at these photobook spread photos, g" : "G"}enerate 3 short photobook captions` +
    `${context ? ` (${context})` : ""}. ` +
    `Each caption: 1–2 sentences, evocative and personal. ` +
    `Vary style: one poetic, one warm-direct, one capturing time/place. ` +
    `Respond ONLY with valid JSON: ["caption1","caption2","caption3"]`;

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text" as const, text: textPrompt }],
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return parseCaptions(text);
}
