# PhotoBook Studio

Local-first web app for arranging client photos into professional photobook layouts, with
AI-assisted design. Built phase-by-phase per [PLAN.md](PLAN.md); design decisions derive from
[docs/design-research.md](docs/design-research.md).

## Commands

- `npm run dev` — start the app (Vite)
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm test` — vitest

## Architecture decisions

1. **Pure-JSON document model** (`src/model/types.ts`): `Project` → `Spread[]` → `Frame[]`/`TextBlock[]`.
   Geometry in **millimeters, spread coordinates** (origin top-left of left page). The canvas
   renders the model; it never owns state. This is what makes theme switching non-destructive
   (Phase 3) and AI drafts fully editable (Phase 4).
2. **Spread-based design unit** (not single pages) — research finding R-P3.
3. **Local-first storage**: Dexie/IndexedDB (`src/db/db.ts`). Blobs (original/preview/thumb) in a
   separate `photoBlobs` table so photo listings never load image data. Originals are untouched
   `File` blobs, used only for print-resolution export.
4. **Three image sizes** per photo: original (export), ~1600px preview (canvas), ~320px thumb
   (tray). Generated in a Web Worker pool (`src/images/`) with EXIF orientation baked in;
   EXIF capture time read at import (drives AI sequencing, R-S2).
5. **Konva.js** for the Phase 2 canvas editor (chosen over Fabric: React bindings, TS).
6. **AI privacy boundary** (Phases 4–5): only ~1024px downscaled previews + text metadata go to
   the Anthropic API. Key in `.env` as `VITE_ANTHROPIC_API_KEY`, never hardcoded.
7. **UI chrome is near-black neutral** (tokens in `src/index.css`) so client photos read true;
   the book canvas itself always renders on paper white.

## Conventions

- Every layout template and theme preset **must cite research finding IDs** (R-L1, R-TH2, …)
  from docs/design-research.md in a comment at its definition site. The mapping tables at the
  bottom of that file are the source of truth.
- Strict text hierarchy: only `heading` / `body` / `caption` roles (R-T3). Max two fonts per
  theme (R-T1).
- mm everywhere in the model; px only at the render/export edge.

## Agent roles

| Agent | Owns |
|-------|------|
| Research | NotebookLM notebook `ea72b424-…` + docs/design-research.md upkeep; re-query before each phase |
| Frontend/UX | `src/app`, `src/editor`, `src/library` |
| Layout Engine | `src/model`, `src/layout` (templates, snapping, borders, gutter/safe zones) |
| AI Design | `src/ai` (analysis, selection, pacing, auto-placement) |
| Copywriting | `src/ai` captions/titles + text presets |
| QA | Post-phase review against the project brief |

## Theme/template → research map

See the two mapping tables at the end of [docs/design-research.md](docs/design-research.md):
"Template catalogue → research mapping" and the R-TH table in §5. `src/layout/templates.ts`
and `src/themes/` implement them 1:1 (from Phase 2/3 onward).
