# Reading audit data

How to turn the JSON exports dropped in the audit directory into `audit.json`
fields. Read the actual file structure and adapt — exact paths drift between
tool versions, so treat these as a **map of what to look for**, not literal
guarantees. Every number here is a **candidate**: it populates the report, but
the user's notes/analysis confirm the interpretation.

## Classify each file by shape

Glob the directory for `*.json` and route each:

- **Lighthouse** — top-level `categories` and `audits` (a DevTools "Save as
  JSON" export), or the same nested under `lighthouseResult` (a PSI API
  response). Unwrap `lighthouseResult` if present.
- **WebPageTest** — top-level `data` carrying `data.median` / `data.runs`.
- Neither shape → ignore, and tell the user the file wasn't recognised.

One Lighthouse file per form factor (mobile/desktop): read
`configSettings.formFactor` to label the device block.

## Lighthouse → `metrics` + `performance`

Audit values live at `audits["<id>"]`; prefer `numericValue` for the number and
`displayValue` for the `display` string.

| audit.json target          | Lighthouse path |
|----------------------------|-----------------|
| device `perfScore`         | `categories.performance.score` × 100 |
| `LCP` (s)                  | `audits["largest-contentful-paint"].numericValue` ÷ 1000 |
| `CLS`                      | `audits["cumulative-layout-shift"].numericValue` |
| `TBT` (ms)                 | `audits["total-blocking-time"].numericValue` |
| `SI` (s)                   | `audits["speed-index"].numericValue` ÷ 1000 |
| `FCP` (s)                  | `audits["first-contentful-paint"].numericValue` ÷ 1000 |
| `weight` (bytes)           | `audits["total-byte-weight"].numericValue` |
| `requests` (count)         | `audits["network-requests"].details.items.length` |
| asset breakdown rows       | `audits["resource-summary"].details.items[]` → `resourceType`, `requestCount`, `transferSize` |

**INP is not in a lab run.** Emit it as `{ "key": "INP", "value": null,
"display": "lab N/A", "rating": "na" }` unless a PSI/CrUX file supplies field
data (`loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT`).

### Failing audits → candidate findings

**Do not filter on `details.type === "opportunity"`.** Lighthouse 10+ deprecated
the opportunity/diagnostic split: `overallSavingsMs` is often `0` even on real
problems (a small page yields tiny byte savings while still failing badly), and
the biggest issues — e.g. `layout-shifts` driving a 0.59 CLS — aren't
opportunity-typed at all. Filtering that way misses the actual findings.

Instead, surface **failing performance audits**:

1. Scope to performance: `categories.performance.auditRefs[]` gives each audit's
   `id` and its `group`.
2. Keep audits where `score` is non-null and `< 1`, **and** `group` is
   `insights` or `diagnostics`. Exclude `group: "metrics"` (those are the LCP/CLS
   metric audits themselves — symptoms already in the dashboard, not fixes) and
   `group: "hidden"` (internal/legacy). On older Lighthouse there is no
   `insights` group; `diagnostics` plus opportunity-typed audits still apply.
3. Lighthouse 13's `insights` audits (`render-blocking-insight`,
   `cls-culprits-insight`, `lcp-discovery-insight`, …) consolidate the older
   `diagnostics`. When both an insight and its legacy diagnostic describe the
   same problem (e.g. CLS), keep one card — prefer the insight.
4. Rank by impact using `metricSavings` — an object of per-metric deltas like
   `{ "CLS": 0.591, "LCP": 0, "TBT": 0 }` — falling back to
   `details.overallSavingsBytes` / `details.overallSavingsMs` when present.

Each kept audit becomes a `performance.findings` card:

- `title` ← audit `title`
- `severity` ← `high` if `score === 0` or a `metricSavings` value pushes a metric
  into its poor band; `medium` if `score ≤ 0.5`; else `low`
- `savingsDisplay` ← built from whichever signal exists: a `metricSavings` delta
  (e.g. "CLS −0.59"), `overallSavingsBytes` (→ "· NNN KB"), `overallSavingsMs`
  (→ "est. N.N s"). Omit if all zero.
- `source` ← `"lighthouse:<audit-id>"`
- `confirmed` ← `false` (unratified candidate until notes/analysis ratify it)
- `body` ← one diagnostic sentence (cause, not symptom). Don't fabricate a root
  cause the data doesn't show; say "likely" and flag for confirmation.

High-signal audit ids: `layout-shifts`, `unsized-images`,
`non-composited-animations` (CLS); `render-blocking-resources`,
`unused-css-rules`, `unused-javascript`, `unminified-javascript`,
`unminified-css` (load); `modern-image-formats`, `uses-responsive-images`,
`uses-optimized-images`, `offscreen-images` (images); `mainthread-work-breakdown`,
`bootup-time`, `long-tasks` (TBT). Keep the meaningful failures, not every audit.

## WebPageTest → `metrics` + `performance`

The full-results export nests metrics per run and **per step**:
`data.runs["<n>"].firstView.steps[0].<Metric>`. (Older single-step exports put
them directly on `data.runs[n].firstView` — handle both: use `steps[0]` if a
`steps` array exists, else the `firstView` object itself.)

**Pick the median run.** `data.medians` maps each metric abbreviation to the
*run number* that is the median for it — e.g. `data.medians.LCP === 2` means run
`"2"` holds the median LCP. Either read each metric from its own median run, or
(simpler) take the run most metrics point to and read all of them from its
`steps[0]`. Metric times are in **milliseconds**.

| audit.json target    | step field (`...steps[0].*`)            |
|----------------------|------------------------------------------|
| `LCP` (s)            | `LargestContentfulPaint` ÷ 1000 |
| `CLS`                | `CumulativeLayoutShift` |
| `SI` (s)             | `SpeedIndex` ÷ 1000 |
| `TBT` (ms)           | `TotalBlockingTime` |
| `FCP` (s)            | `firstContentfulPaint` ÷ 1000 |
| TTFB (ms)            | `TTFB` — note only, no CWV threshold |
| `weight` (bytes)     | `bytesIn` |
| `requests` (count)   | `len(steps[0].requests)` |

**Asset breakdown** has no `breakdown` key — derive it from the
`steps[0].requests[]` array. Each request uses abbreviated fields: group by
`req_type` (`Stylesheet` / `Script` / `Image` / `Document` / `Font` / other),
count rows, and sum `b_in` (bytes downloaded). `cnt_type` (MIME) is the fallback
grouping key.

`data.lighthouse` and `data.CrUX` keys may also be present. When `CrUX` is
populated it carries **real-user field data** (LCP/INP/CLS) — the one source
that can fill the INP card a lab run leaves N/A.

WPT carries real multi-run medians and the full waterfall, so prefer it for the
asset breakdown and request count when both tools are present; use Lighthouse for
the lab CWV and the failing-audit findings.

## Reconciling both tools

If a device has both a Lighthouse and a WPT file, build one device block:
Lighthouse for CWV + perfScore + opportunities, WPT for `weight` / `requests` /
asset breakdown. Note the dual source in the device `source` string.
