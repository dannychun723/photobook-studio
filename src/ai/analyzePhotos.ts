// Vision analysis pass — sends thumbnail batches to Claude, returns per-photo
// analysis used by the pacing/layout engine. Only ~320px thumbnails are sent
// (never originals or full previews) to stay within the AI privacy boundary
// defined in CLAUDE.md. Cites: R-S4 (hero/detail roles), R-S8 (curation).

import { db } from "../db/db";
import type { Photo } from "../model/types";
import type { Occasion, PhotoAnalysis } from "./types";
import { AI_MODEL, getClient } from "./client";

const BATCH_SIZE = 8;

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const FALLBACK_ANALYSIS = (photoId: string): PhotoAnalysis => ({
  photoId,
  sceneType: "other",
  isKeyMoment: false,
  compositionScore: 5,
  suggestedRole: "detail",
  chapter: "Photos",
});

export async function analyzePhotos(
  photos: Photo[],
  occasion: Occasion,
  onProgress: (done: number, total: number) => void,
): Promise<PhotoAnalysis[]> {
  const client = getClient();
  const results: PhotoAnalysis[] = [];

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);

    const blobRows = await Promise.all(batch.map((p) => db.photoBlobs.get(p.id)));

    // Build image content blocks, skipping any photos whose blobs didn't load
    const imageBlocks: { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }[] = [];
    const includedIndices: number[] = [];

    for (let j = 0; j < batch.length; j++) {
      const row = blobRows[j];
      if (!row?.thumb) continue;
      try {
        const data = await blobToBase64(row.thumb);
        imageBlocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
        includedIndices.push(j);
      } catch {
        // Skip blobs that fail to convert
      }
    }

    if (imageBlocks.length === 0) {
      // No blobs loaded — use fallback analysis for all in batch
      for (const p of batch) results.push(FALLBACK_ANALYSIS(p.id));
      onProgress(Math.min(i + BATCH_SIZE, photos.length), photos.length);
      continue;
    }

    const prompt = `Analyze these ${imageBlocks.length} photos for a ${occasion} photobook.

For each photo in order, output a JSON array — one object per photo:
[
  {
    "sceneType": "portrait|candid|group|landscape|detail|ceremony|firstDance|reception|gettingReady|venue|food|other",
    "isKeyMoment": true,
    "compositionScore": 8,
    "suggestedRole": "hero|detail|filler",
    "chapter": "Ceremony",
    "colorTemperature": "warm|cool|neutral",
    "cropHint": "center|left-third|right-third|top|bottom"
  }
]

suggestedRole guide:
- hero: outstanding composition/emotion, should be the largest image on its spread
- detail: good supporting shot, works in a cluster or grid
- filler: redundant/blurry/near-duplicate, use only if needed to fill spreads

chapter: natural narrative chapter label (e.g. "Getting Ready", "Ceremony", "Portraits", "Reception", "Details")

colorTemperature: overall colour cast — warm (golden/amber tones), cool (blue/grey tones), neutral
cropHint: where the primary subject sits — center, left-third, right-third, top, or bottom of the frame

Output ONLY the JSON array, no other text.`;

    let parsed: Omit<PhotoAnalysis, "photoId">[] = [];
    try {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [...imageBlocks, { type: "text" as const, text: prompt }],
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]) as typeof parsed;
    } catch {
      // On any API or parse failure, fall through to fallback below
    }

    // Map results back — batch items not included in imageBlocks get fallback
    let parsedIdx = 0;
    for (let j = 0; j < batch.length; j++) {
      const photo = batch[j];
      if (includedIndices.includes(j)) {
        const raw = parsed[parsedIdx++];
        results.push({
          photoId: photo.id,
          sceneType: raw?.sceneType ?? "other",
          isKeyMoment: raw?.isKeyMoment ?? false,
          compositionScore: Math.max(1, Math.min(10, Number(raw?.compositionScore) || 5)),
          suggestedRole: raw?.suggestedRole ?? "detail",
          chapter: raw?.chapter ?? "Photos",
          colorTemperature: (raw as { colorTemperature?: string })?.colorTemperature as PhotoAnalysis["colorTemperature"] ?? "neutral",
          cropHint: (raw as { cropHint?: string })?.cropHint as PhotoAnalysis["cropHint"] ?? "center",
        });
      } else {
        results.push(FALLBACK_ANALYSIS(photo.id));
      }
    }

    onProgress(Math.min(i + BATCH_SIZE, photos.length), photos.length);
  }

  return results;
}
