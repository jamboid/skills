# Assets / Page-resources component — case-study bundle

Self-contained record of designing a new **Page resources** component for the
performance-audit report: top-line metrics per asset category with expandable
full asset lists, placed immediately under the metrics component. Mirrors the
earlier `metrics-redesign-case-study/` workflow.

## Contents

- **`conversation.md`** — the design dialogue, round by round (brief → built →
  decision), the basis for a written case study.
- **`prototypes/`** — three standalone HTML prototypes. Open any in a browser;
  each renders from the real wattage.staging.gd asset data (desktop + mobile,
  `chrome-extension://` noise stripped) and is fully interactive.
  - `v1-comparison-accordion.html` — category rows with a weight-share bar and
    Desktop·Mobile columns; click a category to expand its asset list. Includes a
    Both/Desktop/Mobile scope control to preview the single-device fallback.
  - `v2-proportion-drilldown.html` — a stacked share-of-weight bar per device
    (foregrounds "images ≈ 88%"); click a segment or row to drill into assets.
  - `v3-heaviest-first.html` — every individual asset ranked by weight with dual
    Desktop/Mobile bars; category strip on top for the at-a-glance totals.

## Decisions locked before prototyping

- **Placement:** standalone component immediately after the metrics component.
- **Device view:** side-by-side Desktop·Mobile comparison, single-column fallback.
- **Old table:** replaces the Performance ▸ Assets type-table (consolidation).

## Outcome

_Pending selection._ The chosen direction ships into
`performance-audit/assets/report-template.html` and
`performance-audit/scripts/build_report.py` (new top-level `resources` schema).
See `conversation.md` → final round once decided.
