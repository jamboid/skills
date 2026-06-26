# performance-audit reference

The contract between the `draft` step and `build_report.py`: the `audit.json`
schema, the metric thresholds the script colours against, and the
section-omission rules. `audit.json` is **generated, never hand-edited** — the
human-editable inputs are `notes.md`, `analysis.md`, and the data exports.

## `audit.json` schema

```jsonc
{
  "meta": {
    "title":     "Acme — Site Audit",   // doc <title> fallback; not the H1
    "slug":      "acme",                 // output filenames; lowercase-kebab
    "url":       "https://acme.com",     // drives the H1 site name + URL button
    "date":      "2026-06-18",           // ISO; defaults to today if absent
    "auditedBy": "Jamie Boyd",
    "audience":  "internal SD/AD",
    "scope":     "site audit, performance-focused"  // markdown meta line only
  },
  // The H1 is "Performance Review: <site>", where <site> is the url host (sans
  // www), falling back to title with a trailing " — Site Audit" stripped. The
  // header shows the url as a button plus Date / By / Audience chips; the
  // sidebar shows the site name (no duplicated title/date).

  "summary": "Executive summary prose. Open by setting the scene (what the site/page is, that this is a performance audit, how it was measured) before the headline verdict; orient, don't duplicate `conclusions`. Plain language. Supports `code`, **bold**, blank-line paragraphs, and `- ` bullet lists (use a list for any run of 3+ parallel items).",

  // ── Metrics (computed from Lighthouse/WPT). Grouped by target device; each
  //    device holds one or more audits. The script renders these as a load-
  //    timeline: a device segmented control (shown only when >1 device), audit
  //    tabs, and per-audit threshold rails grouped into load phases. ──
  "metrics": {
    // optional lead-in prose, rendered above the metrics component. State what
    // tools were run, how (lab vs field, form factors, throttling) and that the
    // full data exports were parsed for these numbers. Provenance, not verdict —
    // leave the good/poor call to `summary` and the rails. Same markup as
    // `summary` (code, **bold**, paragraphs, `- ` bullets). Omit if it adds nothing.
    "intro": "The numbers below come from Google Lighthouse (v13.2.0), run in the lab...",
    "groups": [
      {
        "device": "Desktop",                  // Desktop | Mobile (tab + segmented control label)
        "audits": [
          {
            "type":      "Lighthouse",         // audit/tool name — the tab label
            "source":    "Lighthouse 13.2.0 (lab)",  // what produced these numbers (caption)
            "perfScore": 100,                  // 0–100 Lighthouse score, or null/omit if none
            "reportUrl": "https://pagespeed.web.dev/...",  // optional "View full report" link
            "items": [
              // key drives threshold lookup + glossary; value in the unit noted
              // in the threshold table; display + rating optional (auto-derived).
              // Items are reordered into load phases by the script — author order
              // doesn't matter. Resource keys (weight/requests) render as cards.
              { "key": "LCP",      "value": 0.74 },
              { "key": "CLS",      "value": 0.0 },
              { "key": "INP",      "value": null, "display": "lab N/A", "rating": "na" },
              { "key": "TBT",      "value": 0 },
              { "key": "SI",       "value": 0.48 },
              { "key": "weight",   "value": 1165647 },
              { "key": "requests", "value": 22 }
            ]
          },
          {
            "type":      "WebPageTest",
            "source":    "WebPageTest (Chrome), median of 3 runs",
            "reportUrl": "https://www.webpagetest.org/result/...",
            "items": [ /* ...same shape; WPT has no perfScore... */ ]
          }
        ]
      }
      // ...optional Mobile group with its own audits.
    ]
  },
  // When a device has >1 audit the script prepends a computed "Overall" tab
  // (per-metric mean across that device's audits). Its score component shows
  // only when ≥2 audits carry a perfScore (a genuine average); a lone score
  // would just repeat its own tab, so the Overall tab omits it. A device with a
  // single audit shows no Overall tab. The legacy `metrics.devices[]` shape (one
  // block per source) is still accepted — each becomes a one-audit group — but
  // `groups` is preferred.

  "architecture": "1–2 paragraphs on CMS / framework / build approach and the code shape it produces. Supports `code`, **bold**, blank-line paragraphs, and `- ` bullet lists (use a list for any run of 3+ parallel items, e.g. third-party scripts). Omit the key (or null) if the notes had nothing.",

  "performance": {
    "tests": [
      { "label": "PageSpeed Insights", "url": "https://..." },
      { "label": "WebPageTest",        "url": "https://..." }
    ],

    // Candidate findings: each is a diagnostic card. Lighthouse opportunities
    // seed these; notes/analysis confirm or add. Ordered by severity then
    // savings. confirmed:false marks an unratified candidate (rendered with a
    // "candidate" tag) — drop or confirm on rebuild.
    //
    // ID CONVENTION: give every finding a stable `id` of the form `F<n>` — F1,
    // F2, F3… (the "F" is for Finding; it is NOT a Lighthouse id — those slugs
    // live in `source`). Number them in render order (severity, then savings).
    // The id renders as the card's badge, is the anchor a priority links to, and
    // is how `analysis.md` refers to a finding — so it must be present and unique
    // on any finding that a priority cites.
    "findings": [
      {
        "id":             "F1",
        "title":          "Eliminate render-blocking resources",
        "severity":       "high",            // high | medium | low
        "savingsDisplay": "est. 1.2 s · 240 KB",  // optional
        "source":         "lighthouse:render-blocking-resources", // optional provenance
        "confirmed":      true,
        "body":           "Diagnostic prose: cause, not just symptom. Supports `code`, **bold**, blank-line paragraphs."
      }
    ]
  },

  // Page-resources component — the per-category asset breakdown, rendered as an
  // expandable table immediately under Metrics (replaces the old flat assets
  // table). Top-level, not under `performance`. Omit the whole key if absent.
  // Store RAW BYTES per device; the script formats sizes and computes bar widths.
  // All count/byte arrays align to `devices` (length 1 or 2).
  "resources": {
    // optional lead-in prose, rendered above the breakdown. Summarise the
    // totals (file count, overall size per device) and the category split as a
    // proportion bullet list, biggest first. Neutral — state the numbers, don't
    // interpret them (the third-party / images story belongs to architecture +
    // findings). Same markup as `summary`. Match device phrasing to the audit:
    // only say "sortable by device" when there are two devices. Omit if it adds nothing.
    "intro": "The homepage pulls in 49 files totalling 1.33 MB...",
    "devices": ["Desktop", "Mobile"],          // 1 or 2 column headers
    "total":   { "requests": [22, 22], "bytes": [1165647, 744253] },
    "categories": [
      // `type` ∈ Images | Font | Document | Stylesheet | Script | Media | Other
      // (drives the icon + colour; unknown types fall back to Other).
      { "type": "Images", "requests": [16, 16], "bytes": [1031388, 588579],
        "assets": [
          // One row per asset; match the same file across devices by basename so
          // the two `bytes` show the responsive-image saving (or its absence).
          // `url` is optional: the full request URL. When present it renders as a
          // small linked host line (with an outgoing-link icon) under the name,
          // labelling each asset's origin — useful for opaque CDN/analytics files.
          { "name": "hero.png.webp",    "bytes": [321779, 321779] },
          { "name": "banner2.png.webp", "bytes": [304128,  89088],
            "url": "https://cdn.example-images.com/banner2.png.webp" }
          // Files whose larger device size is < 10 KB fold into a per-category
          // "+N files under 10 KB" summary row (only when ≥2 collapse); the script
          // does the folding — list every asset here, don't pre-collapse the tail.
        ] }
    ]
  },

  "accessibility": {
    "tests":    [ { "label": "Contrast check", "url": "https://..." } ],
    "findings": [ "Bullet. Supports `code` / **bold**.", "..." ]
  },

  "ux": [ "Design / UX bullet.", "..." ],

  "conclusions": "1–2 paragraphs of narrative. Name the trade-offs that produced the situation; distinguish quick wins from structural work. Supports `code`, **bold**, blank-line paragraphs, and `- ` bullet lists (use a list for the ordered fixes / quick wins).",

  // Priority actions — the commissioner-facing worklist. Each is an object, not
  // a bare string. `title` is a plain-language action (no jargon); `rationale`
  // carries the business consequence — what it costs the visitor/business, not
  // just the technical symptom. `impact` and `effort` are each high|medium|low
  // and render as a split chip. A priority usually bundles one-or-more findings:
  // list their `id`s in `findings` and the script renders a compact link to each
  // (labelled with the id, e.g. F1, with the finding's title on hover) that
  // jumps to the finding card. Omit `findings` (or leave empty) for a strategic /
  // structural recommendation with no single finding behind it — it renders a
  // "Strategic priority" tag instead. The script SORTS the list by impact
  // (high→low) then effort (low→high), so author order doesn't matter; there are
  // no rank numbers. Both `title` and `rationale` support `code` / **bold**.
  "priorities": [
    { "title":     "Turn on Drupal CSS aggregation",
      "rationale": "A dozen stylesheets ship as separate render-blocking files; aggregating them is a config switch worth ~1.4 s of mobile FCP.",
      "impact":    "high",
      "effort":    "low",
      "findings":  [ "F1" ] },
    { "title":     "Reconsider the third-party script stack",
      "rationale": "830 KB of tag-manager and tracking JS runs on every page; deciding what still earns its place is an organisational call, not a one-line fix.",
      "impact":    "low",
      "effort":    "high" }
  ],

  // Glossary keys to render (canonical definitions live in the script).
  // Auto-populate from the metric/finding keys that actually appear.
  "glossary": [ "LCP", "CLS", "INP", "weight", "requests" ]
}
```

## Metric thresholds (canonical)

The script owns these. It derives each metric card's `rating`
(`good` / `needs-improvement` / `poor`) from `key` + `value` unless the JSON
sets `rating` explicitly. Keys not listed default to `neutral`. Use `"rating":
"na"` for a metric the export can't supply (e.g. lab INP).

| key        | unit    | good     | needs-improvement | poor    |
|------------|---------|----------|-------------------|---------|
| `LCP`      | seconds | < 2.5    | 2.5 – 4.0         | > 4.0   |
| `CLS`      | unitless| < 0.1    | 0.1 – 0.25        | > 0.25  |
| `INP`      | ms      | < 200    | 200 – 500         | > 500   |
| `TBT`      | ms      | < 200    | 200 – 600         | > 600   |
| `SI`       | seconds | < 3.4    | 3.4 – 5.8         | > 5.8   |
| `FCP`      | seconds | < 1.8    | 1.8 – 3.0         | > 3.0   |
| `weight`   | bytes   | —        | —                 | —       |
| `requests` | count   | —        | —                 | —       |

`weight` and `requests` have no official thresholds — they render `neutral`
unless the notes justify an explicit `rating`. Store `value` in the unit above;
the script formats `display` (e.g. `4.8 s`, `10.3 MB`) when it is omitted.

## Section-omission rules

- **Always present:** Executive summary, Metrics dashboard, Conclusions,
  Priority actions, Glossary, Appendix.
- **Conditional:** Architecture, Accessibility, Design & UX, the Performance
  section (Tests + Findings), and the Page resources component — omit the
  section entirely when its key is absent, null, or an empty array. Page
  resources renders only when `resources.categories` is non-empty; Performance
  renders only for `tests` or `findings`. Never pad to fill.
- Glossary renders only the keys in `meta.glossary`; keep it to metrics that
  actually appear.

## Glossary definitions (canonical, owned by the script)

One sentence each, reader is mid-technical.

- **LCP** — Largest Contentful Paint. Time to render the largest visible content above the fold. Good < 2.5 s, poor > 4 s.
- **CLS** — Cumulative Layout Shift. Sum of unexpected layout movement during load. Good < 0.1, poor > 0.25.
- **INP** — Interaction to Next Paint. Time from a user interaction to the next visual response. Good < 200 ms, poor > 500 ms. Field-data metric — not produced by a Lighthouse lab run.
- **TBT** — Total Blocking Time. Lab proxy for INP: main-thread time blocked during load. Good < 200 ms.
- **SI** — Speed Index. How quickly content visually populates during load. Good < 3.4 s.
- **FCP** — First Contentful Paint. Time to the first text or image painted. Good < 1.8 s.
- **weight** — Page weight. Total bytes downloaded to render the page. More weight means longer load, more parsing, more mobile bandwidth.
- **requests** — Request count. Number of HTTP requests to render the page. High counts (> 100) usually signal concatenation/optimisation gaps.
