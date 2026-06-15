# PhotoBook Studio — Design Research Digest

> **Living research hub:** NotebookLM notebook **"PhotoBook Studio — Design Research"**
> (`ea72b424-9570-46bb-ab69-294d108505c4`). This file is the implementation-ready digest of
> that notebook. When new reference material is found, add it to the notebook
> (`notebooklm source add <url> --notebook ea72b424-...`) and re-query — do not restart research
> from scratch. Raw query transcripts live in `.research/q1–q6`.
>
> **How to cite:** Every layout template, theme preset, and pacing rule built in this app MUST
> cite one or more Finding IDs below (e.g. `R-L3`, `R-TH2`) in code comments and in `CLAUDE.md`.

**Research date:** 2026-06-11
**Sources (15, all processed):** MILK Books (design principles), Artifact Uprising (layout ideas;
building guide), PhotoBook Press (wedding album narrative design), Queensberry (photographer's
guide to wedding albums), Blurb (layout tips; typography best practices), Mixbook (text in photo
books), Rosemood (layout ideas), Saal Digital (design modes), Alison Day Designs (mixing
orientations), Richard Photo Lab (album design tips), SLR Lounge (album design step-by-step),
Digital Photography School (layout tips), The School of Photography (creating a photography book).
*(One Medium article and one Imagen article were unreachable — paywall/403 — and were dropped;
coverage of their topics is provided by the sources above.)*

---

## 1. Grid systems & spread layouts (R-L)

Professional designers build on **invisible grids** (multi-column, vertical-rhythm) that divide
the page into even boxes for symmetry and hierarchy. These findings translate directly into our
layout-template catalogue.

| ID | Finding | Implementation implication |
|----|---------|---------------------------|
| **R-L1** | **Full-bleed 1-up (page or spread)** is reserved for *hero shots* — emotional peaks, sweeping venue/landscape images. The image runs off all edges. Critical content must stay inside the **safe zone** away from trim. | Template `full-bleed`; mark as "hero" slot for AI pacing; enforce safe-zone overlay in editor. |
| **R-L2** | **1-up with margins ("Power of One")** gives one image maximum emotional gravity — used for delicate details, portfolio work, and "breather" pages. Convention: **0.5–1 in (≈12–25 mm) of white space** around the image for a gallery feel. | Template `one-up-margin` with margin presets at 12 / 18 / 25 mm. |
| **R-L3** | **2-up** connects two related moments (action/reaction, vows + portrait). Beginner-safe default: *two photos per spread* reads elegant. Pair images with cohesive light/color temperature. | Template `two-up`; AI pairing should match color temperature (see R-TH8). |
| **R-L4** | **2x2 four-square grid** groups a cohesive set of smaller moments (series, angles, food). Needs **consistent gutters** between cells. | Template `grid-2x2` with uniform gutter token. |
| **R-L5** | **3x3 / high-density "film-strip" grids** suit kinetic energy (dance floor, candids) and large family series. Cap density by book size: in an 8×8 in book max **6–8 photos per spread**; up to 9–10 only in large formats. Requires a strict grid or it reads as amateur "yearbook". | Template `grid-3x3`; density cap rule keyed to book size. |
| **R-L6** | **Asymmetric collage** brings energy (parties, playful content): typically **3–7 images**, one large focal image balanced by a cluster of smaller ones placed diagonally to anchor and guide the eye. | Templates `asym-left-hero`, `asym-right-hero` (large focal + small cluster, diagonal balance). |
| **R-L7** | **Panoramic across the spread**: one wide image crossing the gutter — the gold standard for grand/cinematic shots. On layflat binding subjects may sit on the centerline; on standard binding **never place faces/bodies on the gutter**. A panorama can also be *simulated* with a row of separate photos aligned across the spread. | Template `panoramic-spread` + `pano-strip` (simulated). Gutter-safety check keyed to binding type. |

## 2. Margins, white space & borders (R-W)

| ID | Finding | Implementation implication |
|----|---------|---------------------------|
| **R-W1** | White space is a **deliberate design element** — a "silent frame" that isolates details and rests the eye; generous negative space = fine-art gallery aesthetic; crowding = amateur "yearbook" look. | Default templates err on generous margins; cram-warning in QA checks. |
| **R-W2** | Classic/gallery convention: **min 0.5–1 in white border** around images; consistent margins frame content and add structure. | Border presets: `white-wide` (gallery), `white-thin`. |
| **R-W3** | **No-border full bleed** = immersive, modern. Alternating bordered pages with full-bleed spreads creates visual rhythm. | Border preset `none`; pacing engine alternates (see R-S5). |
| **R-W4** | Sources don't document "thin keyline" as a named convention, but per-photo hairline borders exist in studio tooling; treat keyline as our third border option styled per theme. *(Extrapolation — weakest-grounded finding.)* | Border preset `keyline` (≈0.25–0.5 pt hairline, theme-colored). |
| **R-W5** | **Binding gutter rules:** standard binding swallows the spread center — never place faces/major body parts on the gutter; layflat removes the constraint and permits true panoramic subjects. | Project setting `binding: standard \| layflat`; editor warning zone at spread center. |
| **R-W6** | **Safe zone / trim zone:** all essential elements (text, eyes, faces) must remain inside page margins or risk being trimmed in print. | Export adds bleed; editor renders trim + safe-zone guides. |

## 3. Sequencing & pacing (R-S)

| ID | Finding | Implementation implication |
|----|---------|---------------------------|
| **R-S1** | Open with a **"scene setter"** spread: wide venue/landscape or styled detail shot that establishes context and mood ("once upon a time"). | AI design: first spread = scene-setter template (full-bleed or 1-up). |
| **R-S2** | Structure as a **narrative arc** — chronological for events, or thematic (location/emotion/palette); a **three-act structure** (anticipation → core → celebration) with optional chapter-intro pages. | AI design: chapterize photo timeline; optional chapter title pages (ties into Phase 5 text). |
| **R-S3** | **One story per spread** — don't compress a timeline into two pages; each spread covers one scene/moment. | AI clustering: group photos by time/scene, one cluster per spread. |
| **R-S4** | **Hero shots are anchor images**: largest element on the spread (full page or double-page). **Detail shots** are connective tissue — keep chronological, group into "detail clusters" on a single spread so small images don't get lost. | Slot roles `hero` / `detail`; detail-cluster template = grid-2x2 / 3x3. |
| **R-S5** | **Visual rhythm:** alternate full-page spreads with multi-photo layouts; balance high-density "energy" spreads with quiet **breather pages** (single portrait/detail). Identical consecutive layouts lose the reader. | Pacing engine penalizes repeating the same template on consecutive spreads; inserts breathers after dense spreads. |
| **R-S6** | **Black & white reset spread**: insert a B/W spread to pause a visually chaotic color sequence. | Optional AI move; B/W filter applied non-destructively. |
| **R-S7** | **Closing image** = resolution: dramatic full-bleed exit shot or quiet reflective favorite. | AI design: last spread gets `hero`-class image, full-bleed or 1-up-margin. |
| **R-S8** | Curation: **"kill your darlings"** — ~100 great photos beat 400 mediocre. Standard 36-page album: **80–120 images**; 100-page book: ≤300. | AI selection targets ≈2–3 photos/page average; duplicate/similar-shot culling. |

## 4. Typography & captions (R-T)

| ID | Finding | Implementation implication |
|----|---------|---------------------------|
| **R-T1** | **Max two fonts** per book (one is fine; never more than 2–3). One for headings, one for body/captions. | Each theme ships exactly one heading + one body font. |
| **R-T2** | **Pair serif with sans-serif** (contrast rule), or stylized display + neutral text face. | Theme font pairings follow serif/sans contrast (see §5). |
| **R-T3** | Strict role hierarchy: **2–3 font sizes total**; bold headings, normal-weight body/captions. | Text presets: `heading` / `body` / `caption` only. |
| **R-T4** | Size guidance: **headings 18–24 pt, body/captions 10–14 pt**, scaled to physical book size; preview at print size. | Size tokens scale with book dimensions. |
| **R-T5** | Caption placement: in **negative space**, never over busy image areas (or use semi-transparent backdrop); ample spacing from the photo. | Caption snap-positions outside frames; optional scrim. |
| **R-T6** | **Left-to-right rule:** text on the left page, images on the right reads naturally; long passages get a dedicated text page facing a related image. | Templates `text-left-photo-right`, `dedicated-text-page`. |
| **R-T7** | Mood matching: script/classic serif (Baskerville, Garamond) = formal/wedding; rounded sans (Futura) = playful/family; single crisp sans = modern/minimal. | Drives theme font choices in §5. |

## 5. Theme presets — color, backgrounds, styling (R-TH)

General rules: **one main color + 1–2 accents** max (R-TH8a); pull background/accent colors
**from the photos themselves** (R-TH8b); group photos by **color temperature/light quality**
per spread (R-TH8c); B/W reset available (R-S6).

| ID | Theme | Research-derived styling |
|----|-------|--------------------------|
| **R-TH1** | **Classic / Timeless** | Black or white backgrounds (foolproof, never clash); formal symmetry; structured grids; consistent white borders (R-W2). Fonts: classic serif headings (Garamond/Baskerville class) + restrained body (R-T7). Tendency: 1-up-margin, 2-up, symmetric grids. |
| **R-TH2** | **Minimal** | Almost exclusively white backgrounds; zero motifs/accent colors; single image per page with generous negative space (R-W1, R-L2). Fonts: a single crisp sans-serif across the book (R-T7). Tendency: one-up-margin dominant, occasional full-bleed. |
| **R-TH3** | **Modern** | Neutral backgrounds with high-contrast pairings (dark text on light); frequent immersive **full-bleed spreads** (R-L1, R-W3); linen-cover sensibility. Fonts: contemporary sans pairing. Tendency: full-bleed + asymmetric layouts. |
| **R-TH4** | **Warm** | Curate "light and airy" warm-temperature photos per spread (R-TH8c); soft, organic feel (linen warmth); cream/warm-neutral backgrounds. Fonts: humanist serif/sans mix. Tendency: 2-up and detail clusters with soft margins. |
| **R-TH5** | **Editorial** | Magazine/lookbook conventions: strict invisible grid balancing text and photos; clear hierarchy — one dominant hero + cluster of smaller supporting shots with descriptive captions; color used strategically, page/text coordinated to event tones; integrates long-form text (R-T6). Tendency: asym-hero, text-left-photo-right. |
| **R-TH6** | **Playful** | Brighter colorful backgrounds; symmetry abandoned — mixed formats "in all directions", energetic collage (R-L6); rounded friendly fonts (Futura class, R-T7). Tendency: asymmetric collage, 3x3 candid grids. |

## 6. Mixing portrait & landscape orientations (R-O)

| ID | Finding | Implementation implication |
|----|---------|---------------------------|
| **R-O1** | Vary orientation intentionally to avoid monotony; vertical images in a landscape book work best **paired together on one side** of a spread or as smaller accents beside a dominant horizontal. | Mixed-orientation template variants; AI assigns by aspect ratio. |
| **R-O2** | **Height-disparity fix:** use the empty space above the shorter landscape image for text/title so its visual height matches the adjacent portrait. | Template `portrait+landscape+caption` slot arrangement. |
| **R-O3** | **Grounding anchors:** a continuous background strip/colored band behind mixed photos lets alignment "cheat" without looking messy. | Optional background-band element in collage templates. |
| **R-O4** | **Square crops** create rhythm in series (dance floor) and rescue low-res phone/social photos at small sizes. | `square-strip` template; AI sizes low-res images small. |
| **R-O5** | **Reading flow:** tallest element far-left as the visual entry point (Western L→R); "bookend" elements at opposite corners guide the eye diagonally; rows of portraits can simulate a panorama across the spread. | Template geometry: tall slot left; pano-strip (R-L7). |
| **R-O6** | **Book shape matters:** landscape albums suit horizontal-heavy shoots; **square books are the most versatile for mixed orientations** (no awkward cropping). | Book-size picker hints; default 21×21 cm square. |

## 7. Print & export constraints (R-P)

| ID | Finding | Implementation implication |
|----|---------|---------------------------|
| **R-P1** | Full-bleed images must **extend past trim** to account for cutting/binding; bleed is added at export. | PDF export: configurable bleed (e.g. 3 mm) with images over-extended. |
| **R-P2** | Safe zone: keep essential elements ≥ safe margin from trim and ≥ 0.5 in from binding gutter. | Editor guides + export-time validation warnings. |
| **R-P3** | Design **in spreads (two-page units)**, not single pages. | Data model & navigator are spread-based. |

---

## Template catalogue → research mapping (to build in Phase 2)

| Template | Cites |
|----------|-------|
| `full-bleed` (page & spread) | R-L1, R-W3, R-P1 |
| `one-up-margin` | R-L2, R-W1, R-W2 |
| `two-up` | R-L3 |
| `grid-2x2` (detail cluster) | R-L4, R-S4 |
| `grid-3x3` (energy/candids) | R-L5, R-S5 |
| `asym-left-hero` / `asym-right-hero` | R-L6, R-O5, R-TH5 |
| `panoramic-spread` / `pano-strip` | R-L7, R-O5, R-W5 |
| `portrait+landscape+caption` | R-O1, R-O2 |
| `square-strip` | R-O4 |
| `text-left-photo-right` / `dedicated-text-page` | R-T6 |

## Open questions for later phases
- Exact hairline keyline weight per theme (R-W4 is the only extrapolated finding — revisit if a
  stronger source is found; add it to the notebook when found).
- Per-occasion pacing differences (Baby vs Corporate) — re-query the notebook before Phase 4
  with occasion-specific questions.
