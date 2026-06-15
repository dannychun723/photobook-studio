import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate, templateCtx } from "../src/layout/templates";
import { applyTemplate, mergeFrames } from "../src/layout/apply";
import { framesCrossingGutter, snapRect } from "../src/layout/snapping";
import { BOOK_SIZES, getBookSize } from "../src/model/bookSizes";
import type { Spread } from "../src/model/types";

const square = getBookSize("square-21");

function makeSpread(templateId: string, photoIds: string[] = []): Spread {
  const empty: Spread = { id: "s1", projectId: "p1", index: 0, frames: [], texts: [] };
  const spread = applyTemplate(empty, getTemplate(templateId), square);
  spread.frames.forEach((f, i) => {
    if (photoIds[i]) f.photoId = photoIds[i];
  });
  return spread;
}

describe("template geometry", () => {
  for (const size of BOOK_SIZES) {
    for (const template of TEMPLATES) {
      it(`${template.id} stays in bounds on ${size.id}`, () => {
        const frames = template.frames(templateCtx(size));
        expect(frames.length).toBe(template.slots);
        for (const f of frames) {
          expect(f.x).toBeGreaterThanOrEqual(-0.001);
          expect(f.y).toBeGreaterThanOrEqual(-0.001);
          expect(f.x + f.width).toBeLessThanOrEqual(size.pageWidthMm * 2 + 0.001);
          expect(f.y + f.height).toBeLessThanOrEqual(size.pageHeightMm + 0.001);
          expect(f.width).toBeGreaterThan(10);
          expect(f.height).toBeGreaterThan(10);
        }
      });

      it(`${template.id} respects its gutter declaration on ${size.id}`, () => {
        const frames = template.frames(templateCtx(size));
        const gutterX = size.pageWidthMm;
        const crossing = frames.some((f) => f.x < gutterX - 0.001 && f.x + f.width > gutterX + 0.001);
        expect(crossing).toBe(!!template.crossesGutter);
      });
    }
  }

  it("every template cites at least one research finding", () => {
    for (const template of TEMPLATES) {
      expect(template.cites.length, template.id).toBeGreaterThan(0);
      for (const cite of template.cites) expect(cite).toMatch(/^R-(L|W|S|T|TH|O|P)\d/);
    }
  });
});

describe("applyTemplate", () => {
  it("pours existing photos into the new layout in reading order", () => {
    const spread = makeSpread("grid-2x2", ["a", "b", "c", "d"]);
    const next = applyTemplate(spread, getTemplate("two-up"), square);
    expect(next.frames.map((f) => f.photoId)).toEqual(["a", "b"]);
    expect(next.templateId).toBe("two-up");
  });

  it("resets crops and keeps user texts", () => {
    const spread = makeSpread("two-up", ["a"]);
    spread.frames[0].crop = { offsetX: 0.1, offsetY: 0.9, zoom: 2 };
    spread.texts = [
      { id: "t1", role: "caption", text: "Hi", x: 10, y: 10, width: 80, rotation: 0, z: 100, align: "left" },
    ];
    const next = applyTemplate(spread, getTemplate("full-bleed-spread"), square);
    expect(next.frames[0].crop).toEqual({ offsetX: 0.5, offsetY: 0.5, zoom: 1 });
    expect(next.texts).toHaveLength(1);
    expect(next.texts[0].text).toBe("Hi");
  });

  it("adds template placeholder texts only when the spread has none", () => {
    const spread = makeSpread("two-up");
    const next = applyTemplate(spread, getTemplate("text-left-photo-right"), square);
    expect(next.texts.map((t) => t.role)).toEqual(["heading", "body"]);
  });
});

describe("mergeFrames", () => {
  it("unions geometry and keeps the first photo in reading order", () => {
    const spread = makeSpread("grid-2x2", [undefined as unknown as string, "b", "c", "d"]);
    const ids = spread.frames.slice(0, 2).map((f) => f.id);
    const next = mergeFrames(spread, ids);
    expect(next.frames).toHaveLength(3);
    const merged = next.frames[next.frames.length - 1];
    const originals = spread.frames.slice(0, 2);
    expect(merged.x).toBeCloseTo(Math.min(...originals.map((f) => f.x)));
    expect(merged.width).toBeCloseTo(
      Math.max(...originals.map((f) => f.x + f.width)) - Math.min(...originals.map((f) => f.x)),
    );
    expect(merged.photoId).toBe("b");
    expect(next.templateId).toBeUndefined();
  });

  it("is a no-op for fewer than two frames", () => {
    const spread = makeSpread("two-up", ["a"]);
    expect(mergeFrames(spread, [spread.frames[0].id])).toBe(spread);
  });
});

describe("snapping", () => {
  it("snaps a near edge to the page margin and reports a guide", () => {
    const result = snapRect({ x: 16.2, y: 50, width: 60, height: 40 }, square, []);
    expect(result.x).toBe(15);
    expect(result.guides).toContainEqual({ axis: "x", at: 15 });
  });

  it("snaps to another frame's edge", () => {
    const other = { x: 100, y: 100, width: 50, height: 50 };
    const result = snapRect({ x: 151.5, y: 200, width: 30, height: 30 }, square, [other]);
    expect(result.x).toBe(150);
  });

  it("does not snap beyond the threshold", () => {
    const result = snapRect({ x: 25, y: 60, width: 60, height: 40 }, square, []);
    expect(result.x).toBe(25);
    expect(result.guides.filter((g) => g.axis === "x")).toHaveLength(0);
  });

  it("detects frames crossing the gutter", () => {
    const spread = makeSpread("panoramic-spread", ["a"]);
    expect(framesCrossingGutter(spread, square)).toHaveLength(1);
    const safe = makeSpread("two-up", ["a", "b"]);
    expect(framesCrossingGutter(safe, square)).toHaveLength(0);
  });
});
