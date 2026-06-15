import type { BookSize, Frame, Spread } from "../model/types";
import { DEFAULT_TEMPLATE_CTX } from "./templates";

// Snap-guide math for free mode. Pure functions, all mm — the canvas converts
// to px at its own scale. Candidates: page/spread edges, margins, page centers,
// the gutter, and every other frame's edges/centers.

export interface SnapLine {
  axis: "x" | "y";
  /** mm position of the guide line in spread coordinates */
  at: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapLine[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SNAP_THRESHOLD_MM = 2;

export function snapCandidates(size: BookSize, others: Rect[]): { xs: number[]; ys: number[] } {
  const { pageWidthMm: pw, pageHeightMm: ph } = size;
  const m = DEFAULT_TEMPLATE_CTX.margin;
  const xs = [0, m, pw / 2, pw - m, pw, pw + m, pw * 1.5, 2 * pw - m, 2 * pw];
  const ys = [0, m, ph / 2, ph - m, ph];
  for (const r of others) {
    xs.push(r.x, r.x + r.width / 2, r.x + r.width);
    ys.push(r.y, r.y + r.height / 2, r.y + r.height);
  }
  return { xs, ys };
}

function bestSnap(edges: number[], candidates: number[], threshold: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const edge of edges) {
    for (const c of candidates) {
      const delta = c - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, at: c };
      }
    }
  }
  return best;
}

/** Snaps a rect being dragged; returns adjusted position + guides to draw. */
export function snapRect(
  moving: Rect,
  size: BookSize,
  others: Rect[],
  threshold: number = SNAP_THRESHOLD_MM,
): SnapResult {
  const { xs, ys } = snapCandidates(size, others);
  const sx = bestSnap([moving.x, moving.x + moving.width / 2, moving.x + moving.width], xs, threshold);
  const sy = bestSnap([moving.y, moving.y + moving.height / 2, moving.y + moving.height], ys, threshold);
  const guides: SnapLine[] = [];
  if (sx) guides.push({ axis: "x", at: sx.at });
  if (sy) guides.push({ axis: "y", at: sy.at });
  return {
    x: moving.x + (sx?.delta ?? 0),
    y: moving.y + (sy?.delta ?? 0),
    guides,
  };
}

/** Frames that cross the spread center — used for the standard-binding gutter
    warning: faces/subjects must stay off the fold (R-W5). */
export function framesCrossingGutter(spread: Spread, size: BookSize): Frame[] {
  const gutterX = size.pageWidthMm;
  return spread.frames.filter((f) => f.x < gutterX && f.x + f.width > gutterX);
}
