---
name: perf-audit
description: Drafts a structured performance-focused site audit report from the user's notes. Use when invoked as `/perf-audit init [client-slug]` or `/perf-audit draft`, or when the user wants to write a site audit.
disable-model-invocation: true
---

# perf-audit

Drafts a structured site audit report (performance-focused) from the user's notes. The skill structures and polishes the user's interpretation; it does not analyse raw audit data or propose findings the user hasn't observed.

Two commands: `init` scaffolds, `draft` writes.

## `/perf-audit init [client-slug]`

1. Target directory: `~/Github/audits/YYYY-MM-DD-[client-slug]/` (today's date, ISO).
2. Create `~/Github/audits/` if missing, then the dated subdirectory.
3. Copy `notes-template.md` (next to this SKILL.md) to `notes.md` in the new directory. Replace `[Client/Site Name]` and `[YYYY-MM-DD]` placeholders.
4. Create an empty `report.md`.
5. Tell the user: directory absolute path, that `notes.md` is ready to fill in, and that `/perf-audit draft` should be run from that directory once notes are complete.

## `/perf-audit draft`

1. Read `notes.md` from the current working directory. If missing, tell the user to `cd` into the audit subdirectory or run `/perf-audit init` first.
2. Read `reference-audit.md` (next to this SKILL.md) — the tonal exemplar to pattern-match against.
3. Read `report-template.md` (next to this SKILL.md) — the structure to follow.
4. Scan notes for thinness or missing inputs: missing tests/links, no top-level stats, empty Findings, empty Priorities, missing audience or scope.
5. Ask **at most 3** clarifying questions — only the most important. Skip entirely if notes are complete. Wait for answers before drafting.
6. Draft into `report.md` following `report-template.md`. Apply the **Tone rules** below.
7. Include only glossary entries for metrics that actually appear in the Performance section.
8. Tell the user: report absolute path, ready for review.

## Tone rules

1. **Plain.** Write for a smart non-specialist. ("Bloated code style" beats "elevated payload overhead.")
2. **Specific.** Real numbers beat qualifiers. "10.3MB, 150 requests" beats "a lot of weight." If the notes contain a number, keep it.
3. **Diagnostic.** Explain *why* a finding is a problem (cause), not just *that* it is (symptom). "Large CSS file because the framework is utility-class-heavy" beats "Large CSS file."
4. **Trade-off-aware.** Name the choice that produced the situation. "The compromise you make when using a tool geared more to..." constructions are good.
5. **No hedging.** Replace "could potentially be improved" with "fix this" or "consider replacing."

The user's notes are the source of truth. Don't invent findings or priorities. A short clean report beats a padded one — if a section's notes are empty, drop the section.

## Glossary reference

Use these definitions verbatim (or close to it) when the metric appears in the report. One sentence each — reader is mid-technical.

- **LCP** — Largest Contentful Paint. Time to render the largest visible content above the fold. Google's thresholds: <2.5s good, 2.5–4s needs improvement, >4s poor.
- **CLS** — Cumulative Layout Shift. Sum of unexpected layout movement during page load. Google's thresholds: <0.1 good, 0.1–0.25 needs improvement, >0.25 poor.
- **INP** — Interaction to Next Paint. Time from user interaction (tap, click, keypress) to the next visual response. Google's thresholds: <200ms good, 200–500ms needs improvement, >500ms poor.
- **Page weight** — Total bytes downloaded to render the page (HTML + CSS + JS + images + fonts + other). More weight means longer load, more parsing, more bandwidth on mobile.
- **Request count** — Number of HTTP requests made to render the page. Each request adds overhead; high counts (>100) usually indicate concatenation/optimisation gaps.

## Bundled files

- `notes-template.md` — copied to `notes.md` by `init`.
- `reference-audit.md` — tonal exemplar, read during `draft`. Swap its contents for a stronger audit when one is produced.
- `report-template.md` — report skeleton + section-omission rules, read during `draft`.

## Defaults

| Setting     | Default                                                                      |
|-------------|------------------------------------------------------------------------------|
| audits root | `~/Github/audits/`                                                           |
| audience    | internal Strategy Director / Account Director, occasional client passthrough |
| length      | short report — concise bullets in body, narrative only in conclusions        |
| scope       | site audit, performance-focused (covers arch / perf / a11y / UX)             |
