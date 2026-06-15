# PhotoBook Studio — Build Plan

A local-first web app for arranging client photos into professional photobook layouts, with
AI-assisted design. All layout templates and themes derive from
[docs/design-research.md](docs/design-research.md) (NotebookLM notebook
`ea72b424-9570-46bb-ab69-294d108505c4` is the living research hub).

## Status

- [x] **Step 0 — Design research** (notebook created, 15 sources, 6 synthesis queries, digest written)
- [ ] **Approval gate: project structure + this plan** ← *you are here*
- [ ] Phase 1 — Upload & project shell
- [ ] Phase 2 — Layout designer
- [ ] Phase 3 — Themes
- [ ] Phase 4 — "AI Design Everything"
- [ ] Phase 5 — Text & captions
- [ ] Phase 6 — Output library

Each phase ends with: `npm run dev` smoke run → QA Agent review against the brief → hand-over
to you for testing → your approval before the next phase starts.

## Tech stack (proposed)

| Concern | Choice | Why |
|---------|--------|-----|
| App | **React 18 + Vite + TypeScript** | As briefed; TS added because the layout/document model benefits hugely from types. |
| Styling | **Tailwind CSS v4** | As briefed. |
| Canvas editor | **Konva.js (react-konva)** | Chosen over Fabric.js: first-class React bindings, better TS support, cleaner layering/snap-guide implementation. |
| Storage | **IndexedDB via Dexie.js** | Local-first; photos never leave the machine. Originals + generated thumbnails stored as Blobs. |
| Image pipeline | **createImageBitmap + OffscreenCanvas** (Web Worker) | Client-side thumbnail (≈400px) and preview (≈2000px) generation so 300 large JPEGs stay smooth; originals kept untouched for export. |
| PDF export | **pdf-lib** | Embeds full-resolution JPEGs directly (no re-encode), supports custom page sizes + bleed boxes (R-P1). Per-spread PNG via canvas render at print DPI. |
| AI | **Anthropic API** (`claude-fable-5` text, vision for photo analysis) | Key from `.env` (`VITE_ANTHROPIC_API_KEY`), never hardcoded. **What is sent:** downscaled previews (≈1024px JPEG) of your photos for analysis in Phase 4, and text-only theme/occasion metadata for captions in Phase 5. Nothing else; nothing is stored server-side by the app. |

## Project structure (proposed)

```
photobook-studio/
├── PLAN.md                  # this file
├── CLAUDE.md                # architecture decisions, agent roles, template→research map
├── docs/
│   └── design-research.md   # Step 0 digest (cites NotebookLM notebook)
├── .env                     # VITE_ANTHROPIC_API_KEY (gitignored)
├── src/
│   ├── app/                 # shell, routing (Library / Editor views), global state (zustand)
│   ├── db/                  # Dexie schema: projects, photos, spreads, library entries
│   ├── images/              # worker: import, EXIF, thumbnail/preview generation
│   ├── model/               # document model: Book, Spread, Frame, TextBlock, Theme (pure TS)
│   ├── layout/              # Layout Engine Agent: template catalogue (research-cited),
│   │                        #   frame math, snapping, gutter/safe-zone rules
│   ├── themes/              # Theme presets (research-cited tokens: colors, fonts, borders)
│   ├── editor/              # Frontend/UX Agent: Konva canvas, tray, navigator, toolbars
│   ├── ai/                  # AI Design Agent + Copywriting Agent: analysis, pacing,
│   │                        #   auto-placement, captions (Anthropic client)
│   ├── export/              # pdf-lib book export, per-spread PNG render
│   └── library/             # Output library views
└── tests/                   # vitest: layout math, pacing engine, model invariants
```

**Core data model decision:** the document is a pure-TS, JSON-serializable `Book` object
(spread-based, per R-P3). Konva only *renders* it. Themes are token sets applied at render
time, so switching themes never mutates frame geometry → non-destructive restyling (Phase 3).
AI output is just a generated `Book` document → always editable (Phase 4).

## Agent team

| Agent | Owns |
|-------|------|
| **Research Agent** | NotebookLM notebook, docs/design-research.md upkeep, re-queries before each phase |
| **Frontend/UX Agent** | `src/app`, `src/editor`, `src/library` — polished, modern UI |
| **Layout Engine Agent** | `src/layout`, `src/model` — templates from research, snapping, borders |
| **AI Design Agent** | `src/ai` analysis/selection/pacing/auto-placement |
| **Copywriting Agent** | `src/ai` captions/titles, text-block presets |
| **QA Agent** | Post-phase review vs. brief; gap list before your testing |

## Phase scope summary

1. **Upload & shell** — project create/name, book size (21×21 cm, A4 landscape, A4 portrait, 30×30 cm), drag-drop import of 50–300 photos, worker thumbnailing, photo tray with used/unused state, Dexie persistence.
2. **Layout designer** — spread navigator (add/delete/reorder), the 10 research-cited templates, border presets (`none`/`white`/`keyline`), tray→frame drag, in-frame pan/zoom crop, frame swap, free mode (drag/resize/rotate/layer + snap guides), merge/overlap collage tools, trim/safe-zone/gutter guides.
3. **Themes** — 6 presets (Modern, Minimal, Warm, Classic, Editorial, Playful) as token sets per R-TH1–6; non-destructive switching.
4. **AI design** — occasion/page-count/theme dialog → vision analysis (downscaled previews) → dedupe/select (R-S8) → chapterize + pace (R-S1–7) → template assignment → editable draft.
5. **Text & captions** — heading/body/caption presets per theme (R-T1–7), AI wording with 3 options + regenerate.
6. **Output library** — print-ready PDF (bleed option, R-P1), per-spread PNGs, library view (cover, name, date, theme, page count), reopen + duplicate-as-version.
