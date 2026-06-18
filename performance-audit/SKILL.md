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
   WebPageTest) and extract metrics, asset breakdown, and candidate findings.
   Note any unrecognised file to the user.
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

Govern every prose field written into `audit.json` (summary, architecture,
finding bodies, conclusions).

1. **Plain.** Write for a smart non-specialist. ("Bloated code style" beats "elevated payload overhead.")
2. **Specific.** Real numbers beat qualifiers. "10.3MB, 150 requests" beats "a lot of weight." Keep any number the data or notes give.
3. **Diagnostic.** Explain *why* a finding is a problem (cause), not just *that* it is. "Large CSS because the framework is utility-class-heavy" beats "Large CSS file."
4. **Trade-off-aware.** Name the choice that produced the situation.
5. **No hedging.** Replace "could potentially be improved" with "fix this" or "consider replacing." (Exception: an unconfirmed **candidate** finding may say "likely" and is tagged as such until ratified.)

A short clean report beats a padded one.

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
