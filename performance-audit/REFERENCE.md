# performance-audit reference

The contract between the `draft` step and `build_report.py`: the `audit.json`
schema, the metric thresholds the script colours against, and the
section-omission rules. `audit.json` is **generated, never hand-edited** — the
human-editable inputs are `notes.md`, `analysis.md`, and the data exports.

## `audit.json` schema

```jsonc
{
  "meta": {
    "title":     "Acme — Site Audit",   // report H1
    "slug":      "acme",                 // output filenames; lowercase-kebab
    "url":       "https://acme.com",
    "date":      "2026-06-18",           // ISO; defaults to today if absent
    "auditedBy": "Jamie Boyd",
    "audience":  "internal SD/AD",
    "scope":     "site audit, performance-focused"
  },

  "summary": "Executive summary prose. 3–5 sentences, plain language. Supports `code` and **bold**. Blank line separates paragraphs.",

  // ── Metrics dashboard (computed from Lighthouse/WPT). One block per device. ──
  "metrics": {
    "devices": [
      {
        "name":      "Mobile",                 // Mobile | Desktop
        "source":    "Lighthouse 12.4 (lab)",  // what produced these numbers
        "perfScore": 42,                        // 0–100, or null if unknown
        "items": [
          // key drives threshold lookup + glossary; value in the unit noted
          // in the threshold table; display + rating optional (auto-derived).
          { "key": "LCP",      "value": 4.8,      "display": "4.8 s" },
          { "key": "CLS",      "value": 0.21 },
          { "key": "INP",      "value": null,     "display": "lab N/A", "rating": "na" },
          { "key": "TBT",      "value": 820 },
          { "key": "SI",       "value": 6.1 },
          { "key": "weight",   "value": 10800000, "display": "10.3 MB" },
          { "key": "requests", "value": 150 }
        ]
      }
      // ...Desktop block
    ]
  },

  "architecture": "1–2 paragraphs on CMS / framework / build approach and the code shape it produces. Omit the key (or null) if the notes had nothing.",

  "performance": {
    "tests": [
      { "label": "PageSpeed Insights", "url": "https://..." },
      { "label": "WebPageTest",        "url": "https://..." }
    ],

    // Candidate findings: each is a diagnostic card. Lighthouse opportunities
    // seed these; notes/analysis confirm or add. Ordered by severity then
    // savings. confirmed:false marks an unratified candidate (rendered with a
    // "candidate" tag) — drop or confirm on rebuild.
    "findings": [
      {
        "id":             "P-1",
        "title":          "Eliminate render-blocking resources",
        "severity":       "high",            // high | medium | low
        "savingsDisplay": "est. 1.2 s · 240 KB",  // optional
        "source":         "lighthouse:render-blocking-resources", // optional provenance
        "confirmed":      true,
        "body":           "Diagnostic prose: cause, not just symptom. Supports `code`, **bold**, blank-line paragraphs."
      }
    ],

    // Asset breakdown table (resource-summary / WPT breakdown). Omit if absent.
    "assets": {
      "rows": [
        { "type": "Images", "requests": 48, "bytes": 8200000, "display": "8.2 MB" },
        { "type": "Script", "requests": 61, "bytes": 1400000, "display": "1.4 MB" }
      ],
      "total": { "requests": 150, "bytes": 10800000, "display": "10.3 MB" }
    }
  },

  "accessibility": {
    "tests":    [ { "label": "Contrast check", "url": "https://..." } ],
    "findings": [ "Bullet. Supports `code` / **bold**.", "..." ]
  },

  "ux": [ "Design / UX bullet.", "..." ],

  "conclusions": "1–2 paragraphs of narrative. Name the trade-offs that produced the situation; distinguish quick wins from structural work.",

  "priorities": [ "First action, specific.", "Second action.", "..." ],

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
- **Conditional:** Architecture, Accessibility, Design & UX, and the
  Performance findings / asset table — omit the section entirely when its key
  is absent, null, or an empty array. Never pad to fill.
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
