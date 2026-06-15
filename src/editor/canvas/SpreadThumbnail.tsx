import { useEffect, useState } from "react";
import { renderSpreadToCanvas } from "../../export/renderSpread";
import type { BookSize, Spread } from "../../model/types";
import type { ThemeTokens } from "../../themes/themes";

const DEFAULT_SPINE_COLOR = "#c4962a";

interface Props {
  spread: Spread;
  size: BookSize;
  theme: ThemeTokens;
  height: number;
  isCover?: boolean;
  onClick?: () => void;
}

export function SpreadThumbnail({ spread, size, theme, height, isCover, onClick }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const renderKey = [
    spread.id,
    theme.id,
    height,
    isCover ? "cover" : "",
    // Background (all fields)
    spread.bg?.type ?? "",
    spread.bg?.color ?? spread.background ?? "",
    spread.bg?.colorB ?? "",
    spread.bg?.photoId ?? "",
    String(spread.bg?.opacity ?? 1),
    // Spread-level settings
    spread.filter ?? "none",
    spread.borderDefault ?? "",
    spread.spineColor ?? "",
    // Frames — all rendering-relevant fields including geometry
    spread.frames.map((f) =>
      [
        f.id, f.photoId ?? "",
        f.x.toFixed(1), f.y.toFixed(1), f.width.toFixed(1), f.height.toFixed(1),
        (f.crop?.zoom ?? 1).toFixed(3),
        (f.crop?.offsetX ?? 0.5).toFixed(3),
        (f.crop?.offsetY ?? 0.5).toFixed(3),
        f.border ?? "", (f.opacity ?? 1).toFixed(2),
        f.grain ?? 0, f.rotation ?? 0, f.fit ?? "", f.softEdge ?? 0,
      ].join(":")
    ).join("|"),
    // Texts — full content and all style fields
    spread.texts.map((t) =>
      [
        t.id, t.text, t.x.toFixed(1), t.y.toFixed(1),
        (t.width ?? 0).toFixed(1), t.rotation ?? 0,
        t.fontSize ?? "", t.fontColor ?? "", t.fontFamily ?? "",
        t.fontWeight ?? "", t.fontStyle ?? "", t.align,
      ].join(":")
    ).join("|"),
    // Stickers
    (spread.stickers ?? []).map((s) =>
      `${s.id}:${s.emoji}:${s.x.toFixed(1)}:${s.y.toFixed(1)}:${s.sizeMm}:${s.rotation}:${(s.opacity ?? 1).toFixed(2)}`
    ).join("|"),
    // Shapes (banners)
    (spread.shapes ?? []).map((sh) =>
      [sh.id, sh.fill, sh.x.toFixed(1), sh.y.toFixed(1), sh.width.toFixed(1), sh.height.toFixed(1),
       (sh.opacity).toFixed(2), sh.rotation ?? 0].join(":")
    ).join("|"),
    // Extra bg layers
    (spread.bgLayers ?? []).map((l) =>
      `${l.id}:${l.photoId}:${(l.opacity ?? 1).toFixed(2)}`
    ).join("|"),
  ].join("~");

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    // Render at display resolution so the canvas is 1:1 with the card — no upscaling blur.
    // "preview" blobs (~1600px) are sharp enough; multiply by dpr for retina screens.
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const scale = (height / size.pageHeightMm) * dpr;
    renderSpreadToCanvas(spread, size, theme, scale, "preview", isCover ? { widthMm: 12, color: spread.spineColor ?? DEFAULT_SPINE_COLOR } : undefined)
      .then((canvas) => {
        if (!cancelled) setDataUrl(canvas.toDataURL("image/jpeg", 0.92));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey]);

  return (
    <div
      style={{ height }}
      className="relative w-full overflow-hidden bg-[#dedad4] cursor-pointer"
      onClick={onClick}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-[11px] text-ink-faint">Rendering…</span>
        </div>
      )}
    </div>
  );
}
