# Metrics section redesign — case-study bundle

Self-contained record of redesigning the performance-audit report's Metrics
section, from flat number-cards to a tabbed, load-timeline rail component. Copy
this folder anywhere — it has no external dependencies.

## Contents

- **`conversation.md`** — the design dialogue, round by round (brief → built →
  decision), the basis for a written case study.
- **`prototypes/`** — the four standalone HTML prototypes. Open any in a browser;
  each renders from the real audit data and is fully interactive.
  - `v1-three-directions.html` — rails vs CWV hero vs comparison matrix
  - `v2-narrative-options.html` — tabbed rails + three load-story narratives
  - `v3-timeline-spine.html` — phase rails on a vertical timeline spine
  - `v4-device-audit-tabs.html` — final: device × audit tabs, score badge,
    resource cards, report links
- **`images/`** — key screenshots referenced by `conversation.md`.

## Outcome

The `v4` direction shipped into `performance-audit/assets/report-template.html`
and `performance-audit/scripts/build_report.py` (new `metrics.groups[]` schema).
See `conversation.md` → "Round 6 — Wiring in".
