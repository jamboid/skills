# Report template

The structural skeleton for the audit report produced by `/perf-audit draft`. Mirrors the notes one-to-one with two additions: an Executive summary at the top, and a Glossary appendix at the bottom.

## Section omission

- Sections 3–6 (Architecture, Performance, Accessibility, Design & UX) are conditionally required: if the corresponding notes section is empty or trivially short, omit it from the report rather than padding.
- The "Images and assets" sub-section under Performance follows the same rule.
- Executive summary, Conclusions, Priority actions, and Appendix are always present.

## Skeleton

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

[Only definitions for metrics that appear in the Performance section. See the Glossary reference in SKILL.md for canonical wording.]

## Appendix — raw test runs

- PageSpeed Insights: [link]
- WebPageTest: [link]
- Lighthouse: [link]
```
