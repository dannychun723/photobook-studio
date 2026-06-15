// PNG download + print-to-PDF export for the full book.
// PNG: renders the active spread at export scale and triggers browser download.
// PDF: renders all spreads to a temporary print window; user presses Print → Save as PDF.
// No server upload — all rendering is local (R-P1, CLAUDE.md privacy constraint).

import type { BookSize, Spread } from "../model/types";
import type { ThemeTokens } from "../themes/themes";
import { renderSpreadToCanvas } from "./renderSpread";

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const SPINE_W_MM = 12;
const DEFAULT_SPINE_COLOR = "#c4962a";

function spineFor(spread: Spread) {
  return spread.index === 0 && spread.showSpine !== false
    ? { widthMm: spread.spineWidthMm ?? SPINE_W_MM, color: spread.spineColor ?? DEFAULT_SPINE_COLOR }
    : undefined;
}

export async function downloadSpreadPNG(
  spread: Spread,
  size: BookSize,
  theme: ThemeTokens,
  filename: string,
  quality: "preview" | "original" = "original",
): Promise<void> {
  const scale = quality === "original" ? 8 : 4;
  const canvas = await renderSpreadToCanvas(spread, size, theme, scale, quality, spineFor(spread));
  const url = canvas.toDataURL("image/png");
  triggerDownload(url, filename);
}

/** Downloads just the left or right half of a spread as a JPEG. */
export async function downloadSinglePageJPEG(
  spread: Spread,
  size: BookSize,
  theme: ThemeTokens,
  side: "left" | "right",
  filename: string,
  quality: "preview" | "original" = "original",
): Promise<void> {
  const scale = quality === "original" ? 8 : 4;
  const canvas = await renderSpreadToCanvas(spread, size, theme, scale, quality, spineFor(spread));
  const halfW = Math.floor(canvas.width / 2);
  const out = document.createElement("canvas");
  out.width = halfW;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  const srcX = side === "left" ? 0 : halfW;
  ctx.drawImage(canvas, srcX, 0, halfW, canvas.height, 0, 0, halfW, canvas.height);
  const url = out.toDataURL("image/jpeg", 0.92);
  triggerDownload(url, filename);
}

export type SocialFormat = "square" | "portrait" | "story";

const SOCIAL_DIMS: Record<SocialFormat, { w: number; h: number }> = {
  square:   { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story:    { w: 1080, h: 1920 },
};

/**
 * Renders each spread to a social media format canvas, scaled + centered with bg fill,
 * and sequentially downloads them as numbered JPEGs.
 */
export async function exportSocialSlides(
  spreads: Spread[],
  size: BookSize,
  theme: ThemeTokens,
  format: SocialFormat,
  projectName: string,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const { w, h } = SOCIAL_DIMS[format];
  const safeName = projectName.replace(/[^a-z0-9]/gi, "_");

  for (let i = 0; i < spreads.length; i++) {
    const spreadCanvas = await renderSpreadToCanvas(spreads[i], size, theme, 3, "preview", spineFor(spreads[i]));
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;

    // Fill with theme background
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, w, h);

    // Scale spread to fit, centered
    const scaleX = w / spreadCanvas.width;
    const scaleY = h / spreadCanvas.height;
    const s = Math.min(scaleX, scaleY);
    const sw = spreadCanvas.width * s;
    const sh = spreadCanvas.height * s;
    ctx.drawImage(spreadCanvas, (w - sw) / 2, (h - sh) / 2, sw, sh);

    const url = out.toDataURL("image/jpeg", 0.92);
    triggerDownload(url, `${safeName}_slide_${String(i + 1).padStart(2, "0")}.jpg`);
    onProgress(i + 1, spreads.length);

    // Small delay between downloads to avoid browser popup suppression
    if (i < spreads.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
}

export async function printBook(
  spreads: Spread[],
  size: BookSize,
  theme: ThemeTokens,
  projectName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const dataUrls: string[] = [];

  for (let i = 0; i < spreads.length; i++) {
    const canvas = await renderSpreadToCanvas(spreads[i], size, theme, 3, "preview", spineFor(spreads[i]));
    dataUrls.push(canvas.toDataURL("image/jpeg", 0.93));
    onProgress?.(i + 1, spreads.length);
  }

  const spreadWmm = size.pageWidthMm * 2;
  const spreadHmm = size.pageHeightMm;
  const safeTitle = projectName.replace(/[<>&"]/g, "");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${spreadWmm}mm ${spreadHmm}mm; margin: 0; }
  body { background: #fff; }
  .spread {
    width: ${spreadWmm}mm;
    height: ${spreadHmm}mm;
    page-break-after: always;
    overflow: hidden;
  }
  .spread:last-child { page-break-after: avoid; }
  .spread img { width: 100%; height: 100%; display: block; }
  .toolbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #1a1c22; color: #ecedef; padding: 10px 16px;
    display: flex; align-items: center; gap: 12px; font-family: sans-serif; font-size: 13px;
  }
  .toolbar strong { flex: 1; }
  .btn {
    padding: 6px 16px; border: none; border-radius: 6px;
    cursor: pointer; font-size: 13px; font-weight: 500;
  }
  .btn-print { background: #c9a36a; color: #1a1c22; }
  .btn-close { background: #3a3d47; color: #ecedef; }
  .page-push { height: 42px; }
  @media print { .toolbar, .page-push { display: none; } }
</style>
</head>
<body>
<div class="toolbar">
  <strong>${safeTitle}</strong>
  <span style="color:#888">${spreads.length} spread${spreads.length !== 1 ? "s" : ""}</span>
  <button class="btn btn-print" onclick="window.print()">Print / Save as PDF</button>
  <button class="btn btn-close" onclick="window.close()">Close</button>
</div>
<div class="page-push"></div>
${dataUrls.map((url) => `<div class="spread"><img src="${url}" alt="" /></div>`).join("\n")}
</body>
</html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    throw new Error("Popup blocked — please allow popups for this page and try again.");
  }
  win.document.write(html);
  win.document.close();
}
