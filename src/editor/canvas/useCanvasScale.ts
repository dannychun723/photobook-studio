import { useEffect, useRef, useState } from "react";

/**
 * ResizeObserver hook: returns the current scale (px/mm) that fits the
 * spread (2×pageW × pageH mm) within the observed container, with breathing
 * room for the 44px ContextToolbar and a small stage margin.
 */
const STAGE_MARGIN = 24; // px each side

export function useCanvasScale(
  containerRef: React.RefObject<HTMLDivElement | null>,
  spreadWmm: number,
  spreadHmm: number,
): number {
  const [scale, setScale] = useState(0);
  const spreadWRef = useRef(spreadWmm);
  const spreadHRef = useRef(spreadHmm);
  spreadWRef.current = spreadWmm;
  spreadHRef.current = spreadHmm;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = (w: number, h: number) => {
      const sw = spreadWRef.current;
      const sh = spreadHRef.current;
      if (sw <= 0 || sh <= 0) return;
      const scaleW = (w - STAGE_MARGIN * 2) / sw;
      const scaleH = (h - STAGE_MARGIN * 2) / sh;
      setScale(Math.max(0, Math.min(scaleW, scaleH)));
    };

    compute(el.clientWidth, el.clientHeight);

    const ro = new ResizeObserver(([entry]) => {
      compute(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return scale;
}
