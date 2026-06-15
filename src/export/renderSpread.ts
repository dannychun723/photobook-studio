// Offscreen spread renderer — pure canvas, no Konva, no UI chrome.
// Used by: cover thumbnails (ProjectCard), PNG export, PDF print.
// R-P1: high-fidelity output from original blobs at export scale.
//
// Bug fixes vs initial version:
//   - textBaseline="top" to match Konva's text-origin convention
//   - word-wrap matching Konva width-constrained wrapping
//   - frame rotation applied via ctx.translate/rotate
//   - photo filter applied via ctx.filter before each frame draw
//   - placeholder only rendered when photo genuinely absent

import { db } from "../db/db";
import type { BookSize, BorderStyle, Frame, PhotoFilter, ShapeBlock, Spread, SpreadBgLayer } from "../model/types";
import type { ThemeTokens } from "../themes/themes";
import { FILTER_PRESETS } from "../editor/filters";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const s = 256;
  const gc = document.createElement("canvas");
  gc.width = s; gc.height = s;
  const gctx = gc.getContext("2d");
  if (!gctx) return null;
  const d = gctx.createImageData(s, s);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 90 + ((Math.random() * 76) | 0); // narrow range near 128 → fine grain under soft-light
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  gctx.putImageData(d, 0, 0);
  return ctx.createPattern(gc, "repeat");
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// Converts a CSS hex color to rgba() string. Used so soft-edge fades match the
// spread background exactly — eliminating the visible border at the clip boundary.
function hexToRgba(cssColor: string, alpha: number): string {
  const h = cssColor.replace(/\s/g, "").replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(h)) {
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;
  }
  if (/^[0-9a-f]{3}$/i.test(h)) {
    return `rgba(${parseInt(h[0]+h[0],16)},${parseInt(h[1]+h[1],16)},${parseInt(h[2]+h[2],16)},${alpha})`;
  }
  return `rgba(255,255,255,${alpha})`;
}

function drawBorder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  border: BorderStyle,
  theme: ThemeTokens,
  scale: number,
): void {
  if (border === "white") {
    const sw = 4 * scale;
    ctx.strokeStyle = theme.whiteBorderColor;
    ctx.lineWidth = sw;
    ctx.strokeRect(x + sw / 2, y + sw / 2, w - sw, h - sw);
  } else if (border === "keyline") {
    const sw = Math.max(1, scale);
    ctx.strokeStyle = theme.keylineColor;
    ctx.lineWidth = sw;
    ctx.strokeRect(x + sw / 2, y + sw / 2, w - sw, h - sw);
  }
}

/** Word-wrap helper that mirrors Konva's width-constrained line breaking. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

// ─── Frame renderer ───────────────────────────────────────────────────────────

async function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  spread: Spread,
  theme: ThemeTokens,
  scale: number,
  quality: "thumb" | "preview" | "original",
  spreadFilter: PhotoFilter | undefined,
): Promise<void> {
  const fx = frame.x * scale;
  const fy = frame.y * scale;
  const fw = frame.width * scale;
  const fh = frame.height * scale;
  const effectiveBorder: BorderStyle = frame.border ?? spread.borderDefault ?? theme.defaultBorder;

  ctx.save();

  // Apply frame rotation around its centre (matches Konva Group rotation)
  const hasRotation = frame.rotation && frame.rotation !== 0;
  if (hasRotation) {
    ctx.translate(fx + fw / 2, fy + fh / 2);
    ctx.rotate((frame.rotation * Math.PI) / 180);
    ctx.translate(-(fw / 2), -(fh / 2));
    await drawFrameContents(ctx, 0, 0, fw, fh, frame, spread, theme, scale, quality, effectiveBorder, spreadFilter);
    // White overlay: lower opacity % = more white (matches canvas FrameNode behaviour)
    const whiteOverlay = 1 - (frame.opacity ?? 1);
    if (whiteOverlay > 0) {
      ctx.globalAlpha = whiteOverlay;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, fw, fh);
    }
  } else {
    await drawFrameContents(ctx, fx, fy, fw, fh, frame, spread, theme, scale, quality, effectiveBorder, spreadFilter);
    const whiteOverlay = 1 - (frame.opacity ?? 1);
    if (whiteOverlay > 0) {
      ctx.globalAlpha = whiteOverlay;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fx, fy, fw, fh);
    }
  }

  ctx.restore();
}

async function drawFrameContents(
  ctx: CanvasRenderingContext2D,
  fx: number, fy: number, fw: number, fh: number,
  frame: Frame,
  spread: Spread,
  theme: ThemeTokens,
  scale: number,
  quality: "thumb" | "preview" | "original",
  effectiveBorder: BorderStyle,
  spreadFilter: PhotoFilter | undefined,
): Promise<void> {
  let photoDrawn = false;

  if (frame.photoId) {
    try {
      const blobs = await db.photoBlobs.get(frame.photoId);
      const blob = quality === "original"
        ? (blobs?.original ?? blobs?.preview ?? blobs?.thumb)
        : quality === "preview"
          ? (blobs?.preview ?? blobs?.thumb)
          : blobs?.thumb;
      if (blob) {
        const img = await loadImageFromBlob(blob);
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const frameAspect = fw / fh;

        // Determine CSS filter (spread-level filter merged with frame-level grain)
        const activeFilter = spreadFilter && spreadFilter !== "none"
          ? FILTER_PRESETS[spreadFilter]
          : "none";

        if (frame.fit === "contain") {
          const s = imgAspect > frameAspect ? fw / img.naturalWidth : fh / img.naturalHeight;
          const imgW = img.naturalWidth * s;
          const imgH = img.naturalHeight * s;
          const imgX = fx + (fw - imgW) / 2;
          const imgY = fy + (fh - imgH) / 2;
          ctx.fillStyle = spread.bg?.color ?? spread.background ?? theme.background;
          ctx.fillRect(fx, fy, fw, fh);
          ctx.filter = activeFilter;
          ctx.drawImage(img, imgX, imgY, imgW, imgH);
          ctx.filter = "none";
        } else {
          // Cover (default): fills frame completely, clipped
          const { offsetX, offsetY, zoom } = frame.crop;
          const zoomBase = imgAspect > frameAspect
            ? fh / img.naturalHeight
            : fw / img.naturalWidth;
          const z = zoomBase * zoom;
          const imgW = img.naturalWidth * z;
          const imgH = img.naturalHeight * z;
          const imgX = fx + (fw - imgW) * offsetX;
          const imgY = fy + (fh - imgH) * offsetY;
          ctx.save();
          ctx.beginPath();
          ctx.rect(fx, fy, fw, fh);
          ctx.clip();
          ctx.filter = activeFilter;
          ctx.drawImage(img, imgX, imgY, imgW, imgH);
          ctx.filter = "none";
          ctx.restore();
        }
        photoDrawn = true;
      }
    } catch { /* fall through to placeholder */ }
  }

  // Empty frame: paper-colored fill with subtle dashed outline (hidden for No Border / Soft Edge)
  if (!photoDrawn) {
    ctx.fillStyle = theme.background;
    ctx.fillRect(fx, fy, fw, fh);
    if (effectiveBorder !== "none" && effectiveBorder !== "soft") {
      ctx.save();
      ctx.strokeStyle = "rgba(160,156,147,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
      ctx.restore();
    }
  }

  // Film grain overlay (soft-light — independent of spread filter)
  if ((frame.grain ?? 0) > 0) {
    const pattern = makeGrainPattern(ctx);
    if (pattern) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, fw, fh);
      ctx.clip();
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = (frame.grain ?? 0) / 100;
      ctx.fillStyle = pattern;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.restore();
    }
  }

  // Soft edge — elliptical vignette that fades the photo into the spread background.
  // A circular radial gradient is drawn in a scaled coordinate space so it stretches
  // to an oval matching the frame's aspect ratio: all 4 edges fade equally, no rectangular seam.
  if (effectiveBorder === "soft") {
    const softEdgePct = frame.softEdge ?? 20;
    const bgColor = spread.bg?.type === "solid"
      ? spread.bg.color
      : (spread.background ?? theme.background);
    const bgSolid = hexToRgba(bgColor, 1);
    const bgClear  = hexToRgba(bgColor, 0);

    const cx = fx + fw / 2;
    const cy = fy + fh / 2;
    const r  = Math.max(fw, fh) / 2;
    const innerR = r * Math.max(0, 1 - softEdgePct / 50);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(fw / (2 * r), fh / (2 * r));
    const g = ctx.createRadialGradient(0, 0, innerR, 0, 0, r + 2);
    g.addColorStop(0, bgClear);
    g.addColorStop(1, bgSolid);
    ctx.fillStyle = g;
    ctx.fillRect(-(r + 2), -(r + 2), (r + 2) * 2, (r + 2) * 2);
    ctx.restore();
  }

  if (effectiveBorder !== "none" && effectiveBorder !== "soft") {
    drawBorder(ctx, fx, fy, fw, fh, effectiveBorder, theme, scale);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders a spread to an offscreen HTMLCanvasElement.
 * @param scale  px per mm. Use 1.5 for thumbnails, 4 for export.
 * @param quality  "thumb" = 320px blobs (fast), "preview" = 1600px blobs, "original" = full-res blobs.
 * @param spine  When set, draws a spine strip centered on the gutter (cover spread only).
 */
export async function renderSpreadToCanvas(
  spread: Spread,
  size: BookSize,
  theme: ThemeTokens,
  scale = 1.5,
  quality: "thumb" | "preview" | "original" = "thumb",
  spine?: { widthMm: number; color: string },
): Promise<HTMLCanvasElement> {
  const W = Math.round(size.pageWidthMm * 2 * scale);
  const H = Math.round(size.pageHeightMm * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D context");

  // Background — spread.bg takes precedence over spread.background, then theme
  if (spread.bg?.type === "gradient") {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, spread.bg.color);
    grad.addColorStop(1, spread.bg.colorB ?? spread.bg.color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (spread.bg?.type === "photo" && spread.bg.photoId) {
    // Solid base fill first (shows while/if photo fails)
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, W, H);
    try {
      const blobs = await db.photoBlobs.get(spread.bg.photoId);
      const blob = quality === "original"
        ? (blobs?.original ?? blobs?.preview ?? blobs?.thumb)
        : quality === "preview"
          ? (blobs?.preview ?? blobs?.thumb)
          : blobs?.thumb;
      if (blob) {
        const img = await loadImageFromBlob(blob);
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = W / H;
        let autoW: number, autoH: number;
        if (imgAspect > canvasAspect) { autoH = H; autoW = imgAspect * H; }
        else { autoW = W; autoH = W / imgAspect; }
        // Same 10% padding as canvas — ensures both axes overflow so dragged positions render correctly
        const minW = W * 1.1, minH = H * 1.1;
        if (autoW < minW || autoH < minH) {
          const bump = Math.max(minW / autoW, minH / autoH);
          autoW *= bump; autoH *= bump;
        }
        const dw = spread.bg.w !== undefined ? spread.bg.w * scale : autoW;
        const dh = spread.bg.h !== undefined ? spread.bg.h * scale : autoH;
        const dx = spread.bg.x !== undefined ? spread.bg.x * scale : (W - dw) / 2;
        const dy = spread.bg.y !== undefined ? spread.bg.y * scale : (H - dh) / 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        ctx.globalAlpha = spread.bg.opacity ?? 1;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      }
    } catch { /* fall through to solid background */ }
  } else {
    ctx.fillStyle = spread.bg?.color ?? spread.background ?? theme.background;
    ctx.fillRect(0, 0, W, H);
  }

  // Extra bgLayers — rendered above primary background
  for (const layer of (spread.bgLayers ?? []) as SpreadBgLayer[]) {
    try {
      const blobs = await db.photoBlobs.get(layer.photoId);
      const blob = quality === "original"
        ? (blobs?.original ?? blobs?.preview ?? blobs?.thumb)
        : quality === "preview"
          ? (blobs?.preview ?? blobs?.thumb)
          : blobs?.thumb;
      if (blob) {
        const img = await loadImageFromBlob(blob);
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = W / H;
        let autoW: number, autoH: number;
        if (imgAspect > canvasAspect) { autoH = H; autoW = imgAspect * H; }
        else { autoW = W; autoH = W / imgAspect; }
        // Same 10% padding as canvas
        const lMinW = W * 1.1, lMinH = H * 1.1;
        if (autoW < lMinW || autoH < lMinH) {
          const bump = Math.max(lMinW / autoW, lMinH / autoH);
          autoW *= bump; autoH *= bump;
        }
        const dw = layer.w !== undefined ? layer.w * scale : autoW;
        const dh = layer.h !== undefined ? layer.h * scale : autoH;
        const dx = layer.x !== undefined ? layer.x * scale : (W - dw) / 2;
        const dy = layer.y !== undefined ? layer.y * scale : (H - dh) / 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        // Draw photo at full opacity, then overlay white to achieve brightness effect
        ctx.drawImage(img, dx, dy, dw, dh);
        const whiteVeil = 1 - (layer.opacity ?? 0.85);
        if (whiteVeil > 0) {
          ctx.globalAlpha = whiteVeil;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(dx, dy, dw, dh);
        }
        ctx.restore();
      }
    } catch { /* fall through */ }
  }

  // Spine strip — centered on the gutter, cover spread only
  if (spine) {
    const sw = spine.widthMm * scale;
    const gx = size.pageWidthMm * scale; // gutter x
    const sx = gx - sw / 2;
    ctx.fillStyle = spine.color;
    ctx.fillRect(sx, 0, sw, H);
    // Inset score lines
    const inset = Math.max(1.5, sw * 0.1);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + inset, 0); ctx.lineTo(sx + inset, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + sw - inset, 0); ctx.lineTo(sx + sw - inset, H); ctx.stroke();
  }

  // Frames in z-order
  const sortedFrames = [...spread.frames].sort((a, b) => a.z - b.z);
  for (const frame of sortedFrames) {
    await drawFrame(ctx, frame, spread, theme, scale, quality, spread.filter);
  }

  // Ensure all text fonts are loaded before rendering (fixes Edit↔Preview sync).
  // Load each variant (normal + bold + italic) so the correct glyph shapes are used.
  if (spread.texts.length > 0) {
    const loadPromises: Promise<unknown>[] = [];
    for (const t of spread.texts) {
      const ts = theme.fonts[t.role as keyof typeof theme.fonts] ?? theme.fonts.caption;
      const family = t.fontFamily ?? ts.family;
      const sz = t.fontSize ?? ts.size;
      const weight = t.fontWeight ?? ts.weight;
      const style = t.fontStyle ?? ts.style;
      const bold = parseInt(weight) >= 600 || style === "bold";
      const italic = style === "italic";
      const descriptor = `${italic ? "italic " : ""}${bold ? "bold " : ""}${sz}px ${family}`;
      loadPromises.push(document.fonts.load(descriptor).catch(() => {}));
    }
    await Promise.all(loadPromises);
  }

  // Shape blocks — decorative rectangles (white boxes etc.); above frames, below text
  for (const shape of ([...(spread.shapes ?? [])] as ShapeBlock[]).sort((a, b) => a.z - b.z)) {
    ctx.save();
    ctx.globalAlpha = shape.opacity;
    ctx.fillStyle = shape.fill;
    const sx = shape.x * scale;
    const sy = shape.y * scale;
    const sw = shape.width * scale;
    const sh = shape.height * scale;
    if (shape.rotation) {
      ctx.translate(sx + sw / 2, sy + sh / 2);
      ctx.rotate((shape.rotation * Math.PI) / 180);
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    } else {
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.restore();
  }

  // Text blocks — correct baseline via textBaseline="top", with word wrapping + rotation.
  //
  // fontSize is stored in edit-canvas screen-pixels (the unit Konva uses with no Stage scale).
  // Scaling it by (scale / EDIT_REF_SCALE) keeps the font-size / wrapping-width ratio
  // constant across render scales, so word breaks and visual layout match the Edit view.
  // Each block is clipped to its bounding box to prevent overflow into adjacent elements.
  const EDIT_REF_SCALE = 1.5; // approx px/mm at which font sizes were authored in the Edit canvas
  for (const text of spread.texts) {
    const themeStyle = theme.fonts[text.role as keyof typeof theme.fonts] ?? theme.fonts.caption;
    const family = text.fontFamily ?? themeStyle.family;
    const sz     = text.fontSize   ?? themeStyle.size;
    const weight = text.fontWeight ?? themeStyle.weight;
    const style  = text.fontStyle  ?? themeStyle.style;
    const bold   = parseInt(weight) >= 600 || style === "bold";
    const italic = style === "italic";

    // Scale font proportionally so wrapping matches Edit at any canvas size
    const scaledSz = Math.max(4, sz * scale / EDIT_REF_SCALE);
    const fontStr = `${italic ? "italic " : ""}${bold ? "bold " : ""}${scaledSz}px ${family}`;
    const lineHeight = scaledSz * 1.3;

    ctx.save();
    ctx.font = fontStr;
    ctx.fillStyle = text.fontColor ?? themeStyle.fill;
    ctx.textAlign = text.align;
    ctx.textBaseline = "top";

    const lines = wrapText(ctx, text.text, text.width * scale);

    // Clip to height: explicit mm height wins; otherwise use the line count * lineHeight
    const clipHeightMm = text.height ?? (lines.length * lineHeight) / scale;

    if (text.rotation) {
      ctx.translate(text.x * scale, text.y * scale);
      ctx.rotate((text.rotation * Math.PI) / 180);
      ctx.beginPath();
      ctx.rect(0, 0, text.width * scale, clipHeightMm * scale);
      ctx.clip();
      const anchorX =
        text.align === "left"   ? 0
        : text.align === "right" ? text.width * scale
        : (text.width / 2) * scale;
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], anchorX, li * lineHeight);
      }
    } else {
      ctx.beginPath();
      ctx.rect(text.x * scale, text.y * scale, text.width * scale, clipHeightMm * scale);
      ctx.clip();
      const anchorX =
        text.align === "left"   ? text.x * scale
        : text.align === "right" ? (text.x + text.width) * scale
        : (text.x + text.width / 2) * scale;
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], anchorX, text.y * scale + li * lineHeight);
      }
    }

    ctx.restore();
  }

  // Stickers — emoji rendered above photos and text
  for (const sticker of (spread.stickers ?? []).sort((a, b) => a.z - b.z)) {
    ctx.save();
    ctx.globalAlpha = sticker.opacity ?? 1;
    ctx.font = `${sticker.sizeMm * scale}px serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const sx = sticker.x * scale;
    const sy = sticker.y * scale;
    if (sticker.rotation) {
      ctx.translate(sx, sy);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.fillText(sticker.emoji, 0, 0);
    } else {
      ctx.fillText(sticker.emoji, sx, sy);
    }
    ctx.restore();
  }

  return canvas;
}
