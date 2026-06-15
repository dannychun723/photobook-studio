import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { nanoid } from "nanoid";
import type { BookSize, Frame, FrameCrop, Project, ShapeBlock, Spread, SpreadBgLayer, TextBlock } from "../../model/types";
import { db } from "../../db/db";
import { FrameNode } from "./FrameNode";
import { ContextToolbar } from "./ContextToolbar";
import { snapRect, framesCrossingGutter } from "../../layout/snapping";
import { assignPhoto, swapFramePhotos, updateSpread } from "../../db/spreadOps";
import { applyTemplate } from "../../layout/apply";
import { getTemplate } from "../../layout/templates";
import type { ThemeTokens, ThemeFontTokens } from "../../themes/themes";

const SAFE_ZONE_MM = 10; // R-W6

function konvaFontStyle(font: ThemeFontTokens): string {
  const bold = font.style === "bold" || parseInt(font.weight) >= 600;
  const italic = font.style === "italic";
  if (bold && italic) return "bold italic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

const SPINE_W_MM = 12;
const SPINE_COLOR = "#c4962a";

const STAGE_MARGIN = 24;

interface SpreadCanvasProps {
  spread: Spread;
  project: Project;
  size: BookSize;
  mode: "layout" | "free";
  onModeChange: (mode: "layout" | "free") => void;
  theme: ThemeTokens;
  isCover?: boolean;
  onFrameSelect?: (id: string | null) => void;
  onTextSelect?: (id: string | null) => void;
  onAddPage?: () => void;
  onDeletePage?: () => void;
  canDeletePage?: boolean;
  pageLabel?: string;
  pageIndex?: number;
  pageCount?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onDuplicatePage?: () => void;
  showGuides?: boolean;
}

interface CropDraft {
  frameId: string;
  crop: FrameCrop;
  startMouseX: number;
  startMouseY: number;
  startCropX: number;
  startCropY: number;
}

/** Find which frame (if any) contains a point in spread-mm coords */
function frameAtPoint(
  frames: Frame[],
  xMm: number,
  yMm: number,
): Frame | undefined {
  // Check in reverse z-order (highest z first)
  const sorted = [...frames].sort((a, b) => b.z - a.z);
  return sorted.find(
    (f) => xMm >= f.x && xMm <= f.x + f.width && yMm >= f.y && yMm <= f.y + f.height,
  );
}

function EmptyCanvas({ scale, spreadWmm, spreadHmm }: { scale: number; spreadWmm: number; spreadHmm: number }) {
  if (scale === 0) return null;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          width: spreadWmm * scale,
          height: spreadHmm * scale,
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 13,
            color: "rgba(92,95,104,0.8)",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          }}
        >
          No frames — pick a template or add frames in Free mode
        </span>
      </div>
    </div>
  );
}

export function SpreadCanvas({ spread, project, size, mode, onModeChange, theme, isCover, onFrameSelect, onTextSelect, onAddPage, onDeletePage, canDeletePage, pageLabel, pageIndex, pageCount, onPrevPage, onNextPage, onDuplicatePage, showGuides = true }: SpreadCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textTransformerRef = useRef<Konva.Transformer>(null);
  const stickerTransformerRef = useRef<Konva.Transformer>(null);
  const bgTransformerRef = useRef<Konva.Transformer>(null);
  const bgImageRef = useRef<Konva.Image>(null);
  const shapeTransformerRef = useRef<Konva.Transformer>(null);
  const frameLayerRef = useRef<Konva.Layer>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const spreadWmm = size.pageWidthMm * 2;
  const spreadHmm = size.pageHeightMm;

  // Single ResizeObserver so scale and offsets are always computed from the same
  // container dimensions — eliminates the split-observer timing issue that caused
  // the spread to shift right when the ContextToolbar or selection UI reflowed.
  const [containerDims, setContainerDims] = useState({ w: 0, h: 0 });

  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<boolean>(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [dragSourceFrameId, setDragSourceFrameId] = useState<string | null>(null);
  const [dropTargetFrameId, setDropTargetFrameId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgLayerImages, setBgLayerImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [bgSelectedId, setBgSelectedId] = useState<string | null>(null); // "primary" | layer.id
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedSpine, setSelectedSpine] = useState(false);
  const bgAutoLayoutRef = useRef({ autoW: 0, autoH: 0 });
  const bgLayerImgNodeRefs = useRef<Map<string, Konva.Image>>(new Map());
  const bgLayerAutoLayoutRef = useRef<Map<string, { autoW: number; autoH: number }>>(new Map());

  // Compute scale and offsets atomically from the same containerDims so they
  // never disagree mid-render (fixes the "page shifts right" centering bug).
  const scale = containerDims.w > 0 && containerDims.h > 0
    ? Math.max(0, Math.min(
        (containerDims.w - STAGE_MARGIN * 2) / spreadWmm,
        (containerDims.h - STAGE_MARGIN * 2) / spreadHmm,
      ))
    : 0;
  const spreadPxW = spreadWmm * scale;
  const spreadPxH = spreadHmm * scale;
  const pageWpx = size.pageWidthMm * scale;
  const safeZonePx = SAFE_ZONE_MM * scale;
  const offsetX = containerDims.w > 0 && spreadPxW > 0 ? (containerDims.w - spreadPxW) / 2 : 0;
  const offsetY = containerDims.h > 0 && spreadPxH > 0 ? (containerDims.h - spreadPxH) / 2 : 0;

  // Clear spine selection whenever any other element is selected
  useEffect(() => {
    if (selectedFrameIds.length > 0 || selectedTextId || selectedStickerId || selectedShapeId || bgSelectedId) {
      setSelectedSpine(false);
    }
  }, [selectedFrameIds, selectedTextId, selectedStickerId, selectedShapeId, bgSelectedId]);

  // Theme-derived text styles (updated on every render so callbacks see current theme)
  const themeTextStyle = {
    heading: { fontFamily: theme.fonts.heading.family, fontSize: theme.fonts.heading.size, fontStyle: konvaFontStyle(theme.fonts.heading), fill: theme.fonts.heading.fill },
    body:    { fontFamily: theme.fonts.body.family,    fontSize: theme.fonts.body.size,    fontStyle: konvaFontStyle(theme.fonts.body),    fill: theme.fonts.body.fill },
    caption: { fontFamily: theme.fonts.caption.family, fontSize: theme.fonts.caption.size, fontStyle: konvaFontStyle(theme.fonts.caption), fill: theme.fonts.caption.fill },
  } as Record<string, { fontFamily: string; fontSize: number; fontStyle: string; fill: string }>;

  // Resolves per-block overrides on top of theme defaults
  const resolveTextStyle = (t: TextBlock) => {
    const base = themeTextStyle[t.role] ?? themeTextStyle.caption;
    const family = t.fontFamily ?? base.fontFamily;
    const size   = t.fontSize   ?? base.fontSize;
    const weight = t.fontWeight ?? "400";
    const style  = t.fontStyle  ?? "normal";
    const bold   = parseInt(weight) >= 600 || style === "bold";
    const italic = style === "italic";
    const konvaStyle = bold && italic ? "bold italic" : bold ? "bold" : italic ? "italic" : "normal";
    return { fontFamily: family, fontSize: size, fontStyle: konvaStyle, fill: t.fontColor ?? base.fill };
  };


  // Gutter warning (R-W5): frames crossing center with standard binding
  const gutterFrames = framesCrossingGutter(spread, size);
  const showGutterWarning = gutterFrames.length > 0 && project.binding === "standard";

  // Single ResizeObserver — replaces both the old stageDims observer and useCanvasScale hook
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Emit frame selection to parent (for Transparent/Rotate left-panel tabs)
  useEffect(() => {
    onFrameSelect?.(selectedFrameIds[0] ?? null);
  }, [selectedFrameIds, onFrameSelect]);

  // Emit text selection to parent (for Text left-panel tab font sync)
  useEffect(() => {
    onTextSelect?.(selectedTextId);
  }, [selectedTextId, onTextSelect]);

  // Force Konva redraw whenever Google Fonts finish loading — fixes "font not changing" visually
  useEffect(() => {
    const handler = () => { stageRef.current?.batchDraw(); };
    document.fonts.addEventListener("loadingdone", handler as EventListener);
    return () => document.fonts.removeEventListener("loadingdone", handler as EventListener);
  }, []);

  // Load photo background image when spread.bg.type === "photo"
  useEffect(() => {
    const photoId = spread.bg?.type === "photo" ? spread.bg.photoId : null;
    if (!photoId) { setBgImage(null); return; }
    let cancelled = false;
    db.photoBlobs.get(photoId).then((blobs) => {
      const blob = blobs?.preview ?? blobs?.thumb;
      if (!blob || cancelled) return;
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); if (!cancelled) setBgImage(img); };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [spread.bg?.type, spread.bg?.photoId]);

  // Load images for extra bgLayers
  useEffect(() => {
    const layers: SpreadBgLayer[] = spread.bgLayers ?? [];
    if (layers.length === 0) { setBgLayerImages(new Map()); return; }
    let cancelled = false;
    const newImages = new Map<string, HTMLImageElement>();
    void Promise.all(layers.map(async (layer) => {
      const blobs = await db.photoBlobs.get(layer.photoId);
      const blob = blobs?.preview ?? blobs?.thumb;
      if (!blob || cancelled) return;
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => { URL.revokeObjectURL(url); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        img.src = url;
      });
      if (!cancelled) newImages.set(layer.id, img);
    })).then(() => { if (!cancelled) setBgLayerImages(new Map(newImages)); });
    return () => { cancelled = true; };
  }, [spread.bgLayers]);

  // Attach BG transformer to whichever bg image is selected (primary or a layer)
  useEffect(() => {
    const tr = bgTransformerRef.current;
    if (!tr) return;
    if (bgSelectedId === "primary" && bgImageRef.current) {
      tr.nodes([bgImageRef.current]);
    } else if (bgSelectedId) {
      const node = bgLayerImgNodeRefs.current.get(bgSelectedId);
      if (node) tr.nodes([node]);
      else tr.nodes([]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [bgSelectedId, bgImage, spread.bgLayers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingTextId) return; // don't intercept while editing text
      // Don't intercept keyboard shortcuts while user types in an input/textarea (e.g. font search)
      const tgt = e.target as HTMLElement;
      if (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT") return;
      if (e.key === "Escape") {
        if (cropMode) {
          void persistCropAndExit();
        } else {
          setSelectedFrameIds([]);
          setSelectedTextId(null);
          setSelectedSpine(false);
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !cropMode) {
        if (selectedFrameIds.length === 1) {
          const fid = selectedFrameIds[0];
          void updateSpread(spread.id, (s) => ({
            ...s,
            frames: s.frames.map((f) =>
              f.id === fid
                ? { ...f, photoId: undefined, crop: { offsetX: 0.5, offsetY: 0.5, zoom: 1 } }
                : f,
            ),
          }));
        }
        if (selectedTextId) {
          const tid = selectedTextId;
          void updateSpread(spread.id, (s) => ({
            ...s,
            texts: s.texts.filter((t) => t.id !== tid),
          }));
          setSelectedTextId(null);
        }
        if (selectedStickerId) {
          const sid = selectedStickerId;
          void updateSpread(spread.id, (s) => ({
            ...s,
            stickers: (s.stickers ?? []).filter((st) => st.id !== sid),
          }));
          setSelectedStickerId(null);
        }
        if (selectedShapeId) {
          const sid = selectedShapeId;
          void updateSpread(spread.id, (s) => ({
            ...s,
            shapes: (s.shapes ?? []).filter((sh) => sh.id !== sid),
          }));
          setSelectedShapeId(null);
        }
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey) && mode === "free" && selectedFrameIds.length === 1) {
        e.preventDefault();
        const fid = selectedFrameIds[0];
        void updateSpread(spread.id, (s) => {
          const src = s.frames.find((f) => f.id === fid);
          if (!src) return s;
          return {
            ...s,
            frames: [
              ...s.frames,
              {
                ...src,
                id: nanoid(),
                x: src.x + 5,
                y: src.y + 5,
                z: Math.max(...s.frames.map((f) => f.z)) + 1,
              },
            ],
          };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedFrameIds, selectedTextId, selectedStickerId, selectedShapeId, cropMode, cropDraft, mode, spread.id, editingTextId]);

  // Update Transformer when selection changes
  useEffect(() => {
    const tr = transformerRef.current;
    const layer = frameLayerRef.current;
    if (!tr || !layer) return;

    if (selectedFrameIds.length === 0 || cropMode) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedFrameIds
      .map((id) => layer.findOne(`#frame-${id}`))
      .filter((n): n is Konva.Node => n !== undefined);

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedFrameIds, cropMode, spread.frames]);

  // Attach text transformer to selected text node
  useEffect(() => {
    const tr = textTransformerRef.current;
    if (!tr) return;
    if (!selectedTextId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stageRef.current?.findOne(`#text-${selectedTextId}`);
    if (node) {
      tr.nodes([node as Konva.Node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedTextId, spread.texts]);

  // Attach sticker transformer to selected sticker
  useEffect(() => {
    const tr = stickerTransformerRef.current;
    if (!tr) return;
    if (!selectedStickerId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stageRef.current?.findOne(`#sticker-${selectedStickerId}`);
    if (node) {
      tr.nodes([node as Konva.Node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedStickerId, spread.stickers]);

  // Attach shape transformer to selected shape
  useEffect(() => {
    const tr = shapeTransformerRef.current;
    if (!tr) return;
    if (!selectedShapeId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stageRef.current?.findOne(`#shape-${selectedShapeId}`);
    if (node) {
      tr.nodes([node as Konva.Node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedShapeId, spread.shapes]);

  const persistCropAndExit = useCallback(async () => {
    if (cropDraft) {
      const { frameId, crop } = cropDraft;
      await updateSpread(spread.id, (s) => ({
        ...s,
        frames: s.frames.map((f) => (f.id === frameId ? { ...f, crop } : f)),
      }));
    }
    setCropMode(false);
    setCropDraft(null);
  }, [cropDraft, spread.id]);

  // Crop mode mouse handlers on stage container
  const cropMouseDownRef = useRef<{ x: number; y: number; crop: FrameCrop } | null>(null);

  const handleCropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!cropMode || !cropDraft) return;
      cropMouseDownRef.current = {
        x: e.clientX,
        y: e.clientY,
        crop: { ...cropDraft.crop },
      };
    },
    [cropMode, cropDraft],
  );

  const handleCropMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!cropMode || !cropDraft || !cropMouseDownRef.current) return;
      const frame = spread.frames.find((f) => f.id === cropDraft.frameId);
      if (!frame) return;
      const dx = (e.clientX - cropMouseDownRef.current.x) / scale;
      const dy = (e.clientY - cropMouseDownRef.current.y) / scale;
      const framePxW = frame.width * scale;
      const framePxH = frame.height * scale;
      // Translate mm delta to offsetX/Y fraction shift
      const newOffsetX = Math.max(0, Math.min(1, cropMouseDownRef.current.crop.offsetX - dx / framePxW));
      const newOffsetY = Math.max(0, Math.min(1, cropMouseDownRef.current.crop.offsetY - dy / framePxH));
      setCropDraft((d) => d ? { ...d, crop: { ...d.crop, offsetX: newOffsetX, offsetY: newOffsetY } } : d);
    },
    [cropMode, cropDraft, scale, spread.frames],
  );

  const handleCropMouseUp = useCallback(() => {
    cropMouseDownRef.current = null;
  }, []);

  const handleCropWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!cropMode || !cropDraft) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setCropDraft((d) =>
        d ? { ...d, crop: { ...d.crop, zoom: Math.max(1, Math.min(5, d.crop.zoom + delta)) } } : d,
      );
    },
    [cropMode, cropDraft],
  );

  // Photo drop from PhotoTray (HTML5 drag)
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const photoId = e.dataTransfer.getData("photoId");
      if (!photoId) return;
      const stage = stageRef.current;
      if (!stage || scale === 0) return;

      // Convert drop position to spread-mm coords
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const stageX = e.clientX - rect.left;
      const stageY = e.clientY - rect.top;
      const spreadX = (stageX - offsetX) / scale;
      const spreadY = (stageY - offsetY) / scale;

      const hitFrame = frameAtPoint(spread.frames, spreadX, spreadY);
      if (hitFrame) {
        void assignPhoto(spread.id, hitFrame.id, photoId);
      }
    },
    [scale, spread, offsetX, offsetY],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // HTML5 lowercases custom type keys: setData("photoId") → types contains "photoid"
    if (e.dataTransfer.types.includes("photoid") || e.dataTransfer.types.includes("text/plain")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // Frame drag handlers (free mode)
  const handleFrameDragStart = useCallback((frameId: string) => {
    setDragSourceFrameId(frameId);
  }, []);

  const handleFrameDragMove = useCallback(
    (frameId: string, rawXmm: number, rawYmm: number) => {
      const others = spread.frames.filter((f) => f.id !== frameId);
      const moving = spread.frames.find((f) => f.id === frameId);
      if (!moving) return;
      // rawXmm from FrameNode is g.x()/scale which includes offsetX/scale baked in
      const xMm = rawXmm - offsetX / scale;
      const yMm = rawYmm - offsetY / scale;
      const result = snapRect({ x: xMm, y: yMm, width: moving.width, height: moving.height }, size, others);
      setSnapGuides(result.guides);
    },
    [spread.frames, size, offsetX, offsetY, scale],
  );

  const handleFrameDragEnd = useCallback(
    async (frameId: string, rawXmm: number, rawYmm: number) => {
      setDragSourceFrameId(null);
      setSnapGuides([]);

      const moving = spread.frames.find((f) => f.id === frameId);
      if (!moving) return;

      // Check if dropped on another filled frame — swap
      if (dropTargetFrameId && dropTargetFrameId !== frameId) {
        await swapFramePhotos(spread.id, frameId, dropTargetFrameId);
        setDropTargetFrameId(null);
        return;
      }

      setDropTargetFrameId(null);

      // rawXmm from FrameNode is g.x()/scale which includes offsetX/scale baked in
      const xMm = rawXmm - offsetX / scale;
      const yMm = rawYmm - offsetY / scale;

      // Snap the final position
      const others = spread.frames.filter((f) => f.id !== frameId);
      const result = snapRect({ x: xMm, y: yMm, width: moving.width, height: moving.height }, size, others);

      await updateSpread(spread.id, (s) => ({
        ...s,
        frames: s.frames.map((f) =>
          f.id === frameId ? { ...f, x: result.x, y: result.y } : f,
        ),
      }));
    },
    [spread, size, dropTargetFrameId, offsetX, offsetY, scale],
  );

  const handleFrameSelect = useCallback((frameId: string) => {
    setSelectedFrameIds((prev) => {
      if (prev.includes(frameId)) return prev;
      return [frameId];
    });
    setSelectedTextId(null);
  }, []);

  const handleFrameDoubleClick = useCallback(
    (frameId: string) => {
      const frame = spread.frames.find((f) => f.id === frameId);
      if (!frame?.photoId) return; // only enter crop mode if frame has a photo
      setSelectedFrameIds([frameId]);
      setCropMode(true);
      setCropDraft({
        frameId,
        crop: { ...frame.crop },
        startMouseX: 0,
        startMouseY: 0,
        startCropX: frame.crop.offsetX,
        startCropY: frame.crop.offsetY,
      });
    },
    [spread.frames],
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage() || e.target.name() === "background") {
        if (cropMode) {
          void persistCropAndExit();
        } else {
          setSelectedFrameIds([]);
          setSelectedTextId(null);
          setSelectedStickerId(null);
          setSelectedShapeId(null);
          setBgSelectedId(null);
        }
      }
    },
    [cropMode, persistCropAndExit],
  );

  // Text block editing — show native <textarea> overlay
  const handleTextDblClick = useCallback(
    (textBlock: TextBlock) => {
      if (!stageRef.current || scale === 0) return;
      setEditingTextId(textBlock.id);

      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      // Position textarea at the text node's screen position
      const absX = offsetX + textBlock.x * scale;
      const absY = offsetY + textBlock.y * scale;

      const ta = document.createElement("textarea");
      ta.value = textBlock.text;
      ta.style.position = "fixed";
      ta.style.left = `${containerRect.left + absX}px`;
      ta.style.top = `${containerRect.top + absY}px`;
      ta.style.width = `${textBlock.width * scale}px`;
      ta.style.minHeight = "24px";
      ta.style.background = "rgba(255,255,255,0.97)";
      ta.style.color = "#1c1917";
      ta.style.border = "1px solid #8b5e2a";
      ta.style.boxShadow = "0 4px 20px rgba(0,0,0,0.10)";
      ta.style.borderRadius = "4px";
      ta.style.padding = "4px";
      const taStyle = resolveTextStyle(textBlock);
      ta.style.fontSize = `${Math.max(10, taStyle.fontSize)}px`;
      ta.style.fontFamily = taStyle.fontFamily;
      ta.style.zIndex = "1000";
      ta.style.resize = "none";
      ta.style.outline = "none";
      ta.style.overflow = "hidden";

      document.body.appendChild(ta);
      textAreaRef.current = ta;
      ta.focus();
      ta.select();

      const commit = async () => {
        const val = ta.value.trim() || textBlock.text;
        document.body.removeChild(ta);
        textAreaRef.current = null;
        setEditingTextId(null);
        const tid = textBlock.id;
        await updateSpread(spread.id, (s) => ({
          ...s,
          texts: s.texts.map((t) => (t.id === tid ? { ...t, text: val } : t)),
        }));
      };

      ta.addEventListener("blur", () => void commit());
      ta.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          void commit();
        }
        if (ev.key === "Escape") {
          document.body.removeChild(ta);
          textAreaRef.current = null;
          setEditingTextId(null);
        }
      });
    },
    [scale, offsetX, offsetY, spread.id, containerRef],
  );

  // Konva Transformer transform-end (free mode resize/rotate)
  // NOTE: e.target in onTransformEnd is the Transformer itself (scaleX always 1).
  // Must get the attached node via transformerRef.current?.nodes()[0].
  const handleTransformEnd = useCallback(
    async (frameId: string) => {
      const node = transformerRef.current?.nodes()[0] as Konva.Node | undefined;
      if (!node) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      const frame = spread.frames.find((f) => f.id === frameId);
      if (!frame) return;
      const newW = Math.max(10, frame.width * scaleX);
      const newH = Math.max(10, frame.height * scaleY);
      const newRot = node.rotation();
      // node.x/y is the rotation center — Group has no offsetX/Y, so node.x/y IS the center
      const centerX = (node.x() - offsetX) / scale;
      const centerY = (node.y() - offsetY) / scale;
      const newX = centerX - newW / 2;
      const newY = centerY - newH / 2;

      // Keep photo at the same absolute visual scale: compensate crop.zoom for the
      // change in cover-fit base scale (so frame acts as a clip window, not a photo resizer).
      let newCrop = frame.crop;
      const dims = photoDimMap.current.get(frameId);
      if (dims && frame.photoId) {
        const imgAspect = dims.w / dims.h;
        const oldFrameAspect = frame.width / frame.height;
        const newFrameAspect = newW / newH;
        const oldZoomBase = imgAspect > oldFrameAspect ? frame.height : frame.width;
        const newZoomBase = imgAspect > newFrameAspect ? newH : newW;
        if (newZoomBase > 0) {
          const compensatedZoom = Math.max(0.5, frame.crop.zoom * oldZoomBase / newZoomBase);
          newCrop = { ...frame.crop, zoom: compensatedZoom };
        }
      }

      await updateSpread(spread.id, (s) => ({
        ...s,
        frames: s.frames.map((f) =>
          f.id === frameId
            ? { ...f, x: newX, y: newY, width: newW, height: newH, rotation: newRot, crop: newCrop }
            : f,
        ),
      }));
    },
    [scale, spread, offsetX, offsetY],
  );

  const handleTextTransformEnd = useCallback(
    async (node: Konva.Node) => {
      if (!selectedTextId) return;
      const textBlock = spread.texts.find((t) => t.id === selectedTextId);
      if (!textBlock) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const newWidthMm = Math.max(20, textBlock.width * scaleX);
      const newHeightMm = textBlock.height
        ? Math.max(10, textBlock.height * scaleY)
        : Math.max(10, (node.height() * scaleY) / scale);
      const newXmm = (node.x() - offsetX) / scale;
      const newYmm = (node.y() - offsetY) / scale;
      const newRotation = node.rotation();
      node.scaleX(1);
      node.scaleY(1);
      node.width(newWidthMm * scale);
      node.height(newHeightMm * scale);
      await updateSpread(spread.id, (s) => ({
        ...s,
        texts: s.texts.map((t) =>
          t.id === selectedTextId
            ? { ...t, x: newXmm, y: newYmm, width: newWidthMm, height: newHeightMm, rotation: newRotation }
            : t,
        ),
      }));
    },
    [selectedTextId, spread, offsetX, offsetY, scale],
  );

  const handleStickerTransformEnd = useCallback(
    async (node: Konva.Node) => {
      if (!selectedStickerId) return;
      const sticker = (spread.stickers ?? []).find((s) => s.id === selectedStickerId);
      if (!sticker) return;
      const scaleX = node.scaleX();
      const newSizeMm = Math.max(5, sticker.sizeMm * scaleX);
      const newX = (node.x() - offsetX) / scale;
      const newY = (node.y() - offsetY) / scale;
      const newRotation = node.rotation();
      node.scaleX(1);
      node.scaleY(1);
      (node as Konva.Text).fontSize(newSizeMm * scale);
      await updateSpread(spread.id, (s) => ({
        ...s,
        stickers: (s.stickers ?? []).map((st) =>
          st.id === selectedStickerId
            ? { ...st, x: newX, y: newY, sizeMm: newSizeMm, rotation: newRotation }
            : st,
        ),
      }));
    },
    [selectedStickerId, spread, offsetX, scale],
  );

  // Map from frameId → natural image dimensions; used by handleTransformEnd to keep photo
  // at fixed absolute scale when the frame box is resized (so frame acts as a crop window).
  const photoDimMap = useRef(new Map<string, { w: number; h: number }>());

  const handleImageLoaded = useCallback((frameId: string, w: number, h: number) => {
    photoDimMap.current.set(frameId, { w, h });
  }, []);

  const handleAddBanner = useCallback(async (type: "upper" | "lower" | "free") => {
    let x: number, y: number, width: number, height: number;
    if (type === "upper") {
      x = 0; y = 0; width = spreadWmm; height = spreadHmm / 10;
    } else if (type === "lower") {
      x = 0; y = spreadHmm * 0.9; width = spreadWmm; height = spreadHmm / 10;
    } else {
      x = spreadWmm / 2 - 30; y = spreadHmm / 2 - 15; width = 60; height = 30;
    }
    const newShape: ShapeBlock = {
      id: nanoid(), x, y, width, height,
      fill: "#ffffff", opacity: 1, rotation: 0,
      z: 200 + (spread.shapes ?? []).length,
    };
    await updateSpread(spread.id, (s) => ({
      ...s,
      shapes: [...(s.shapes ?? []), newShape],
    }));
  }, [spread.id, spread.shapes, spreadWmm, spreadHmm]);

  const handleResetSpread = useCallback(async () => {
    await updateSpread(spread.id, (s) => {
      const base: Spread = {
        id: s.id,
        projectId: s.projectId,
        index: s.index,
        frames: [],
        texts: [],
        stickers: [],
        shapes: [],
        bgLayers: [],
      };
      return applyTemplate(base, getTemplate("two-up"), size);
    });
    setSelectedFrameIds([]);
    setSelectedTextId(null);
    setSelectedStickerId(null);
    setSelectedShapeId(null);
    setBgSelectedId(null);
  }, [spread.id, size]);

  // Add a vertical "Book Title" text block centred on the spine (cover only)
  const handleSpineColorChange = useCallback(async (color: string) => {
    await updateSpread(spread.id, (s) => ({ ...s, spineColor: color }));
  }, [spread.id]);

  const handleSpineWidthChange = useCallback(async (widthMm: number) => {
    await updateSpread(spread.id, (s) => ({ ...s, spineWidthMm: widthMm }));
  }, [spread.id]);

  const handleSpineToggle = useCallback(async () => {
    const currentlyShown = spread.showSpine !== false;
    await updateSpread(spread.id, (s) => ({ ...s, showSpine: !currentlyShown }));
    if (currentlyShown) setSelectedSpine(false);
  }, [spread.id, spread.showSpine]);

  const handleAddSpineText = useCallback(async () => {
    const spineW = spread.spineWidthMm ?? SPINE_W_MM;
    const textW = size.pageHeightMm * 0.70;   // length of text = visible height after -90° rotation
    const textH = spineW * 0.65;               // text node height = visible width after rotation
    // After rotation=-90° around (x,y): visual center = (x + textH/2, y - textW/2)
    const xMm = size.pageWidthMm - textH / 2;
    const yMm = size.pageHeightMm / 2 + textW / 2;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: [
        ...s.texts,
        {
          id: nanoid(),
          role: "heading" as const,
          text: "Book Title",
          x: xMm,
          y: yMm,
          width: textW,
          rotation: -90,
          z: 200 + s.texts.length,
          align: "center" as const,
          fontSize: Math.round(spineW * 0.55),
          fontColor: "#ffffff",
        },
      ],
    }));
  }, [spread.id, size]);

  const sortedFrames = [...spread.frames].sort((a, b) => a.z - b.z);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Context toolbar — at the TOP of the edit view */}
      <ContextToolbar
        spread={spread}
        size={size}
        mode={mode}
        onModeChange={onModeChange}
        selectedFrameIds={selectedFrameIds}
        selectedTextId={selectedTextId}
        selectedStickerId={selectedStickerId}
        selectedShapeId={selectedShapeId}
        selectedSpine={selectedSpine}
        onSpineColorChange={(color) => void handleSpineColorChange(color)}
        isCover={isCover}
        showSpine={spread.showSpine !== false}
        spineWidthMm={spread.spineWidthMm ?? SPINE_W_MM}
        onSpineWidthChange={(w) => void handleSpineWidthChange(w)}
        onSpineToggle={() => void handleSpineToggle()}
        isCropMode={cropMode}
        onExitCropMode={() => void persistCropAndExit()}
        onAddBanner={(type) => void handleAddBanner(type)}
        onAddPage={onAddPage}
        onDeletePage={onDeletePage}
        canDeletePage={canDeletePage}
        onResetSpread={() => void handleResetSpread()}
        pageLabel={pageLabel}
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onDuplicatePage={onDuplicatePage}
        onDeselectAll={() => {
          setSelectedFrameIds([]);
          setSelectedTextId(null);
          setSelectedStickerId(null);
          setSelectedShapeId(null);
          setSelectedSpine(false);
        }}
      />

      {/* Gutter warning (R-W5) */}
      {showGutterWarning && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-700/40 bg-amber-900/20 px-4 py-1.5">
          <span className="text-[12px] text-amber-400">
            ⚠ A frame crosses the center fold — use Layflat binding or keep subjects off the gutter (R-W5)
          </span>
        </div>
      )}

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 bg-[#dedad4]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={cropMode ? handleCropMouseDown : undefined}
        onMouseMove={cropMode ? handleCropMouseMove : undefined}
        onMouseUp={cropMode ? handleCropMouseUp : undefined}
        onWheel={cropMode ? handleCropWheel : undefined}
        style={{ cursor: cropMode ? "move" : "default" }}
      >
        {/* Vignette */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.3) 100%)" }}
        />

        {/* Cover page labels — Back Cover / Spine / Front Cover */}
        {isCover && scale > 0 && offsetX >= 0 && (
          <div
            className="pointer-events-none absolute z-[5] flex items-center select-none"
            style={{
              left: offsetX,
              top: Math.max(6, offsetY - 22),
              width: spreadPxW,
            }}
          >
            <span className="flex-1 text-[11px] text-ink-faint/80">Back Cover</span>
            <span
              className="text-center text-[11px] text-ink-faint/80"
              style={{ width: (spread.spineWidthMm ?? SPINE_W_MM) * scale }}
            >
              {spread.showSpine !== false ? "Spine" : "— no spine —"}
            </span>
            <span className="flex-1 text-right text-[11px] text-ink-faint/80">Front Cover</span>
          </div>
        )}

        {scale > 0 && containerDims.w > 0 && (
          <Stage
            ref={stageRef}
            width={containerDims.w}
            height={containerDims.h}
            onClick={handleStageClick}
            style={{ display: "block" }}
          >
            {/* Background layer */}
            <Layer>
              {/* Spread background — paper color from theme, with optional spread.bg override (R-TH1–6) */}
              <Rect
                name="background"
                x={offsetX}
                y={offsetY}
                width={spreadPxW}
                height={spreadPxH}
                fill={
                  spread.bg?.type === "gradient"
                    ? undefined
                    : (spread.bg?.color ?? spread.background ?? theme.background)
                }
                fillLinearGradientStartPoint={spread.bg?.type === "gradient" ? { x: 0, y: 0 } : undefined}
                fillLinearGradientEndPoint={spread.bg?.type === "gradient" ? { x: 0, y: spreadPxH } : undefined}
                fillLinearGradientColorStops={
                  spread.bg?.type === "gradient"
                    ? [0, spread.bg.color, 1, spread.bg.colorB ?? spread.bg.color]
                    : undefined
                }
                shadowBlur={40}
                shadowColor="rgba(0,0,0,0.55)"
                shadowOffsetY={12}
              />
              {/* Photo background — interactive: click to select, drag to reposition, Transformer handles to resize */}
              {bgImage && spread.bg?.type === "photo" && (() => {
                const imgAspect = bgImage.naturalWidth / bgImage.naturalHeight;
                const canvasAspect = spreadPxW / spreadPxH;
                let autoW: number, autoH: number;
                if (imgAspect > canvasAspect) {
                  autoH = spreadPxH; autoW = imgAspect * spreadPxH;
                } else {
                  autoW = spreadPxW; autoH = spreadPxW / imgAspect;
                }
                // Ensure ≥10% overflow in both axes so the image can be dragged in all 4 directions
                const minW = spreadPxW * 1.1;
                const minH = spreadPxH * 1.1;
                if (autoW < minW || autoH < minH) {
                  const bump = Math.max(minW / autoW, minH / autoH);
                  autoW *= bump; autoH *= bump;
                }
                bgAutoLayoutRef.current = { autoW, autoH };
                const bg = spread.bg;
                const imgW = bg.w !== undefined ? bg.w * scale : autoW;
                const imgH = bg.h !== undefined ? bg.h * scale : autoH;
                const imgX = bg.x !== undefined ? offsetX + bg.x * scale : offsetX + (spreadPxW - imgW) / 2;
                const imgY = bg.y !== undefined ? offsetY + bg.y * scale : offsetY + (spreadPxH - imgH) / 2;
                return (
                  <Group clipX={offsetX} clipY={offsetY} clipWidth={spreadPxW} clipHeight={spreadPxH}>
                    <KonvaImage
                      ref={bgImageRef}
                      image={bgImage}
                      x={imgX} y={imgY} width={imgW} height={imgH}
                      opacity={bg.opacity ?? 1}
                      listening={true}
                      draggable={bgSelectedId === "primary"}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        setBgSelectedId("primary");
                        setSelectedFrameIds([]);
                        setSelectedTextId(null);
                        setSelectedStickerId(null);
                      }}
                      onDragEnd={(e) => {
                        const node = e.target as Konva.Image;
                        const newXmm = (node.x() - offsetX) / scale;
                        const newYmm = (node.y() - offsetY) / scale;
                        void updateSpread(spread.id, (s) => ({
                          ...s,
                          bg: s.bg ? { ...s.bg, x: newXmm, y: newYmm } : s.bg,
                        }));
                      }}
                    />
                  </Group>
                );
              })()}
              {/* Extra bgLayers photos — draggable + resizable via shared bgTransformer */}
              {(spread.bgLayers ?? []).map((layer) => {
                const layerImg = bgLayerImages.get(layer.id);
                if (!layerImg) return null;
                const imgAspect = layerImg.naturalWidth / layerImg.naturalHeight;
                const canvasAspect = spreadPxW / spreadPxH;
                let autoW: number, autoH: number;
                if (imgAspect > canvasAspect) {
                  autoH = spreadPxH; autoW = imgAspect * spreadPxH;
                } else {
                  autoW = spreadPxW; autoH = spreadPxW / imgAspect;
                }
                // Ensure ≥10% overflow in both axes so dragging works in all 4 directions
                const lMinW = spreadPxW * 1.1;
                const lMinH = spreadPxH * 1.1;
                if (autoW < lMinW || autoH < lMinH) {
                  const bump = Math.max(lMinW / autoW, lMinH / autoH);
                  autoW *= bump; autoH *= bump;
                }
                bgLayerAutoLayoutRef.current.set(layer.id, { autoW, autoH });
                const imgW = layer.w !== undefined ? layer.w * scale : autoW;
                const imgH = layer.h !== undefined ? layer.h * scale : autoH;
                const imgX = layer.x !== undefined ? offsetX + layer.x * scale : offsetX + (spreadPxW - imgW) / 2;
                const imgY = layer.y !== undefined ? offsetY + layer.y * scale : offsetY + (spreadPxH - imgH) / 2;
                const lid = layer.id;
                return (
                  <Group key={lid} clipX={offsetX} clipY={offsetY} clipWidth={spreadPxW} clipHeight={spreadPxH}>
                    <KonvaImage
                      ref={(node) => {
                        if (node) bgLayerImgNodeRefs.current.set(lid, node);
                        else bgLayerImgNodeRefs.current.delete(lid);
                      }}
                      image={layerImg}
                      x={imgX} y={imgY} width={imgW} height={imgH}
                      opacity={1}
                      listening={true}
                      draggable={bgSelectedId === lid}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        setBgSelectedId(lid);
                        setSelectedFrameIds([]);
                        setSelectedTextId(null);
                        setSelectedStickerId(null);
                        setSelectedShapeId(null);
                      }}
                      onDragEnd={(e) => {
                        const node = e.target as Konva.Image;
                        const newXmm = (node.x() - offsetX) / scale;
                        const newYmm = (node.y() - offsetY) / scale;
                        void updateSpread(spread.id, (s) => ({
                          ...s,
                          bgLayers: (s.bgLayers ?? []).map((l) =>
                            l.id === lid ? { ...l, x: newXmm, y: newYmm } : l,
                          ),
                        }));
                      }}
                    />
                    {/* White veil: lower brightness → more white overlay on top of photo */}
                    <Rect
                      x={imgX} y={imgY} width={imgW} height={imgH}
                      fill="white"
                      opacity={1 - (layer.opacity ?? 0.85)}
                      listening={false}
                    />
                  </Group>
                );
              })}
              {/* Spine — cover spread only, centered on the gutter */}
              {isCover && spread.showSpine !== false && (() => {
                const sw = (spread.spineWidthMm ?? SPINE_W_MM) * scale;
                const sx = offsetX + pageWpx - sw / 2;
                const inset = Math.max(1.5, sw * 0.1);
                return (
                  <>
                    <Rect x={sx} y={offsetY} width={sw} height={spreadPxH}
                      fill={spread.spineColor ?? SPINE_COLOR}
                      listening={true}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        setSelectedSpine(true);
                      }}
                    />
                    <Line points={[sx + inset, offsetY, sx + inset, offsetY + spreadPxH]}
                      stroke="rgba(255,255,255,0.28)" strokeWidth={1} listening={false} />
                    <Line points={[sx + sw - inset, offsetY, sx + sw - inset, offsetY + spreadPxH]}
                      stroke="rgba(255,255,255,0.28)" strokeWidth={1} listening={false} />
                  </>
                );
              })()}
              {/* Spine title hint — appears when spine is visible and no vertical text block exists yet */}
              {isCover && spread.showSpine !== false && !spread.texts.some((t) => Math.abs(t.rotation) === 90) && (() => {
                const sw = (spread.spineWidthMm ?? SPINE_W_MM) * scale;
                const hintW = spreadPxH * 0.70;
                const hintH = sw * 0.65;
                return (
                  <Text
                    x={offsetX + pageWpx - hintH / 2}
                    y={offsetY + spreadPxH / 2 + hintW / 2}
                    text="↻ Add spine title"
                    fontSize={Math.max(7, sw * 0.38)}
                    fill="rgba(255,255,255,0.55)"
                    width={hintW}
                    align="center"
                    rotation={-90}
                    listening={true}
                    onClick={() => void handleAddSpineText()}
                  />
                );
              })()}
              {/* Gutter line (R-W5) — skipped for cover; spine replaces it */}
              {showGuides && !isCover && (
                <Line
                  points={[offsetX + pageWpx, offsetY, offsetX + pageWpx, offsetY + spreadPxH]}
                  stroke={theme.gutterColor}
                  strokeWidth={1}
                  listening={false}
                />
              )}
              {/* Safe zone dashes — left page (R-W6) */}
              {showGuides && (
                <Rect
                  x={offsetX + safeZonePx}
                  y={offsetY + safeZonePx}
                  width={pageWpx - safeZonePx * 2}
                  height={spreadPxH - safeZonePx * 2}
                  stroke={theme.safeZoneColor}
                  strokeWidth={1.5}
                  dash={[4, 4]}
                  fill="transparent"
                  listening={false}
                />
              )}
              {/* Safe zone dashes — right page */}
              {showGuides && (
                <Rect
                  x={offsetX + pageWpx + safeZonePx}
                  y={offsetY + safeZonePx}
                  width={pageWpx - safeZonePx * 2}
                  height={spreadPxH - safeZonePx * 2}
                  stroke={theme.safeZoneColor}
                  strokeWidth={1.5}
                  dash={[4, 4]}
                  fill="transparent"
                  listening={false}
                />
              )}
            </Layer>

            {/* Frames layer */}
            <Layer ref={frameLayerRef}>
              {sortedFrames.map((frame) => {
                const cropDraftForFrame =
                  cropMode && cropDraft?.frameId === frame.id ? cropDraft.crop : null;
                return (
                  <FrameNode
                    key={frame.id}
                    frame={{
                      ...frame,
                      x: frame.x + offsetX / scale,
                      y: frame.y + offsetY / scale,
                    }}
                    spread={spread}
                    scale={scale}
                    isSelected={selectedFrameIds.includes(frame.id)}
                    isCropMode={cropMode && selectedFrameIds.includes(frame.id)}
                    dragSourceFrameId={dragSourceFrameId}
                    theme={theme}
                    spreadFilter={spread.filter}
                    onSelect={handleFrameSelect}
                    onDoubleClick={handleFrameDoubleClick}
                    onDragStart={handleFrameDragStart}
                    onDragMove={handleFrameDragMove}
                    onDragEnd={handleFrameDragEnd}
                    onDropTarget={setDropTargetFrameId}
                    onDropTargetLeave={() => setDropTargetFrameId(null)}
                    cropDraft={cropDraftForFrame}
                    onImageLoaded={handleImageLoaded}
                  />
                );
              })}
              {/* Transformer — resize always on, rotate in free mode only */}
              <Transformer
                ref={transformerRef}
                resizeEnabled={true}
                rotateEnabled={mode === "free"}
                borderStroke="#c9a36a"
                borderStrokeWidth={1.5}
                anchorStroke="#c9a36a"
                anchorFill="#c9a36a"
                anchorSize={8}
                onTransformEnd={() => {
                  if (selectedFrameIds.length !== 1) return;
                  void handleTransformEnd(selectedFrameIds[0]);
                }}
              />
            </Layer>

            {/* Snap guides layer */}
            <Layer listening={false}>
              {snapGuides.map((guide, i) =>
                guide.axis === "x" ? (
                  <Line
                    key={i}
                    points={[offsetX + guide.at * scale, 0, offsetX + guide.at * scale, containerDims.h]}
                    stroke="#c9a36a"
                    strokeWidth={1}
                    dash={[4, 3]}
                  />
                ) : (
                  <Line
                    key={i}
                    points={[0, offsetY + guide.at * scale, containerDims.w, offsetY + guide.at * scale]}
                    stroke="#c9a36a"
                    strokeWidth={1}
                    dash={[4, 3]}
                  />
                ),
              )}
            </Layer>

            {/* UI / text layer */}
            <Layer>
              {spread.texts
                .filter((t) => t.id !== editingTextId)
                .map((textBlock) => {
                  const style = resolveTextStyle(textBlock);
                  return (
                    <Text
                      key={textBlock.id}
                      id={`text-${textBlock.id}`}
                      x={offsetX + textBlock.x * scale}
                      y={offsetY + textBlock.y * scale}
                      width={textBlock.width * scale}
                      height={textBlock.height ? textBlock.height * scale : undefined}
                      text={textBlock.text}
                      fontSize={style.fontSize}
                      fontFamily={style.fontFamily}
                      fontStyle={style.fontStyle}
                      fill={style.fill}
                      align={textBlock.align}
                      verticalAlign={textBlock.verticalAlign ?? "top"}
                      rotation={textBlock.rotation}
                      draggable
                      onClick={() => {
                        setSelectedTextId(textBlock.id);
                        setSelectedFrameIds([]);
                      }}
                      onDblClick={() => handleTextDblClick(textBlock)}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const newX = (node.x() - offsetX) / scale;
                        const newY = (node.y() - offsetY) / scale;
                        const tid = textBlock.id;
                        void updateSpread(spread.id, (s) => ({
                          ...s,
                          texts: s.texts.map((t) => (t.id === tid ? { ...t, x: newX, y: newY } : t)),
                        }));
                      }}
                    />
                  );
                })}
              {/* Width + height resize handles for selected text block */}
              <Transformer
                ref={textTransformerRef}
                resizeEnabled
                rotateEnabled={true}
                enabledAnchors={["middle-left", "middle-right", "top-center", "bottom-center", "top-left", "top-right", "bottom-left", "bottom-right"]}
                borderStroke="#c9a36a"
                borderStrokeWidth={1}
                borderDash={[4, 3]}
                anchorStroke="#c9a36a"
                anchorFill="white"
                anchorSize={8}
                anchorStyleFunc={(anchor) => {
                  if (anchor.hasName("rotater")) {
                    anchor.cornerRadius(anchor.width() / 2);
                    anchor.fill("#c9a36a");
                    anchor.stroke("#8b5e2a");
                    anchor.strokeWidth(1);
                  }
                }}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 20 * scale || newBox.height < 10 * scale ? oldBox : newBox
                }
                onTransformEnd={(e) => void handleTextTransformEnd(e.target)}
              />
            </Layer>

            {/* Sticker layer — emoji decorations; above photos and text */}
            <Layer>
              {(spread.stickers ?? []).map((sticker) => (
                <Text
                  key={sticker.id}
                  id={`sticker-${sticker.id}`}
                  x={offsetX + sticker.x * scale}
                  y={offsetY + sticker.y * scale}
                  text={sticker.emoji}
                  fontSize={sticker.sizeMm * scale}
                  opacity={sticker.opacity ?? 1}
                  rotation={sticker.rotation}
                  draggable
                  onClick={() => {
                    setSelectedStickerId(sticker.id);
                    setSelectedTextId(null);
                    setSelectedFrameIds([]);
                  }}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const sid = sticker.id;
                    const newX = (node.x() - offsetX) / scale;
                    const newY = (node.y() - offsetY) / scale;
                    void updateSpread(spread.id, (s) => ({
                      ...s,
                      stickers: (s.stickers ?? []).map((st) => st.id === sid ? { ...st, x: newX, y: newY } : st),
                    }));
                  }}
                />
              ))}
              {/* Resize + rotate transformer for selected sticker */}
              <Transformer
                ref={stickerTransformerRef}
                resizeEnabled
                rotateEnabled
                keepRatio
                borderStroke="#c9a36a"
                borderStrokeWidth={1}
                borderDash={[4, 3]}
                anchorStroke="#c9a36a"
                anchorFill="white"
                anchorSize={8}
                onTransformEnd={(e) => void handleStickerTransformEnd(e.target)}
              />
            </Layer>

            {/* Shapes layer — banners and decorative color fills; above frames and below stickers/text */}
            <Layer>
              {[...(spread.shapes ?? [])].sort((a, b) => a.z - b.z).map((shape) => (
                <Rect
                  key={shape.id}
                  id={`shape-${shape.id}`}
                  x={offsetX + shape.x * scale}
                  y={offsetY + shape.y * scale}
                  width={shape.width * scale}
                  height={shape.height * scale}
                  fill={shape.fill}
                  opacity={shape.opacity}
                  rotation={shape.rotation}
                  draggable
                  onClick={(e) => {
                    e.cancelBubble = true;
                    setSelectedShapeId(shape.id);
                    setSelectedFrameIds([]);
                    setSelectedTextId(null);
                    setSelectedStickerId(null);
                  }}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const sid = shape.id;
                    const newX = (node.x() - offsetX) / scale;
                    const newY = (node.y() - offsetY) / scale;
                    void updateSpread(spread.id, (s) => ({
                      ...s,
                      shapes: (s.shapes ?? []).map((sh) =>
                        sh.id === sid ? { ...sh, x: newX, y: newY } : sh,
                      ),
                    }));
                  }}
                />
              ))}
              {/* Transformer for selected shape — resize + rotate */}
              <Transformer
                ref={shapeTransformerRef}
                resizeEnabled
                rotateEnabled
                keepRatio={false}
                borderStroke="#c9a36a"
                borderStrokeWidth={1.5}
                anchorStroke="#c9a36a"
                anchorFill="white"
                anchorSize={8}
                onTransformEnd={() => {
                  const node = shapeTransformerRef.current?.nodes()[0] as Konva.Rect | undefined;
                  if (!node || !selectedShapeId) return;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  const sid = selectedShapeId;
                  const shape = (spread.shapes ?? []).find((sh) => sh.id === sid);
                  if (!shape) return;
                  const newW = Math.max(5, shape.width * scaleX);
                  const newH = Math.max(5, shape.height * scaleY);
                  const newX = (node.x() - offsetX) / scale;
                  const newY = (node.y() - offsetY) / scale;
                  const newRot = node.rotation();
                  node.scaleX(1);
                  node.scaleY(1);
                  node.width(newW * scale);
                  node.height(newH * scale);
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    shapes: (s.shapes ?? []).map((sh) =>
                      sh.id === sid
                        ? { ...sh, x: newX, y: newY, width: newW, height: newH, rotation: newRot }
                        : sh,
                    ),
                  }));
                }}
              />
            </Layer>
            {/* BG Transformer layer — topmost so its handles are never blocked by frame/text layers */}
            <Layer>
              <Transformer
                ref={bgTransformerRef}
                resizeEnabled={true}
                rotateEnabled={false}
                keepRatio={false}
                borderStroke="#8b5e2a"
                borderStrokeWidth={1.5}
                anchorStroke="#8b5e2a"
                anchorFill="white"
                anchorSize={8}
                onTransformEnd={() => {
                  const node = bgTransformerRef.current?.nodes()[0] as Konva.Image | undefined;
                  if (!node) return;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  const newXmm = (node.x() - offsetX) / scale;
                  const newYmm = (node.y() - offsetY) / scale;

                  if (bgSelectedId === "primary") {
                    const bgVal = spread.bg;
                    if (!bgVal) return;
                    const { autoW, autoH } = bgAutoLayoutRef.current;
                    const curW = bgVal.w !== undefined ? bgVal.w : autoW / scale;
                    const curH = bgVal.h !== undefined ? bgVal.h : autoH / scale;
                    const newWmm = Math.max(spreadWmm / 2, curW * scaleX);
                    const newHmm = Math.max(spreadHmm / 2, curH * scaleY);
                    node.width(newWmm * scale);
                    node.height(newHmm * scale);
                    void updateSpread(spread.id, (s) => ({
                      ...s,
                      bg: s.bg ? { ...s.bg, x: newXmm, y: newYmm, w: newWmm, h: newHmm } : s.bg,
                    }));
                  } else if (bgSelectedId) {
                    const lid = bgSelectedId;
                    const layer = spread.bgLayers?.find((l) => l.id === lid);
                    if (!layer) return;
                    const autoLayout = bgLayerAutoLayoutRef.current.get(lid);
                    if (!autoLayout) return;
                    const { autoW, autoH } = autoLayout;
                    const curW = layer.w !== undefined ? layer.w : autoW / scale;
                    const curH = layer.h !== undefined ? layer.h : autoH / scale;
                    const newWmm = Math.max(10, curW * scaleX);
                    const newHmm = Math.max(10, curH * scaleY);
                    node.width(newWmm * scale);
                    node.height(newHmm * scale);
                    void updateSpread(spread.id, (s) => ({
                      ...s,
                      bgLayers: (s.bgLayers ?? []).map((l) =>
                        l.id === lid ? { ...l, x: newXmm, y: newYmm, w: newWmm, h: newHmm } : l,
                      ),
                    }));
                  }
                }}
              />
            </Layer>
          </Stage>
        )}

        {/* Empty spread hint */}
        {scale > 0 && spread.frames.length === 0 && (
          <EmptyCanvas scale={scale} spreadWmm={spreadWmm} spreadHmm={spreadHmm} />
        )}
      </div>

    </div>
  );
}
