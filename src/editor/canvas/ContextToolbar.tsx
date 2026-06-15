import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BookSize, BorderStyle, Spread, ShapeBlock } from "../../model/types";
import { FONT_COLOR_GROUPS } from "../fontColors";
import { FONT_OPTIONS } from "../fonts";
import { updateSpread } from "../../db/spreadOps";
import { mergeFrames } from "../../layout/apply";
import { nanoid } from "nanoid";

interface ContextToolbarProps {
  spread: Spread;
  size: BookSize;
  mode: "layout" | "free";
  onModeChange: (mode: "layout" | "free") => void;
  selectedFrameIds: string[];
  selectedTextId?: string | null;
  selectedStickerId?: string | null;
  selectedShapeId?: string | null;
  selectedSpine?: boolean;
  onSpineColorChange?: (color: string) => void;
  isCover?: boolean;
  showSpine?: boolean;
  spineWidthMm?: number;
  onSpineWidthChange?: (width: number) => void;
  onSpineToggle?: () => void;
  isCropMode: boolean;
  onExitCropMode: () => void;
  onDeselectAll: () => void;
  onAddBanner?: (type: "upper" | "lower" | "free") => void;
  onAddPage?: () => void;
  onDeletePage?: () => void;
  canDeletePage?: boolean;
  onResetSpread?: () => void;
  pageLabel?: string;
  pageIndex?: number;
  pageCount?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onDuplicatePage?: () => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AlignLeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 2h10M1 5h6M1 8h10M1 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 2h10M3 5h6M1 8h10M3 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function AlignRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 2h10M5 5h6M1 8h10M5 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function VAlignTopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 1.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M3.5 3.5v6M6 3.5v4.5M8.5 3.5v6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
    </svg>
  );
}
function VAlignMiddleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M3.5 2v8M6 3v6M8.5 2v8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
    </svg>
  );
}
function VAlignBottomIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M3.5 2.5v6M6 4v5M8.5 2.5v6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
    </svg>
  );
}

// ─── Shared floating hook ─────────────────────────────────────────────────────

function useFloatingMenu(
  triggerRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLDivElement | null>,
) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return { open, setOpen, pos };
}

// ─── Shared popup wrapper ─────────────────────────────────────────────────────

function Popup({
  popupRef,
  pos,
  width,
  maxHeight = "60vh",
  children,
}: {
  popupRef: React.RefObject<HTMLDivElement | null>;
  pos: { left: number; top: number };
  width?: number;
  maxHeight?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={popupRef}
      className="fixed z-[200] overflow-hidden rounded-xl border border-[#e8e6e1] bg-white shadow-[0_4px_24px_rgba(28,25,23,0.12)]"
      style={{ left: pos.left, top: pos.top, width, maxHeight }}
    >
      {children}
    </div>
  );
}

// ─── Toolbar column pill ──────────────────────────────────────────────────────

function ColBtn({
  label,
  disabled = false,
  onClick,
  containerRef,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={containerRef}
      onClick={disabled ? undefined : onClick}
      className={`flex shrink-0 flex-col justify-center border-r border-[#e8e6e1] px-4 py-2 ${
        disabled
          ? "opacity-35"
          : onClick
          ? "cursor-pointer transition-colors hover:bg-[#f5f4f0]"
          : "cursor-default"
      }`}
    >
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ContextToolbar({
  spread,
  size,
  mode,
  selectedFrameIds,
  selectedTextId,
  selectedShapeId,
  selectedSpine,
  onSpineColorChange,
  isCover,
  showSpine,
  spineWidthMm,
  onSpineWidthChange,
  onSpineToggle,
  isCropMode,
  onExitCropMode,
  onDeselectAll,
  onAddBanner,
  onAddPage,
  onDeletePage,
  canDeletePage,
  onResetSpread,
  pageLabel,
  pageIndex,
  pageCount,
  onPrevPage,
  onNextPage,
  onDuplicatePage,
}: ContextToolbarProps) {
  // Floating trigger refs (HTMLDivElement — ColBtn renders a div)
  const bannerBtnRef = useRef<HTMLButtonElement>(null);
  const bannerMenuRef = useRef<HTMLDivElement>(null);
  const bannerFloating = useFloatingMenu(
    bannerBtnRef as unknown as React.RefObject<HTMLElement | null>,
    bannerMenuRef,
  );

  const pageBtnRef = useRef<HTMLButtonElement>(null);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const pageFloating = useFloatingMenu(
    pageBtnRef as unknown as React.RefObject<HTMLElement | null>,
    pageMenuRef,
  );

  const fontBtnRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const fontFloating = useFloatingMenu(
    fontBtnRef as React.RefObject<HTMLElement | null>,
    fontMenuRef,
  );
  const [fontSearch, setFontSearch] = useState("");
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);

  const colorBtnRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const colorFloating = useFloatingMenu(
    colorBtnRef as React.RefObject<HTMLElement | null>,
    colorMenuRef,
  );

  const spineColorBtnRef = useRef<HTMLDivElement>(null);
  const spineColorMenuRef = useRef<HTMLDivElement>(null);
  const spineColorFloating = useFloatingMenu(
    spineColorBtnRef as React.RefObject<HTMLElement | null>,
    spineColorMenuRef,
  );

  const hBtnRef = useRef<HTMLDivElement>(null);
  const hMenuRef = useRef<HTMLDivElement>(null);
  const hFloating = useFloatingMenu(
    hBtnRef as React.RefObject<HTMLElement | null>,
    hMenuRef,
  );

  const vBtnRef = useRef<HTMLDivElement>(null);
  const vMenuRef = useRef<HTMLDivElement>(null);
  const vFloating = useFloatingMenu(
    vBtnRef as React.RefObject<HTMLElement | null>,
    vMenuRef,
  );

  const selectedText = selectedTextId
    ? (spread.texts.find((t) => t.id === selectedTextId) ?? null)
    : null;
  const selectedFrame =
    selectedFrameIds.length === 1
      ? spread.frames.find((f) => f.id === selectedFrameIds[0])
      : undefined;
  const selectedShape: ShapeBlock | undefined = selectedShapeId
    ? (spread.shapes ?? []).find((sh) => sh.id === selectedShapeId)
    : undefined;

  const ROLE_SIZE_DEFAULTS: Record<string, number> = { heading: 36, body: 16, caption: 13 };
  const displayFontSize =
    selectedText?.fontSize ?? ROLE_SIZE_DEFAULTS[selectedText?.role ?? "caption"] ?? 35;
  const displayFontFamily =
    selectedText?.fontFamily ?? "'Playfair Display', Georgia, serif";
  const displayFontLabel =
    FONT_OPTIONS.find((f) => f.value === displayFontFamily)?.label ??
    displayFontFamily.split(",")[0].replace(/'/g, "").trim();
  const displayColor = selectedText?.fontColor ?? "#000000";
  const displayAlign = selectedText?.align ?? "center";
  const displayVAlign = selectedText?.verticalAlign ?? "top";

  // Clear draft when the selection changes (prevents stale draft bleeding into a different text block)
  useEffect(() => { setSizeDraft(null); }, [selectedTextId]);

  const filteredFonts = FONT_OPTIONS.filter(
    (f) =>
      fontSearch === "" || f.label.toLowerCase().includes(fontSearch.toLowerCase()),
  );

  // ── Handlers ──

  const handleAddText = async () => {
    const pageW = size.pageWidthMm;
    const pageH = size.pageHeightMm;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: [
        ...s.texts,
        {
          id: nanoid(),
          role: "caption" as const,
          text: "Add text here",
          x: pageW * 0.5,
          y: pageH * 0.5,
          width: pageW * 0.6,
          rotation: 0,
          z: 100 + s.texts.length,
          align: "center" as const,
          fontSize: 35,
          fontColor: "#000000",
        },
      ],
    }));
  };

  const handleFont = async (fontValue: string) => {
    fontFloating.setOpen(false);
    void document.fonts.load(`16px ${fontValue}`);
    if (!selectedTextId) return;
    const tid = selectedTextId;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: s.texts.map((t) =>
        t.id === tid ? { ...t, fontFamily: fontValue } : t,
      ),
    }));
  };

  const handleFontSize = async (sz: number) => {
    const clamped = Math.max(6, Math.min(120, sz));
    if (!selectedTextId) return;
    const tid = selectedTextId;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: s.texts.map((t) =>
        t.id === tid ? { ...t, fontSize: clamped } : t,
      ),
    }));
  };

  const handleColor = async (color: string) => {
    colorFloating.setOpen(false);
    if (!selectedTextId) return;
    const tid = selectedTextId;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: s.texts.map((t) =>
        t.id === tid ? { ...t, fontColor: color } : t,
      ),
    }));
  };

  const handleAlign = async (align: "left" | "center" | "right") => {
    hFloating.setOpen(false);
    if (!selectedTextId) return;
    const tid = selectedTextId;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: s.texts.map((t) => (t.id === tid ? { ...t, align } : t)),
    }));
  };

  const handleVAlign = async (verticalAlign: "top" | "middle" | "bottom") => {
    vFloating.setOpen(false);
    if (!selectedTextId) return;
    const tid = selectedTextId;
    await updateSpread(spread.id, (s) => ({
      ...s,
      texts: s.texts.map((t) =>
        t.id === tid ? { ...t, verticalAlign } : t,
      ),
    }));
  };

  const handleClearPhoto = async () => {
    if (!selectedFrame) return;
    const fid = selectedFrame.id;
    await updateSpread(spread.id, (s) => ({
      ...s,
      frames: s.frames.map((f) =>
        f.id === fid
          ? { ...f, photoId: undefined, crop: { offsetX: 0.5, offsetY: 0.5, zoom: 1 } }
          : f,
      ),
    }));
    onDeselectAll();
  };

  // ── Crop mode ──
  if (isCropMode) {
    return (
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-[#e8e6e1] bg-white px-4">
        <span className="text-[12px] text-[#706c63]">
          Crop mode — drag to pan · scroll to zoom
        </span>
        <button
          type="button"
          onClick={onExitCropMode}
          className="rounded-full border border-[#8b5e2a] px-4 py-1 text-[12px] text-[#8b5e2a] transition-colors hover:bg-[#8b5e2a] hover:text-white"
        >
          Done
        </button>
      </div>
    );
  }

  const valLabel = "text-[11px] font-medium text-[#1c1917]";
  const chevron = (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0 text-[#a09c93]">
      <path d="M2 3.5l2.5 2.5L7 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const ALIGN_ICONS = {
    left: <AlignLeftIcon />,
    center: <AlignCenterIcon />,
    right: <AlignRightIcon />,
  };
  const VALIGN_ICONS = {
    top: <VAlignTopIcon />,
    middle: <VAlignMiddleIcon />,
    bottom: <VAlignBottomIcon />,
  };

  return (
    <>
      {/* ── Main toolbar ── */}
      <div className="flex h-[48px] shrink-0 items-stretch border-b border-[#e8e6e1] bg-white">
        {/* Scrollable tools — scrolls when frame/text controls expand the bar */}
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">

        {/* + Text */}
        <div className="flex shrink-0 items-center border-r border-[#e8e6e1] px-3">
          <button
            type="button"
            onClick={() => void handleAddText()}
            className="flex items-center gap-1 rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] transition-colors hover:border-[#d9d7d0] hover:text-[#1c1917] whitespace-nowrap"
          >
            <span className="text-[14px] leading-none">+</span>
            Text
          </button>
        </div>

        {/* + Banner */}
        <div className="flex shrink-0 items-center border-r border-[#e8e6e1] px-3">
          <button
            ref={bannerBtnRef}
            type="button"
            onClick={() => bannerFloating.setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] transition-colors hover:border-[#d9d7d0] hover:text-[#1c1917] whitespace-nowrap"
          >
            <span className="text-[14px] leading-none">+</span>
            Banner
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0 text-[#a09c93]">
              <path d="M2 3.5l2.5 2.5L7 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Page menu */}
        <div className="flex shrink-0 items-center border-r border-[#e8e6e1] px-3">
          <button
            ref={pageBtnRef}
            type="button"
            onClick={() => pageFloating.setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] transition-colors hover:border-[#d9d7d0] hover:text-[#1c1917] whitespace-nowrap"
          >
            Page
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="shrink-0 text-[#a09c93]">
              <path d="M2 3.5l2.5 2.5L7 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Reset spread */}
        {onResetSpread && (
          <div className="flex shrink-0 items-center border-r border-[#e8e6e1] px-3">
            <button
              type="button"
              onClick={onResetSpread}
              title="Reset all visual styling to defaults"
              className="flex items-center gap-1 rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] transition-colors hover:border-[#d9d7d0] hover:text-[#1c1917] whitespace-nowrap"
            >
              ↺ Reset
            </button>
          </div>
        )}

        {/* ── Add Spine — visible on cover when spine is hidden ── */}
        {isCover && !showSpine && (
          <div className="flex shrink-0 items-center border-r border-[#e8e6e1] px-3">
            <button
              type="button"
              onClick={onSpineToggle}
              className="flex items-center gap-1 rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] transition-colors hover:border-[#d9d7d0] hover:text-[#1c1917] whitespace-nowrap"
            >
              <span className="text-[14px] leading-none">+</span>
              Spine
            </button>
          </div>
        )}

        {/* ── Spine controls — visible when the spine strip is selected ── */}
        {selectedSpine && (
          <>
            <ColBtn
              label="Spine Colour"
              containerRef={spineColorBtnRef}
              onClick={() => spineColorFloating.setOpen((o) => !o)}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-[18px] w-[18px] shrink-0 rounded-full border border-[#d9d7d0] shadow-sm"
                  style={{ background: spread.spineColor ?? "#c4962a" }}
                />
                {chevron}
              </div>
            </ColBtn>

            {/* Spine width slider */}
            <div className="flex shrink-0 flex-col justify-center border-r border-[#e8e6e1] px-4 py-2" style={{ minWidth: 140 }}>
              <div className="mb-0.5 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Width</p>
                <span className="text-[10px] tabular-nums text-[#a09c93]">{spineWidthMm ?? 12}mm</span>
              </div>
              <input
                type="range"
                min={6}
                max={24}
                step={1}
                value={spineWidthMm ?? 12}
                onChange={(e) => onSpineWidthChange?.(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#e8e6e1] accent-[#8b5e2a]"
              />
            </div>

            {/* Remove spine */}
            <div className="flex shrink-0 items-center border-r border-[#e8e6e1] px-3">
              <button
                type="button"
                onClick={onSpineToggle}
                className="rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] transition-colors hover:border-red-300 hover:text-red-500 whitespace-nowrap"
              >
                Remove spine
              </button>
            </div>
          </>
        )}

        {/* ── Text controls — only visible when a text block is selected ── */}
        {selectedTextId && (
          <>
            {/* FONT */}
            <ColBtn
              label="Font"
              containerRef={fontBtnRef}
              onClick={() => fontFloating.setOpen((o) => !o)}
            >
              <div className="flex items-center gap-1">
                <span
                  className={`${valLabel} max-w-[130px] truncate`}
                  style={{ fontFamily: displayFontFamily }}
                >
                  {displayFontLabel}
                </span>
                {chevron}
              </div>
            </ColBtn>

            {/* SIZE */}
            <ColBtn label="Size">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={6}
                  max={120}
                  value={sizeDraft ?? displayFontSize}
                  onChange={(e) => setSizeDraft(e.target.value)}
                  onBlur={() => {
                    if (sizeDraft !== null) {
                      void handleFontSize(Number(sizeDraft));
                      setSizeDraft(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      void handleFontSize(Number(sizeDraft ?? displayFontSize));
                      setSizeDraft(null);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-11 rounded-md border border-[#e8e6e1] bg-[#f5f4f0] px-1.5 py-0.5 text-center text-[12px] text-[#1c1917] tabular-nums focus:border-[#8b5e2a] focus:outline-none"
                />
                <div className="flex flex-col gap-[2px]">
                  <button
                    type="button"
                    onClick={() => void handleFontSize(displayFontSize + 1)}
                    className="flex h-[14px] w-[14px] items-center justify-center rounded text-[8px] text-[#a09c93] hover:bg-[#f0eeea] hover:text-[#1c1917]"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFontSize(displayFontSize - 1)}
                    className="flex h-[14px] w-[14px] items-center justify-center rounded text-[8px] text-[#a09c93] hover:bg-[#f0eeea] hover:text-[#1c1917]"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </ColBtn>

            {/* COLOUR */}
            <ColBtn
              label="Colour"
              containerRef={colorBtnRef}
              onClick={() => colorFloating.setOpen((o) => !o)}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-[18px] w-[18px] shrink-0 rounded-full border border-[#d9d7d0] shadow-sm"
                  style={{ background: displayColor }}
                />
                {chevron}
              </div>
            </ColBtn>

            {/* HORIZONTAL */}
            <ColBtn
              label="Horizontal"
              containerRef={hBtnRef}
              onClick={() => hFloating.setOpen((o) => !o)}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[#706c63]">{ALIGN_ICONS[displayAlign]}</span>
                <span className={valLabel + " capitalize"}>{displayAlign}</span>
                {chevron}
              </div>
            </ColBtn>

            {/* VERTICAL */}
            <ColBtn
              label="Vertical"
              containerRef={vBtnRef}
              onClick={() => vFloating.setOpen((o) => !o)}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[#706c63]">{VALIGN_ICONS[displayVAlign]}</span>
                <span className={valLabel + " capitalize"}>{displayVAlign}</span>
                {chevron}
              </div>
            </ColBtn>
          </>
        )}

        {/* ── Frame controls ── */}
        {selectedFrame && (
          <>
            <div className="mx-1 my-3 w-px shrink-0 bg-[#e8e6e1]" />

            {/* GRAIN */}
            <div className="flex shrink-0 flex-col justify-center border-r border-[#e8e6e1] px-4 py-2" style={{ minWidth: 120 }}>
              <div className="mb-0.5 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Grain</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] tabular-nums text-[#a09c93]">{selectedFrame.grain ?? 0}</span>
                  {(selectedFrame.grain ?? 0) > 0 && (
                    <button
                      type="button"
                      title="Reset grain"
                      onClick={() => {
                        const fid = selectedFrame.id;
                        void updateSpread(spread.id, (s) => ({
                          ...s, frames: s.frames.map((f) => f.id === fid ? { ...f, grain: 0 } : f),
                        }));
                      }}
                      className="text-[9px] text-[#a09c93] hover:text-[#8b5e2a]"
                    >↺</button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={selectedFrame.grain ?? 0}
                onChange={(e) => {
                  const fid = selectedFrame.id;
                  const val = Number(e.target.value);
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    frames: s.frames.map((f) => f.id === fid ? { ...f, grain: val } : f),
                  }));
                }}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#e8e6e1] accent-[#8b5e2a]"
              />
            </div>

            {/* OPACITY */}
            <div className="flex shrink-0 flex-col justify-center border-r border-[#e8e6e1] px-4 py-2" style={{ minWidth: 120 }}>
              <div className="mb-0.5 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Opacity</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] tabular-nums text-[#a09c93]">{Math.round((selectedFrame.opacity ?? 1) * 100)}%</span>
                  {(selectedFrame.opacity ?? 1) < 1 && (
                    <button
                      type="button"
                      title="Reset opacity"
                      onClick={() => {
                        const fid = selectedFrame.id;
                        void updateSpread(spread.id, (s) => ({
                          ...s, frames: s.frames.map((f) => f.id === fid ? { ...f, opacity: 1 } : f),
                        }));
                      }}
                      className="text-[9px] text-[#a09c93] hover:text-[#8b5e2a]"
                    >↺</button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round((selectedFrame.opacity ?? 1) * 100)}
                onChange={(e) => {
                  const fid = selectedFrame.id;
                  const val = Number(e.target.value) / 100;
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    frames: s.frames.map((f) => f.id === fid ? { ...f, opacity: val } : f),
                  }));
                }}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#e8e6e1] accent-[#8b5e2a]"
              />
            </div>
            {/* BORDER STYLE */}
            <div className="flex shrink-0 items-center gap-2 border-r border-[#e8e6e1] px-4 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Border</p>
              <select
                value={selectedFrame.border === null || selectedFrame.border === undefined ? "inherit" : selectedFrame.border}
                onChange={(e) => {
                  const fid = selectedFrame.id;
                  const v = e.target.value;
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    frames: s.frames.map((f) =>
                      f.id === fid
                        ? { ...f, border: v === "inherit" ? null : (v as BorderStyle) }
                        : f,
                    ),
                  }));
                }}
                className="rounded-md border border-[#e8e6e1] bg-[#f5f4f0] px-1.5 py-0.5 text-[11px] text-[#1c1917] focus:border-[#8b5e2a] focus:outline-none"
              >
                <option value="inherit">Normal</option>
                <option value="soft">Soft Edge</option>
                <option value="white">White Mat</option>
                <option value="keyline">Keyline</option>
                <option value="none">No Border</option>
              </select>
            </div>

            {/* SOFT EDGE AMOUNT — only when border is "soft" */}
            {selectedFrame.border === "soft" && (
              <div className="flex shrink-0 flex-col justify-center border-r border-[#e8e6e1] px-4 py-2" style={{ minWidth: 130 }}>
                <div className="mb-0.5 flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Soft Edge</p>
                  <span className="text-[10px] tabular-nums text-[#a09c93]">{selectedFrame.softEdge ?? 20}%</span>
                </div>
                <input
                  type="range" min={5} max={50} step={1}
                  value={selectedFrame.softEdge ?? 20}
                  onChange={(e) => {
                    const fid = selectedFrame.id;
                    const val = Number(e.target.value);
                    void updateSpread(spread.id, (s) => ({
                      ...s,
                      frames: s.frames.map((f) => f.id === fid ? { ...f, softEdge: val } : f),
                    }));
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#e8e6e1] accent-[#8b5e2a]"
                />
              </div>
            )}

            <div className="flex shrink-0 items-center gap-1.5 px-3">
              <button
                type="button"
                onClick={() => void handleClearPhoto()}
                className="rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] hover:text-[#1c1917] transition-colors"
              >
                Clear photo
              </button>
              {mode === "free" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const fid = selectedFrame.id;
                      void updateSpread(spread.id, (s) => ({
                        ...s,
                        frames: s.frames.map((f) =>
                          f.id === fid ? { ...f, z: f.z + 1 } : f,
                        ),
                      }));
                    }}
                    className="rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] hover:text-[#1c1917] transition-colors"
                  >
                    Forward
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fid = selectedFrame.id;
                      void updateSpread(spread.id, (s) => ({
                        ...s,
                        frames: s.frames.map((f) =>
                          f.id === fid ? { ...f, z: Math.max(0, f.z - 1) } : f,
                        ),
                      }));
                    }}
                    className="rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] hover:text-[#1c1917] transition-colors"
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Shape (white box) controls ── */}
        {selectedShape && (
          <>
            <div className="mx-1 my-3 w-px shrink-0 bg-[#e8e6e1]" />

            {/* Fill color */}
            <div className="flex shrink-0 items-center gap-2 border-r border-[#e8e6e1] px-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Fill</p>
              <input
                type="color"
                value={selectedShape.fill}
                onChange={(e) => {
                  const sid = selectedShape.id;
                  const val = e.target.value;
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    shapes: (s.shapes ?? []).map((sh) => sh.id === sid ? { ...sh, fill: val } : sh),
                  }));
                }}
                className="h-6 w-6 cursor-pointer rounded border border-[#e8e6e1]"
                title="Box fill colour"
              />
            </div>

            {/* Opacity */}
            <div className="flex shrink-0 flex-col justify-center border-r border-[#e8e6e1] px-4 py-2" style={{ minWidth: 120 }}>
              <div className="mb-0.5 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">Opacity</p>
                <span className="text-[10px] tabular-nums text-[#a09c93]">{Math.round(selectedShape.opacity * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={1}
                value={Math.round(selectedShape.opacity * 100)}
                onChange={(e) => {
                  const sid = selectedShape.id;
                  const val = Number(e.target.value) / 100;
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    shapes: (s.shapes ?? []).map((sh) => sh.id === sid ? { ...sh, opacity: val } : sh),
                  }));
                }}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#e8e6e1] accent-[#8b5e2a]"
              />
            </div>

            {/* Delete */}
            <div className="flex shrink-0 items-center px-3">
              <button
                type="button"
                onClick={() => {
                  const sid = selectedShape.id;
                  void updateSpread(spread.id, (s) => ({
                    ...s,
                    shapes: (s.shapes ?? []).filter((sh) => sh.id !== sid),
                  }));
                  onDeselectAll();
                }}
                className="rounded-full border border-[#e8e6e1] px-3 py-1 text-[11px] font-medium text-[#706c63] hover:text-[#1c1917] transition-colors"
              >
                Delete box
              </button>
            </div>
          </>
        )}

        {/* Merge (free mode, 2+ frames) */}
        {mode === "free" && selectedFrameIds.length >= 2 && (
          <>
            <div className="mx-1 my-3 w-px shrink-0 bg-[#e8e6e1]" />
            <div className="flex shrink-0 items-center px-3">
              <button
                type="button"
                onClick={async () => {
                  await updateSpread(spread.id, (s) => mergeFrames(s, selectedFrameIds));
                  onDeselectAll();
                }}
                className="rounded-full border border-[#8b5e2a] px-4 py-1 text-[11px] font-medium text-[#8b5e2a] transition-colors hover:bg-[#8b5e2a] hover:text-white"
              >
                Merge {selectedFrameIds.length} frames
              </button>
            </div>
          </>
        )}

        </div>{/* end scrollable tools */}

        {/* Fixed page nav — pinned to right edge, hidden when a canvas element is selected */}
        {pageCount !== undefined && selectedFrameIds.length === 0 && !selectedTextId && !selectedShapeId && (
          <div className="flex shrink-0 items-center border-l border-[#e8e6e1] pl-1 pr-2">
            <button
              type="button"
              disabled={!onPrevPage || (pageIndex ?? 0) <= 0}
              onClick={onPrevPage}
              title="Previous page"
              className="flex h-8 w-8 items-center justify-center rounded text-[15px] text-[#706c63] transition-colors hover:bg-[#f0eeea] disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>
            <span className="min-w-[72px] text-center text-[11px] text-[#706c63]">
              {pageLabel}
            </span>
            <span className="mr-1 text-[10px] tabular-nums text-[#a09c93]">
              {(pageIndex ?? 0) + 1}/{pageCount}
            </span>
            <button
              type="button"
              disabled={!onNextPage || (pageIndex ?? 0) >= pageCount - 1}
              onClick={onNextPage}
              title="Next page"
              className="flex h-8 w-8 items-center justify-center rounded text-[15px] text-[#706c63] transition-colors hover:bg-[#f0eeea] disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>
            <span className="mx-1.5 h-4 w-px bg-[#e8e6e1]" />
            <button
              type="button"
              onClick={onDuplicatePage}
              title="Duplicate page"
              className="flex h-8 w-8 items-center justify-center rounded text-[13px] text-[#a09c93] transition-colors hover:bg-[#f0eeea] hover:text-[#706c63]"
            >
              ⧉
            </button>
            {onDeletePage && (
              <button
                type="button"
                disabled={!canDeletePage}
                onClick={onDeletePage}
                title="Delete page"
                className="flex h-8 w-8 items-center justify-center rounded text-[13px] text-red-400/60 transition-colors hover:bg-[#f0eeea] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Font picker popup ── */}
      {selectedTextId && fontFloating.open && fontFloating.pos && (
        <Popup popupRef={fontMenuRef} pos={fontFloating.pos} width={220} maxHeight="60vh">
          <div className="border-b border-[#e8e6e1] p-2">
            <input
              type="text"
              autoFocus
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              placeholder="Search fonts…"
              className="w-full rounded-lg border border-[#e8e6e1] bg-[#f5f4f0] px-3 py-1.5 text-[11px] text-[#1c1917] placeholder:text-[#a09c93] focus:border-[#8b5e2a] focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "calc(60vh - 48px)" }}>
            {filteredFonts.map((f) => {
              const active = f.value === displayFontFamily;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => void handleFont(f.value)}
                  className={`flex w-full items-center border-b border-[#f0eeea] px-3 py-2.5 text-left transition-colors hover:bg-[#f5f4f0] ${
                    active ? "bg-[#fdf8f3]" : ""
                  }`}
                >
                  <span
                    className="text-[15px] text-[#1c1917] leading-tight"
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </span>
                  {active && (
                    <span className="ml-auto shrink-0 text-[11px] text-[#8b5e2a]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </Popup>
      )}

      {/* ── Spine colour picker popup ── */}
      {selectedSpine && spineColorFloating.open && spineColorFloating.pos && (
        <Popup popupRef={spineColorMenuRef} pos={spineColorFloating.pos} width={248} maxHeight="60vh">
          <div className="overflow-y-auto p-3" style={{ maxHeight: "60vh" }}>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">
              Spine Colour
            </p>
            {FONT_COLOR_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="mb-1.5 text-[10px] text-[#a09c93]">{group.label}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {group.colors.map((c) => {
                    const active = (spread.spineColor ?? "#c4962a").toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.value}
                        type="button"
                        title={c.name}
                        onClick={() => { spineColorFloating.setOpen(false); onSpineColorChange?.(c.value); }}
                        className={`flex flex-col items-center gap-0.5 rounded-lg p-1 transition-colors hover:bg-[#f5f4f0] ${
                          active ? "bg-[#f5f4f0] ring-1 ring-[#8b5e2a]" : ""
                        }`}
                      >
                        <span className="h-6 w-6 rounded-full border border-[#d9d7d0]" style={{ background: c.value }} />
                        <span className="truncate text-[9px] text-[#a09c93]">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 border-t border-[#e8e6e1] pt-2.5">
              <input
                type="color"
                value={spread.spineColor ?? "#c4962a"}
                onChange={(e) => onSpineColorChange?.(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-md border border-[#e8e6e1] bg-transparent"
                title="Custom colour"
              />
              <span className="text-[11px] text-[#706c63]">Custom colour</span>
            </div>
          </div>
        </Popup>
      )}

      {/* ── Colour picker popup ── */}
      {selectedTextId && colorFloating.open && colorFloating.pos && (
        <Popup popupRef={colorMenuRef} pos={colorFloating.pos} width={248} maxHeight="60vh">
          <div className="overflow-y-auto p-3" style={{ maxHeight: "60vh" }}>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#a09c93]">
              Colour
            </p>
            {FONT_COLOR_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="mb-1.5 text-[10px] text-[#a09c93]">{group.label}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {group.colors.map((c) => {
                    const active = displayColor.toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.value}
                        type="button"
                        title={c.name}
                        onClick={() => void handleColor(c.value)}
                        className={`flex flex-col items-center gap-0.5 rounded-lg p-1 transition-colors hover:bg-[#f5f4f0] ${
                          active ? "bg-[#f5f4f0] ring-1 ring-[#8b5e2a]" : ""
                        }`}
                      >
                        <span
                          className="h-6 w-6 rounded-full border border-[#d9d7d0]"
                          style={{ background: c.value }}
                        />
                        <span className="truncate text-[9px] text-[#a09c93]">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 border-t border-[#e8e6e1] pt-2.5">
              <input
                type="color"
                value={displayColor}
                onChange={(e) => void handleColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-md border border-[#e8e6e1] bg-transparent"
                title="Custom colour"
              />
              <span className="text-[11px] text-[#706c63]">Custom colour</span>
            </div>
          </div>
        </Popup>
      )}

      {/* ── Horizontal alignment popup ── */}
      {selectedTextId && hFloating.open && hFloating.pos && (
        <Popup popupRef={hMenuRef} pos={hFloating.pos} width={160}>
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => void handleAlign(a)}
              className={`flex w-full items-center gap-2.5 border-b border-[#f0eeea] px-4 py-2.5 text-left text-[12px] transition-colors last:border-0 hover:bg-[#f5f4f0] ${
                displayAlign === a ? "text-[#1c1917]" : "text-[#706c63]"
              }`}
            >
              <span>{ALIGN_ICONS[a]}</span>
              <span className="capitalize">{a}</span>
              {displayAlign === a && (
                <span className="ml-auto text-[10px] text-[#8b5e2a]">✓</span>
              )}
            </button>
          ))}
        </Popup>
      )}

      {/* ── Vertical alignment popup ── */}
      {selectedTextId && vFloating.open && vFloating.pos && (
        <Popup popupRef={vMenuRef} pos={vFloating.pos} width={160}>
          {(["top", "middle", "bottom"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => void handleVAlign(v)}
              className={`flex w-full items-center gap-2.5 border-b border-[#f0eeea] px-4 py-2.5 text-left text-[12px] transition-colors last:border-0 hover:bg-[#f5f4f0] ${
                displayVAlign === v ? "text-[#1c1917]" : "text-[#706c63]"
              }`}
            >
              <span>{VALIGN_ICONS[v]}</span>
              <span className="capitalize">{v}</span>
              {displayVAlign === v && (
                <span className="ml-auto text-[10px] text-[#8b5e2a]">✓</span>
              )}
            </button>
          ))}
        </Popup>
      )}

      {/* ── Page action popup ── */}
      {pageFloating.open && pageFloating.pos && (
        <div
          ref={pageMenuRef}
          className="fixed z-[200] overflow-hidden rounded-xl border border-[#e8e6e1] bg-white shadow-[0_4px_24px_rgba(28,25,23,0.12)]"
          style={{ left: pageFloating.pos.left, top: pageFloating.pos.top, width: 200 }}
        >
          <button
            type="button"
            onClick={() => { pageFloating.setOpen(false); onAddPage?.(); }}
            className="flex w-full flex-col border-b border-[#f0eeea] px-4 py-3 text-left hover:bg-[#f5f4f0]"
          >
            <span className="text-[12px] font-medium text-[#1c1917]">+ Add page</span>
            <span className="text-[10px] text-[#a09c93]">Insert a new spread after this one</span>
          </button>
          <button
            type="button"
            disabled={!canDeletePage}
            onClick={() => { pageFloating.setOpen(false); onDeletePage?.(); }}
            className="flex w-full flex-col px-4 py-3 text-left hover:bg-[#f5f4f0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-[12px] font-medium text-danger">Delete this page</span>
            <span className="text-[10px] text-[#a09c93]">Remove the current spread</span>
          </button>
        </div>
      )}

      {/* ── Banner type picker popup ── */}
      {bannerFloating.open && bannerFloating.pos && (
        <div
          ref={bannerMenuRef}
          className="fixed z-[200] overflow-hidden rounded-xl border border-[#e8e6e1] bg-white shadow-[0_4px_24px_rgba(28,25,23,0.12)]"
          style={{ left: bannerFloating.pos.left, top: bannerFloating.pos.top, width: 200 }}
        >
          {([
            { type: "upper" as const, label: "Upper Banner", desc: "White strip at top of page" },
            { type: "lower" as const, label: "Lower Banner", desc: "White strip at bottom of page" },
            { type: "free"  as const, label: "Free Banner",  desc: "Freely positioned white box" },
          ]).map(({ type, label, desc }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                bannerFloating.setOpen(false);
                onAddBanner?.(type);
              }}
              className="flex w-full flex-col border-b border-[#f0eeea] px-4 py-3 text-left last:border-0 hover:bg-[#f5f4f0]"
            >
              <span className="text-[12px] font-medium text-[#1c1917]">{label}</span>
              <span className="text-[10px] text-[#a09c93]">{desc}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
