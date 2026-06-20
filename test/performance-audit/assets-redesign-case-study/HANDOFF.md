# Handoff — Page-resources / assets component

Resume point for building a first-class **assets component** into the
`performance-audit` skill. Phase A (prototyping) is done and a direction is
chosen + refined. Phase B (wiring into the skill) has **not** started.

## Where things stand

- **Goal:** replace the report's flat type-totals table (Performance ▸ Assets)
  with a richer **Page resources** component: per-category top-line metrics with
  expandable full asset lists, desktop-vs-mobile comparison, placed immediately
  under the metrics component.
- **Workflow:** mirrors `../metrics-redesign-case-study/` — prototype options →
  pick → ship into `report-template.html` + `build_report.py`.
- **Chosen direction:** `prototypes/v4-refined.html` (the live spec — open it).
  v1–v3 are the round-1 alternatives; keep for the record.
- **Approved plan file:** `~/.claude/plans/okay-this-is-a-agile-orbit.md`
  (Phase B section is still accurate except where this doc refines it).
- Nothing committed; all files are new/modified in the working tree.

## Decisions locked (with the user)

1. **Placement:** standalone component immediately *after* the metrics
   component, with its own device control. Not embedded in the metric tabs.
2. **Device view:** side-by-side Desktop/Mobile, with a **Both / Desktop /
   Mobile** toggle. Degrades to one column when only one device was tested.
3. **Old table:** the new component **replaces** Performance ▸ Assets.

## v4 design spec (what to reproduce in the real template/script)

Single table, columns: **Category/file · Req · bars · Size**.

- **Header row:** the bars column header holds the **Both / Desktop / Mobile**
  segmented toggle (replaces a static "Desktop · Mobile" label). "Size" header is
  right-aligned.
- **Category row** (`<details><summary>`, **closed by default**): chevron · icon
  chip · category name (bold) · request count · bars · stacked sizes.
  - Icon chip = 32px rounded square, background = the category's **light tint**,
    icon stroke = dark ink (`--icon-ink:#2c2b29`).
- **Item rows** (revealed on expand): left-indented **full monospace filename**
  (13px, weight 600 — as prominent as the sizes) · bars · stacked sizes. No copy
  button, no analysis notes (both tried and removed).
- **Bars** = two separate stacked bars per row: **D** (solid category base
  colour) and **M** (same colour at `opacity:.42`). The `D`/`M` key labels show
  only in "Both" mode. Sizes are stacked to align with the bars (D line bold, M
  line muted).
  - **Scale:** category bars scale to the heaviest *category* (desktop kb). Item
    bars currently scale **per category** (to that category's heaviest file), so
    small categories (Script, Stylesheet) still show readable bars — at the cost
    of cross-category comparability. **This is an open decision** the user is
    mulling: global item scale (one ruler across all files; small categories show
    slivers) vs per-category (current). Whichever ships, category and item bars
    are on different rulers — which is why the open-category bar fade exists.
- **Open-state cue:** when a category is open, fade **just its category bars** to
  `opacity:.3` (`details[open] > .cat-sum .bars`), so the item bars lead. Pure
  CSS off the `<details open>` state.
- **Footer:** Total row (requests + size).
- Colour palette (base + tint) per category, from the prototype `:root`:
  Images `#3a5cff`/`#dfe5ff`, Font `#7c3aed`/`#ece4fd`, Document
  `#0891b2`/`#d8eef3`, Stylesheet `#db2777`/`#fbe1ee`, Script `#ea580c`/`#fde3d4`,
  Other `#64748b`/`#e7eaef`.

### Rejected ideas (don't re-litigate)
- Overlaid dual-layer bar (light desktop + solid mobile over it): too confusing.
- Hollow/outlined item bars (border + tinted centre): too noisy vs solid.
- Copy-to-clipboard buttons per filename: noise > value, full names are
  selectable.
- Collapsing the SVG icons into one row: dropped so every filename is real/full.

## Open decisions (resolve before/while wiring)

- **Item-bar scaling:** per-category (current) vs global. User is mulling. See the
  bars "Scale" note above.

## Phase B — wiring in (next session)

### Schema — new top-level `resources` in `audit.json` (REFERENCE.md)
Store **raw bytes** per device; let the script format + compute bar widths:
```jsonc
"resources": {
  "devices": ["Desktop", "Mobile"],          // 1 or 2 column headers
  "total":   { "requests": [22, 22], "bytes": [1165647, 744253] },
  "categories": [
    { "type": "Images", "requests": [16, 16], "bytes": [1031388, 588579],
      "assets": [
        { "name": "wattage_sample_banner4.png.webp", "bytes": [321779, 321779] }
      ] }
  ]
}
```
Remove the `performance.assets.items` block added earlier; note the breakdown
**moved** to `resources`.

### `scripts/build_report.py`
- Add `build_resources_html(data)` + a Markdown equivalent; insert **after** the
  metrics section; add `nav_link("resources", "Page resources")`.
- Render **both** D and M rows always; the toggle shows/hides via a `data-scope`
  attribute on the component + CSS (`.res[data-scope="0"] .brow.m {display:none}`
  etc.) — keep it static-HTML friendly, like the existing metrics tabs. Add the
  small toggle JS to the template's `<script>` (mirror the `.metrics-component`
  tab IIFE).
- Bar widths computed in Python from the bytes + the two scales above.
- **Remove** `build_assets_html` + the `performance.assets` Markdown block; the
  Performance section keeps only Tests + Findings.
- Reuse: `humanize_bytes`, `inline_html`, `attr`, `section`, `nav_link`.

### `assets/report-template.html`
- Port the v4 CSS (category rows, icon chips, stacked bars, sizes, `<details>`
  accordion, open-state bar fade, toggle, responsive collapse). Reuse existing
  tokens; the report already has `--c-*`, `.subhead`, etc.
- Print rule: force `<details>` open and show both D/M so the full list prints.

### Docs
- `reading-audit-data.md` — new subsection on extracting the per-asset list (the
  draft step, done by the model):
  - Source: Lighthouse `network-requests.details.items[]` (`url`,
    `resourceType`, `transferSize`); WPT `requests[]` (`req_type`, `b_in`) as
    fallback; prefer Lighthouse when both exist.
  - **Drop `chrome-extension://` requests** — auditor's own extensions (the
    820 KB "unused JS" trap hit twice this project).
  - **Match assets across devices by filename** to build the comparison: the
    responsive variants have different URLs per device (`width_scale_xl` on
    desktop, `width_scale_m` on mobile) but the same basename — pair them.
  - Group by category (Images/Font/Document/Stylesheet/Script/Media/Other).
- `SKILL.md` — mention the resources component; note assets moved out of
  Performance.

### Regenerate the worked example
- Migrate `../regenerated/audit.json` to the `resources` schema (drop
  `performance.assets`), rebuild, confirm the component renders under metrics,
  toggle works, old table gone.

## Data notes (wattage worked example)
- Desktop total 22 req / **1.11 MB**; Mobile 22 req / **727 KB**.
- Images dominate (~1 MB desktop). The **LCP hero `wattage_sample_banner4`
  ships the 314 KB desktop derivative to mobile too** (no responsive size,
  because it's a CSS background) — banner2/3 correctly drop to 87/43 KB. This is
  the story the comparison bars are designed to expose.
- Quirk: `sander-…-unsplash` reads 26 KB desktop / **36 KB mobile** because the
  mobile run fetched two variants. Accurate, just counterintuitive.
- Two distinct `wattage_dots.svg` (theme + sites) share a basename; filename
  matching sums them (~5 KB) — acceptable.

## Verify (after Phase B)
```
python3 performance-audit/scripts/build_report.py \
  test/performance-audit/regenerated/audit.json \
  --out-dir test/performance-audit/regenerated
```
Then open `regenerated/html/wattage-staging.html`: resources component sits under
metrics, toggle flips Both/Desktop/Mobile, categories expand to full asset lists,
open category's bars fade, sidebar has "Page resources", old Performance ▸ Assets
table is gone. Check the Markdown twin and print preview (details open).
