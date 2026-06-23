# Case study — a Page-resources / assets component

How the performance-audit report grew a first-class assets component: from a
flat type-totals table to top-line categories with expandable, device-comparing
asset lists.

## Round 0 — Starting point

The report summarised page weight as a small type-level table under
**Performance**: Images / Script / Font … with request counts and totals. During
a live audit of `wattage.staging.gd` we proved the raw exports carry full
per-asset detail (Lighthouse `network-requests`, WPT `requests[]`), and that the
insight lives in the **desktop-vs-mobile per-asset** view — the LCP hero ships
the 314 KB desktop derivative to phones while its siblings right-size to
43–87 KB. A type-totals table can't show that. We also learned the hard way that
Lighthouse's `unused-javascript` (820 KB) is all `chrome-extension://` noise from
the auditor's own browser — the extractor must strip it.

**Brief:** a standalone component under the metrics block; per-category top-line
metrics; expandable full asset lists; Desktop·Mobile side by side; it replaces
the old type-table.

## Round 1 — Three directions

Three standalone prototypes, all rendering the real wattage data and all handling
the single-device fallback so the design stays generic.

- **v1 — comparison accordion.** Closest to the original brief. A table-shaped
  component: each category is a row (icon · name · request count · share bar ·
  Desktop size · Mobile size) and a `<details>` that expands to its asset list.
  Native `<details>` means no-JS-safe, printable, accessible. The hero asset is
  flagged "mobile = desktop". A scope control demos the 1-device fallback.
  - _Strength:_ scannable, familiar, prints well, maps 1:1 to the schema.
  - _Risk:_ a lot of rows once expanded; the "page shape" is implicit.

- **v2 — proportion + drill-down.** Leads with a stacked share-of-weight bar per
  device. Images visibly own ~88% of the page; the desktop and mobile bars sit
  one above the other so the savings gap is the headline. Click a segment or row
  to drill into that category's assets.
  - _Strength:_ communicates composition instantly; great for "where's the
    weight?" conversations with non-specialists.
  - _Risk:_ tiny categories (Script 2 KB) are invisible slivers; two stacked bars
    + a list is more visual machinery than a quick reference needs.

- **v3 — heaviest-first.** Inverts the hierarchy: flatten every asset and rank by
  weight, dual Desktop/Mobile bars per asset, category shown as a colour tag. The
  314 KB hero lands at #1 with a "no mobile saving" call-out. A category strip on
  top keeps the totals.
  - _Strength:_ puts the actual problem asset first; the per-asset save column is
    a ready-made action list.
  - _Risk:_ loses the clean category grouping; less of a "resource budget" view,
    more of a "worst offenders" view.

**Decision:** v1 as the backbone, refined into `prototypes/v4-refined.html`.

## Round 2 — Refining v1 into v4

Iterated on v1 against live feedback:

- Dropped the per-row analysis notes and the copy buttons — too much noise; full
  filenames are selectable as-is.
- Filenames made complete (no abbreviations) and as prominent as the sizes; the
  SVG tail is no longer collapsed so every name is real.
- Removed the Both/Desktop/Mobile scope tabs, then **re-added them in the column
  header** once the stacked layout made a toggle feel natural — doubles as the
  single-device fallback.
- Switched from one overlaid bar to **two separate D/M bars** (from v3), with the
  **sizes stacked to align** with each bar.
- Category icons now sit on a **light tint** of the v2 category colour with a
  dark icon on top.
- Tried hollow/outlined item bars and an overlaid desktop+mobile bar — both
  rejected as noisy/confusing; settled on **solid** bars.
- Category and item bars use different scales (heaviest category vs heaviest
  item), so to stop readers comparing the two, **the category bars fade when the
  section is open**, handing focus to the item bars.

## Round 2.5 — Item-bar scaling (decided: per-category)

Item bars were scaled to the single largest file across the whole list (one
ruler), which makes a category of small files (Script, 2–4 KB) render as near-
invisible slivers. Switched to **per-category** scaling (each category's items
measured against that category's heaviest file) so small categories read clearly
— trade-off: bar lengths are no longer comparable across categories, only the
size numbers are. Held open for a session while the user mulled global vs
per-category; **locked in as per-category** (global rejected). Category and item
bars stay on different rulers, hence the open-category bar fade.

## Round 2.6 — Hiding negligible files

This is a performance tool, not an asset inventory, so the long tail of tiny
files (16 image requests, but 11 of them are 1–6 KB icon SVGs) shouldn't clutter
the list by default.

- **Folding rule:** a file whose larger device size is under **10 KB**
  (`SMALL_KB`) is folded into a per-category **summary row**, but only when **≥2**
  files (`MIN_FOLD`) would collapse — a lone small file just shows, so we never
  get a silly "1 file" summary (Stylesheet's 1 KB file stays visible; only Images
  folds).
- **Summary row:** `+N files under 10 KB` plus the combined sizes, styled for
  parity with file rows. Iterated the background: full category tint across the
  whole row was overpowering → dialled back to a **38% tint wash** (same hue,
  much fainter) with a **1px top border in the full-strength tint**.
- **Reveal control:** first tried a single **global "Show all files"** header
  toggle — rejected, because with every category collapsed it changed nothing
  visible. Replaced with a **per-category All / Fewer** segmented toggle that
  reuses the device-toggle styling, sits next to the category title, and appears
  **only while that category is open**. Briefly used a +/- icon button with a
  blue active state; settled on the segmented control to match the device toggle.
  State is per-category and independent of the chevron open/close.

## Round 3 — Wiring in (not started)

See `HANDOFF.md` for the full spec and the Phase B checklist: ship v4 into
`report-template.html` + `build_report.py` under a new top-level `resources`
schema, remove the Performance ▸ Assets table, document per-asset extraction in
`reading-audit-data.md`, and regenerate the wattage report.

## Method notes

- Every prototype renders from one shared `DATA` object holding the real numbers,
  so the three are visually comparable, not apples-to-oranges.
- Transfer (compressed) bytes throughout; `chrome-extension://` requests excluded;
  files under 10 KB fold into a per-category summary row by default (expandable via
  the All/Fewer toggle) so the list stays performance-focused, not an inventory.
