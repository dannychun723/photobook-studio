import { useEffect, useMemo, useRef } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { Frame, PhotoFilter, Spread, BorderStyle } from "../../model/types";
import type { ThemeTokens } from "../../themes/themes";
import { useFrameImage } from "./useFrameImage";
import { applyFilterToImage } from "../filters";

// Module-level static noise canvas for film grain — generated once, reused across all frames
let _grainCanvas: HTMLCanvasElement | null = null;
function getGrainCanvas(): HTMLCanvasElement {
  if (_grainCanvas) return _grainCanvas;
  const s = 256;
  _grainCanvas = document.createElement("canvas");
  _grainCanvas.width = s;
  _grainCanvas.height = s;
  const ctx = _grainCanvas.getContext("2d")!;
  const d = ctx.createImageData(s, s);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 90 + ((Math.random() * 76) | 0); // narrow range near 128 → fine grain under soft-light
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  return _grainCanvas;
}

// Creates an elliptical vignette mask: transparent center → opaque edges.
// Drawn using destination-out so the frame photo fades to reveal whatever is below
// (background color, gradient, or photo) without needing to know the bg color.
function makeVignetteCanvas(wPx: number, hPx: number, softEdgePct: number): HTMLCanvasElement {
  const W = Math.ceil(wPx) + 4;
  const H = Math.ceil(hPx) + 4;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const r = Math.max(W, H) / 2;
  const innerR = r * Math.max(0, 1 - softEdgePct / 50);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / (2 * r), H / (2 * r));
  const g = ctx.createRadialGradient(0, 0, innerR, 0, 0, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  return canvas;
}

// Border colors and widths (R-W2, R-W3, R-W4) — colors from theme so mats match paper
function getBorderStyle(
  effectiveBorder: BorderStyle,
  scale: number,
  theme: ThemeTokens,
): { stroke: string; strokeWidth: number } | null {
  switch (effectiveBorder) {
    case "white":
      return { stroke: theme.whiteBorderColor, strokeWidth: 4 * scale };
    case "keyline":
      return { stroke: theme.keylineColor, strokeWidth: 1 * scale };
    case "soft":
    case "none":
    default:
      return null;
  }
}

interface FrameNodeProps {
  frame: Frame;
  spread: Spread;
  scale: number;
  isSelected: boolean;
  isCropMode: boolean;
  dragSourceFrameId: string | null;
  theme: ThemeTokens;
  spreadFilter?: PhotoFilter;
  onSelect: (frameId: string) => void;
  onDoubleClick: (frameId: string) => void;
  onDragStart: (frameId: string) => void;
  onDragMove: (frameId: string, x: number, y: number) => void;
  onDragEnd: (frameId: string, x: number, y: number) => void;
  onDropTarget: (frameId: string) => void;
  onDropTargetLeave: () => void;
  cropDraft: { offsetX: number; offsetY: number; zoom: number } | null;
  onImageLoaded?: (frameId: string, w: number, h: number) => void;
}

export function FrameNode({
  frame,
  spread,
  scale,
  isSelected,
  isCropMode,
  dragSourceFrameId,
  theme,
  spreadFilter,
  onSelect,
  onDoubleClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDropTarget,
  onDropTargetLeave,
  cropDraft,
  onImageLoaded,
}: FrameNodeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const img = useFrameImage(frame.photoId);

  // Report natural image dimensions to parent so it can compensate crop zoom on frame resize
  useEffect(() => {
    if (!img || !onImageLoaded) return;
    const el = img as HTMLImageElement;
    const w = el.naturalWidth ?? (el as unknown as HTMLCanvasElement).width ?? 0;
    const h = el.naturalHeight ?? (el as unknown as HTMLCanvasElement).height ?? 0;
    if (w > 0 && h > 0) onImageLoaded(frame.id, w, h);
  }, [img, frame.id, onImageLoaded]);

  // Apply spread color filter via offscreen canvas so both canvas and Konva stay in sync.
  const filteredImg = useMemo(() => {
    if (!img) return null;
    return applyFilterToImage(img, spreadFilter ?? "none");
  }, [img, spreadFilter]);

  // Effective border: frame override > spread default > theme default (non-destructive)
  const effectiveBorder: BorderStyle = frame.border ?? spread.borderDefault ?? theme.defaultBorder;
  const borderProps = getBorderStyle(effectiveBorder, scale, theme);

  const xPx = frame.x * scale;
  const yPx = frame.y * scale;
  const wPx = frame.width * scale;
  const hPx = frame.height * scale;

  // Override getClientRect so Transformer handles land exactly on the visual frame border.
  // By default Konva unions all children's bounding boxes — the cover-fit KonvaImage extends
  // well beyond the clip region (it is only visually clipped, not bbox-clipped), inflating
  // the Group rect and pushing Transformer handles far outside the frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = groupRef.current as any;
    if (!group) return;
    const orig = group.getClientRect;
    group.getClientRect = (cfg?: any) => {
      const local = { x: -wPx / 2, y: -hPx / 2, width: wPx, height: hPx };
      if (cfg?.skipTransform) return local;
      return group._transformedRect(local, cfg?.relativeTo ?? null);
    };
    return () => { group.getClientRect = orig; };
  }, [wPx, hPx]);

  // Empty frames use paper-colored background; dashed outline only when border style is visible
  const showEmptyOutline = !frame.photoId && effectiveBorder !== "none" && effectiveBorder !== "soft";
  const fillColor = frame.photoId
    ? filteredImg
      ? frame.fit === "contain" ? theme.background : "#000000"
      : "#1a1c22" // loading state
    : theme.background; // empty: paper color

  const activeCrop = cropDraft ?? frame.crop;

  let imgX = 0,
    imgY = 0,
    imgW = wPx,
    imgH = hPx;

  if (filteredImg) {
    const srcW = "naturalWidth" in filteredImg ? filteredImg.naturalWidth : filteredImg.width;
    const srcH = "naturalHeight" in filteredImg ? filteredImg.naturalHeight : filteredImg.height;
    const imgAspect = srcW / srcH;
    const frameAspect = wPx / hPx;

    if (frame.fit === "contain") {
      const s = imgAspect > frameAspect ? wPx / srcW : hPx / srcH;
      imgW = srcW * s;
      imgH = srcH * s;
      imgX = (wPx - imgW) / 2;
      imgY = (hPx - imgH) / 2;
    } else {
      const zoomBase = imgAspect > frameAspect ? hPx / srcH : wPx / srcW;
      const zoom = zoomBase * activeCrop.zoom;
      imgW = srcW * zoom;
      imgH = srcH * zoom;
      imgX = (wPx - imgW) * activeCrop.offsetX;
      imgY = (hPx - imgH) * activeCrop.offsetY;
    }
  }

  const isDragTarget =
    dragSourceFrameId !== null &&
    dragSourceFrameId !== frame.id &&
    frame.photoId !== undefined;

  const isDraggable = !isCropMode;

  const whiteOverlay = 1 - (frame.opacity ?? 1); // 0 = no overlay, 1 = full white

  // Elliptical vignette canvas — regenerated only when frame size or softEdge changes.
  // Uses destination-out compositing so edges erase into the Background layer below.
  const vignetteCanvas = useMemo(() => {
    if (effectiveBorder !== "soft" || wPx <= 0 || hPx <= 0) return null;
    return makeVignetteCanvas(wPx, hPx, frame.softEdge ?? 20);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBorder, wPx, hPx, frame.softEdge]);

  return (
    // Group positioned at center (xPx+wPx/2, yPx+hPx/2) with NO offsetX/Y so that
    // Konva's getClientRect() returns the correct bounding box and Transformer handles
    // land exactly on the frame's visual border.
    // All children are offset by (-wPx/2, -hPx/2) to render from top-left.
    <Group
      id={`frame-${frame.id}`}
      ref={groupRef}
      x={xPx + wPx / 2}
      y={yPx + hPx / 2}
      rotation={frame.rotation}
      draggable={isDraggable}
      onClick={() => onSelect(frame.id)}
      onDblClick={() => onDoubleClick(frame.id)}
      onDragStart={() => onDragStart(frame.id)}
      onDragMove={(e) => {
        const g = e.target as Konva.Group;
        onDragMove(frame.id, (g.x() - wPx / 2) / scale, (g.y() - hPx / 2) / scale);
      }}
      onDragEnd={(e) => {
        const g = e.target as Konva.Group;
        onDragEnd(frame.id, (g.x() - wPx / 2) / scale, (g.y() - hPx / 2) / scale);
        g.x(xPx + wPx / 2);
        g.y(yPx + hPx / 2);
      }}
      onMouseEnter={() => {
        if (dragSourceFrameId && dragSourceFrameId !== frame.id && frame.photoId) {
          onDropTarget(frame.id);
        }
      }}
      onMouseLeave={() => {
        if (dragSourceFrameId) onDropTargetLeave();
      }}
    >
      {/* Background rect — empty frames show paper color with dashed outline (unless No Border/Soft Edge) */}
      <Rect
        x={-wPx / 2}
        y={-hPx / 2}
        width={wPx}
        height={hPx}
        fill={fillColor}
        stroke={showEmptyOutline ? "rgba(160,156,147,0.5)" : borderProps?.stroke}
        strokeWidth={showEmptyOutline ? 1 : borderProps?.strokeWidth}
        dash={showEmptyOutline ? [5, 4] : undefined}
        strokeEnabled={showEmptyOutline || !!borderProps}
        cornerRadius={0}
      />

      {/* Photo image with cover-fit crop via clipRect */}
      {filteredImg && (
        <Group
          clipX={-wPx / 2}
          clipY={-hPx / 2}
          clipWidth={wPx}
          clipHeight={hPx}
        >
          <KonvaImage
            image={filteredImg as HTMLImageElement}
            x={imgX - wPx / 2}
            y={imgY - hPx / 2}
            width={imgW}
            height={imgH}
            listening={false}
          />
          {/* Border on top of image */}
          {borderProps && (
            <Rect
              x={-wPx / 2}
              y={-hPx / 2}
              width={wPx}
              height={hPx}
              fill="transparent"
              stroke={borderProps.stroke}
              strokeWidth={borderProps.strokeWidth}
              listening={false}
            />
          )}
        </Group>
      )}

      {/* Film grain overlay — blends with photo using soft-light for a film-stock look */}
      {(frame.grain ?? 0) > 0 && (
        <Rect
          x={-wPx / 2}
          y={-hPx / 2}
          width={wPx}
          height={hPx}
          fillPatternImage={getGrainCanvas() as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          globalCompositeOperation="soft-light"
          opacity={(frame.grain ?? 0) / 100}
          listening={false}
        />
      )}

      {/* Soft edge — elliptical vignette that fades the photo into the spread background.
           A pre-rendered canvas is scaled to the frame dimensions, turning the circular
           gradient into an oval that touches all 4 edges uniformly (no rectangular seam). */}
      {effectiveBorder === "soft" && vignetteCanvas && (
        <KonvaImage
          image={vignetteCanvas as unknown as HTMLImageElement}
          x={-wPx / 2 - 2}
          y={-hPx / 2 - 2}
          width={wPx + 4}
          height={hPx + 4}
          globalCompositeOperation="destination-out"
          listening={false}
        />
      )}

      {/* White overlay — lower opacity % = more white (user-visible fade-to-white effect) */}
      {whiteOverlay > 0 && (
        <Rect
          x={-wPx / 2}
          y={-hPx / 2}
          width={wPx}
          height={hPx}
          fill="white"
          opacity={whiteOverlay}
          listening={false}
        />
      )}

      {/* Placeholder text for empty frames */}
      {!frame.photoId && (
        <Text
          x={-wPx / 2}
          y={-hPx / 2}
          text="Drop photo here"
          width={wPx}
          height={hPx}
          align="center"
          verticalAlign="middle"
          fontSize={Math.min(13, wPx * 0.07)}
          fill="rgba(140,132,120,0.55)"
          listening={false}
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        />
      )}

      {/* Swap target overlay */}
      {isDragTarget && (
        <Rect
          x={-wPx / 2}
          y={-hPx / 2}
          width={wPx}
          height={hPx}
          fill="rgba(201,163,106,0.25)"
          stroke="#c9a36a"
          strokeWidth={2}
          listening={false}
        />
      )}

      {/* Crop mode hint */}
      {isCropMode && isSelected && (
        <Text
          x={-wPx / 2}
          y={hPx / 2 - 26}
          text="Drag to pan  |  Scroll to zoom"
          width={wPx}
          align="center"
          fontSize={11}
          fill="rgba(255,255,255,0.6)"
          listening={false}
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        />
      )}
    </Group>
  );
}
