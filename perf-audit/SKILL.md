---
name: perf-audit
description: Drafts a structured performance-focused site audit report from your notes. `init` scaffolds a dated audit directory with a notes template; `draft` reads filled-in notes and produces a report after a brief clarifying pass. Use when invoked as /perf-audit init [client-slug] or /perf-audit draft, or when the user wants to write a performance-focused site audit.
disable-model-invocation: true
---

# perf-audit

Drafts a structured site audit report (performance-focused) from the user's notes. The skill structures and polishes the user's interpretation; it does not analyse raw audit data or propose findings the user hasn't observed.

Two commands: `init` scaffolds, `draft` writes the report.

## Commands

### `/perf-audit init [client-slug]`

1. Determine target directory: `~/Github/audits/YYYY-MM-DD-[client-slug]/` (today's date, ISO format).
2. If `~/Github/audits/` does not exist, create it.
3. Create the dated subdirectory.
4. Copy `notes-template.md` (next to this SKILL.md) to `notes.md` in the new directory. Replace the placeholder `[Client/Site Name]` and `[YYYY-MM-DD]` with the client slug and today's date.
5. Create an empty `report.md`.
6. Tell the user: directory created at the absolute path; notes.md ready to fill in; run `/perf-audit draft` from that directory when notes are complete.

### `/perf-audit draft`

1. Read `notes.md` from the current working directory. If it doesn't exist, tell the user to `cd` into the relevant audit subdirectory or run `/perf-audit init` first.
2. Read `reference-audit.md` (next to this SKILL.md) — this is the structural and tonal exemplar to pattern-match against.
3. Scan notes for thinness or missing inputs:
   - Missing tests/links in Performance
   - No top-level stats pasted
   - Empty Findings sections
   - Empty Priorities section (priorities are user-written, never invented)
   - Missing audience or scope in meta
4. Ask up to **3** clarifying questions — only the most important. Skip this step entirely if notes are complete.
5. Wait for the user's answers before drafting.
6. Draft the full report into `report.md` following the **Report structure** below.
7. Apply the **Tone rules**.
8. Include only glossary entries for metrics that actually appear in this report's Performance section.
9. Tell the user: report drafted at the absolute path; ready for review and editing.

## Notes template

Lives in `notes-template.md` next to this SKILL.md. `init` copies it into the audit subdirectory as `notes.md`.

## Report structure

The report mirrors the notes one-to-one with two additions: an Executive summary at the top, and a Glossary appendix at the bottom.

```markdown
# [Client/Site Name] — Site Audit

**URL:** [URL] · **Date:** [YYYY-MM-DD] · **Scope:** site audit, performance-focused · **Audience:** [audience]

## Executive summary

- 3–5 bullets, plain language, no jargon.
- Lead with impact, not technical detail.
- Cover the headline issues and the recommended priority asks.

## Site architecture

[1–2 paragraphs: CMS, framework, build approach, third-party embeds, and the resulting code/performance shape this combination produces.]

## Performance

### Performance tests

- [Tool name]: [link]
- ...

### Top-level stats

- LCP: ...
- CLS: ...
- INP: ...
- Page weight: ...
- Request count: ...
- Performance score: ... (mobile / desktop, where relevant)

### Analysis

- [Diagnostic bullets, specific numbers, cause-not-symptom.]

### Images and assets

[Only include if the notes had material in this sub-section. Otherwise omit entirely.]

## Accessibility

### Tests

- ...

### Analysis

- [Bullets.]

## Design and user experience

- [Bullets.]

## Conclusions

[1–2 paragraphs of narrative. Name the trade-offs that produced the situation. Recommend a realistic path forward — distinguish quick wins from larger structural work.]

### Priority actions

1. [User's first priority, lifted from notes, lightly polished.]
2. ...
3. ...

## Glossary

[Only definitions for metrics that appear in the Performance section. See the Glossary reference below for canonical wording.]

## Appendix — raw test runs

- PageSpeed Insights: [link]
- WebPageTest: [link]
- Lighthouse: [link]
```

### Section omission rules

- Sections 3–6 (Architecture, Performance, Accessibility, Design & UX) are conditionally required: if the corresponding notes section is empty or trivially short, omit it from the report rather than padding.
- The "Images and assets" sub-section under Performance follows the same rule.
- Executive summary, Conclusions, Priority actions, and Appendix are always present.

## Tone rules

1. **Plain.** Write for a smart non-specialist. Avoid jargon when a plain word works. ("Bloated code style" beats "elevated payload overhead.")
2. **Specific.** Real numbers beat qualifiers. "10.3MB, 150 requests" beats "a lot of weight."
3. **Diagnostic.** Explain *why* a finding is a problem (the cause), not just *that* it is (the symptom). "Large CSS file because the framework is utility-class-heavy" beats "Large CSS file."
4. **Trade-off-aware.** Name the choice that produced the situation. "The compromise you make when using a tool geared more to..." constructions are good.
5. **No hedging.** Say what you mean. Replace "could potentially be improved" with "fix this" or "consider replacing." Don't pad recommendations with maybes.

## Glossary reference

Use these definitions verbatim (or close to it) when a metric appears in the report:

- **LCP** — Largest Contentful Paint. Time to render the largest visible content above the fold. Google's thresholds: <2.5s good, 2.5–4s needs improvement, >4s poor.
- **CLS** — Cumulative Layout Shift. Sum of unexpected layout movement during page load. Google's thresholds: <0.1 good, 0.1–0.25 needs improvement, >0.25 poor.
- **INP** — Interaction to Next Paint. Time from user interaction (tap, click, keypress) to the next visual response. Google's thresholds: <200ms good, 200–500ms needs improvement, >500ms poor.
- **Page weight** — Total bytes downloaded to render the page (HTML + CSS + JS + images + fonts + other). More weight means longer load, more parsing, more bandwidth cost on mobile.
- **Request count** — Number of HTTP requests made to render the page. Each request adds overhead; high counts (>100) usually indicate concatenation/optimisation gaps.

## Reference audit

Lives in `reference-audit.md` next to this SKILL.md. Read it during `draft` to pattern-match voice and the way the example moves between observation, cause, and recommendation. Match the register; don't mimic the content. As stronger reports get produced with the skill, swap the file's contents for the new exemplar.

## Defaults

| Setting       | Default                                                                     |
|---------------|-----------------------------------------------------------------------------|
| audits root   | `~/Github/audits/`                                                          |
| audience      | internal Strategy Director / Account Director, occasional client passthrough |
| length        | short report — concise bullets in body, narrative only in conclusions       |
| scope         | site audit, performance-focused (covers arch / perf / a11y / UX)            |

## Operating principles

- **Structure and polish only.** Do not invent findings, propose priorities, or analyse raw audit data. The user's notes are the source of truth.
- **Omit, don't pad.** A short clean report beats a padded one. If a section's notes are empty, drop the section.
- **Specific over general.** Whenever the notes contain a number, keep the number in the report.
- **One sentence per glossary entry.** Reader is mid-technical; avoid teaching from first principles.
