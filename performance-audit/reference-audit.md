# wattage.staging.gd — Site Audit

The tonal exemplar for `performance-audit`, produced by a real `draft` run from a
Lighthouse 13 + WebPageTest export pair. Match this register when writing prose
into `audit.json` (summary, finding bodies, conclusions); do not mimic content.
Note how it stays plain, leads with numbers, names cause over symptom, and —
crucially — refuses to over-claim when the two tools disagree.

**URL:** https://wattage.staging.gd/ · **Date:** 2026-06-18 · **Scope:** site audit, performance-focused · **Audience:** internal SD/AD

## Executive summary

`wattage.staging.gd` is **fast on the core timings** — Lighthouse scores it 77, with LCP under 1 s and near-zero blocking time. The two open issues are **layout stability** and **image weight**.

Lighthouse flags a poor CLS of 0.59, but WebPageTest measures it at 0.02 — the tools disagree, so the shift is likely intermittent and needs reproducing before it's treated as critical. Images make up roughly 1 MB of the 1.14 MB page.

## Metrics

### Desktop — performance score 77 (Lighthouse 13.2.0, lab)

| Metric | Value | Rating |
|---|---|---|
| LCP | 0.8 s | Good |
| CLS | 0.59 | Poor |
| INP | lab N/A | N/A |
| TBT | 0 ms | Good |
| Speed Index | 0.5 s | Good |
| Page weight | 1.1 MB | — |
| Requests | 22 | — |

### WebPageTest (Chrome, median of 3 runs)

| Metric | Value | Rating |
|---|---|---|
| LCP | 0.6 s | Good |
| CLS | 0.01 | Good |
| Speed Index | 0.6 s | Good |
| TBT | 0 ms | Good |
| FCP | 0.6 s | Good |
| Page weight | 700 KB | — |
| Requests | 22 | — |

## Performance

### Findings (candidates — data-derived, awaiting ratification)

**Layout shift culprits.** Lighthouse measures CLS at **0.59** — well into the poor band. The WebPageTest run disagrees sharply (0.02), so the shift is likely intermittent or interaction-triggered; reproduce before committing effort. Probable cause: images/embeds loading without reserved space.

**LCP request discovery.** The LCP image isn't discoverable early in the document. Preload the hero image and ensure it isn't lazy-loaded.

**Improve image delivery.** Images are the bulk of page weight (~1 MB of 1.14 MB). Serve responsive sizes and next-gen formats (WebP/AVIF).

**Image elements without explicit `width`/`height`.** Images lack intrinsic dimensions, forcing reflow and feeding the CLS measurement above. Add them.

**Render-blocking requests.** Stylesheets/scripts in the head delay first paint. Inline critical CSS and defer the rest.

### Assets

| Type | Requests | Size |
|---|---:|---:|
| Image | 17 | 1007 KB |
| Font | 1 | 76 KB |
| Document | 1 | 39 KB |
| CSS | 2 | 8 KB |
| Script | 1 | 2 KB |
| **Total** | 22 | 1.1 MB |

## Conclusions

This is a healthy staging build, not a problem site — load timings are strong and the request count is low (22). Two things to chase: confirm whether the CLS Lighthouse reports (0.59) is real, since WebPageTest's 0.02 suggests an intermittent or interaction-driven shift rather than a constant one; and tackle image delivery, the only material weight on the page. Everything here is an unratified **candidate** — supplying `notes.md`/`analysis.md` and re-running folds in judgment and architecture context.

### Priority actions

1. Reproduce the CLS discrepancy (Lighthouse 0.59 vs WPT 0.02); if real, add image/embed dimensions to fix it.
2. Serve responsive, next-gen images to cut the ~1 MB image payload.
3. Trim unused JavaScript and enable minification.
