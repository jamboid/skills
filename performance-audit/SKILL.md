---
name: performance-audit
description: Drafts a structured performance-focused site audit from notes plus Lighthouse/WebPageTest data exports, producing a Markdown report and a static HTML report. Use when invoked as `/performance-audit init [client-slug]` or `/performance-audit draft`, or when the user wants to write a site audit.
disable-model-invocation: true
---

# performance-audit

Drafts a structured site audit (performance-focused) and builds it into a
Markdown report **and** a static HTML report.

Two sources feed it, with a clear division of authority. **Data exports**
(Lighthouse / WebPageTest JSON) *propose*: they populate the metrics and seed
**candidate** findings — measured, not invented. **Notes and analysis**
*dispose*: the user's words remain the source of truth for judgment and ratify
or override anything the data surfaced. The skill never fabricates a finding the
data doesn't show or the user hasn't observed.

`audit.json` is the single generated source of truth; `build_report.py` turns it
into both reports. The human-editable inputs are `notes.md`, `analysis.md`, and
the data exports — never `audit.json` or the generated reports.

Two commands: `init` scaffolds, `draft` analyses and builds.

## `/performance-audit init [client-slug]`

1. Target directory: `~/Github/audits/YYYY-MM-DD-[client-slug]/` (today's date, ISO).
2. Create `~/Github/audits/` if missing, then the dated subdirectory.
3. Copy `notes-template.md` → `notes.md` and `analysis-template.md` → `analysis.md`
   into the new directory. Replace `[Client/Site Name]` and `[YYYY-MM-DD]` placeholders.
4. Tell the user the absolute path, and that they should:
   - fill in `notes.md`;
   - drop **Lighthouse JSON exports** (DevTools → Lighthouse → Save as JSON, one
     per form factor) and any **WebPageTest JSON export** into this directory;
   - leave `analysis.md` until after the first draft;
   - run `/performance-audit draft` from this directory.

## `/performance-audit draft`

1. Read `notes.md` from the current working directory. If missing, tell the user
   to `cd` into the audit subdirectory or run `/performance-audit init` first.
2. **Ingest data.** Glob the directory for `*.json`. For each, follow
   [reading-audit-data.md](reading-audit-data.md) to classify (Lighthouse vs
   WebPageTest) and extract metrics, the per-asset `resources` breakdown, and
   candidate findings. Note any unrecognised file to the user.
3. **Incorporate analysis (rebuild).** If `analysis.md` exists and is filled in,
   read it: its prose is the authoritative voice. It confirms/overrides candidate
   findings (drop unratified ones it dismisses) and supplies architecture,
   conclusions, and priorities.
4. Read [reference-audit.md](reference-audit.md) — the tonal exemplar.
5. Scan for gaps: missing tests/links, empty notes sections, missing audience or
   scope. Ask **at most 3** clarifying questions — only the most important. Skip
   if inputs are complete. Wait for answers.
6. **Write `audit.json`** following the schema in [REFERENCE.md](REFERENCE.md).
   Apply the **Tone rules** to every prose field. Auto-populate `glossary` from
   the metric/finding keys that actually appear. Follow the section-omission
   rules — drop empty sections, don't pad.
7. **Build** both reports:
   ```
   python3 scripts/build_report.py audit.json --out-dir .
   ```
   It writes `<slug>-audit.md` and `html/<slug>.html`.
8. Tell the user the two output paths. On a first draft, remind them they can now
   fill in `analysis.md` and re-run `draft` to fold their take in.

## Tone rules

Govern every prose field written into `audit.json` (summary, metrics intro,
page-resources intro, architecture, finding bodies, conclusions).

1. **Plain.** Write for a smart non-specialist. ("Bloated code style" beats "elevated payload overhead.")
2. **Define the jargon.** Gloss every technical term or acronym in plain words the first time it appears, then use it freely. "LCP (Largest Contentful Paint — when the biggest thing on screen finishes loading)"; "third-party scripts — code loaded from other companies' services." Don't introduce an acronym you never expand (drop FCP rather than leave it bare). The reader should never have to already know the term to follow the sentence.
3. **Specific.** Real numbers beat qualifiers. "10.3MB, 150 requests" beats "a lot of weight." Keep any number the data or notes give.
4. **Diagnostic.** Explain *why* a finding is a problem and name the choice that produced it — cause, not just symptom. "Large CSS because the framework is utility-class-heavy" beats "Large CSS file."
5. **No hedging.** Replace "could potentially be improved" with "fix this" or "consider replacing." (Exception: an unconfirmed **candidate** finding may say "likely" and is tagged as such until ratified.)
6. **List the enumerations.** When a sentence runs through three or more parallel items (third-party scripts, ordered fixes, causes), break them out as a Markdown bullet list with a short lead-in line, not a comma-run buried in prose. One item per line, the key term and its number bolded. `summary`, `architecture`, and `conclusions` all render Markdown `- ` bullets — use them. Keep genuinely one- or two-item points inline.
7. **Summary orients; conclusions judge.** Open the `summary` by setting the scene — what the site/page is, that this is a performance audit, and how it was measured (which tools, lab vs. field, which form factors) — *before* the headline verdict. It should read like the way into the report, not its verdict, and hand off to the rest ("the findings below lay this out") rather than pre-empting it. Leave the fix detail, priorities, and the considered judgement to `conclusions`. Litmus test: if `summary` and `conclusions` could be swapped without anyone noticing, the summary isn't doing its own job — rewrite it to orient.
8. **State, don't finish.** Performance is a point-in-time reading, not a finished task — a site that's fast today can be tanked next week by what gets added. Describe it as a current state ("desktop performance is excellent", "poor as it stands") that future changes could move. Avoid finality: no "solved", "done", "fixed for good", "sorted."
9. **Section intros orient, they don't judge.** The optional `metrics.intro` and `resources.intro` set their data up before it appears, then hand off — neither pre-empts the good/poor call (the summary's and the components' job). `metrics.intro`: which tools ran and how (lab vs. field, form factors, throttling), and that the full exports were parsed. `resources.intro`: the totals (files, size per device) and the category split as a proportion list, biggest first — state the numbers, leave the *why* (third-party weight, oversized images) to architecture and findings. Keep each short, match any device phrasing to the audit (don't say "sortable by device" on a single-device run), and omit either if it only restates the captions or table.
10. **Em dashes sparingly; colons for label–value.** An em dash is fine for a genuine aside in flowing prose, but in a `term: figure` bullet use a colon, not a dash (`Script: ~810 KB (62%)`, not `Script — ~810 KB (62%)`). Never butt an em dash against a `~` or the number it modifies — `— ~600 ms` reads badly; recast (`saving ~600 ms`) or spell it out (`about 600 ms`). Don't stack two em dashes in one sentence; if the aside is long, use parentheses.

Don't let plainness inflate the word count — looser sentences and lists are for clarity, not padding. A short clean report beats a padded one.

## Bundled files

- `notes-template.md` — copied to `notes.md` by `init` (initial observations).
- `analysis-template.md` — copied to `analysis.md` by `init` (the user's considered take, added after the first draft).
- `reading-audit-data.md` — Lighthouse/WPT JSON classification + extraction maps; read during `draft` when data files are present.
- `reference-audit.md` — tonal exemplar, read during `draft`.
- `REFERENCE.md` — `audit.json` schema, metric thresholds, section-omission rules, canonical glossary.
- `scripts/build_report.py` — builds Markdown + HTML from `audit.json`.
- `assets/report-template.html` — static warm-stone HTML template.

The glossary definitions and metric thresholds live canonically in
`build_report.py` (mirrored in REFERENCE.md) — not here.

## Defaults

| Setting     | Default                                                                      |
|-------------|------------------------------------------------------------------------------|
| audits root | `~/Github/audits/`                                                           |
| audience    | internal Strategy Director / Account Director, occasional client passthrough |
| length      | short report — concise bullets in body, narrative only in conclusions        |
| scope       | site audit, performance-focused (covers arch / perf / a11y / UX)             |
