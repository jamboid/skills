---
name: accessibility-audit
description: Audits a codebase or folder of template/markup files against WCAG 2.1 and produces a Markdown report plus an interactive HTML artifact with per-issue fix tracking. Use when the user wants an accessibility audit, a WCAG review, an a11y report, to check templates or components for accessibility issues, or mentions WCAG, ARIA, screen readers, or assistive technology review.
---

# Accessibility Audit

Scans markup for WCAG 2.1 issues and produces two deliverables from a single
structured source: a Markdown report and a self-contained, hosting-ready HTML
report with a `localStorage`-backed fix checklist.

## Workflow

1. **Confirm scope.** Identify the files to audit — a folder, a glob, or the whole
   repo. The default conformance target is **WCAG 2.1 AA**. If the user asks for
   "AAA", audit at AAA and include enhanced criteria; if "A", flag level A only.

2. **Scan every in-scope file.** Read each one in full — do not sample. Supported
   file types: HTML, Twig, Blade, JSX/TSX, Vue SFC, ERB. For each file, work
   through the issue-pattern checklist in [REFERENCE.md](REFERENCE.md). Record the
   exact file path and line number(s) for every finding.

3. **Classify findings** into four severity tiers — Critical / High / Medium / Low
   — using the rubric in REFERENCE.md. Give each a stable id (`C-1`, `H-3`, …).
   Cite the specific WCAG success criterion (number, name, level) for every issue.

4. **Write `findings.json`** into the output folder, following the schema in
   REFERENCE.md. This file is the single source of truth for both deliverables.

5. **Generate the reports** by running the build script:
   ```
   python3 scripts/build_report.py <path/to/findings.json> --out-dir <output-folder>
   ```
   It writes `<slug>-audit.md` and `html/<slug>.html`.

6. **Report back** the two output paths and a one-line severity tally.

## Output location

Default to a `docs/accessibility/` folder in the audited project unless the user
specifies otherwise. The HTML is hosting-ready — open the file directly or serve
the `html/` folder at any domain.

## The HTML artifact

- Warm-stone light theme: light content panel with a slightly darker light sidebar,
  generously sized readable type, and severity colours reserved as accents.
- Severity-grouped sidebar nav with scroll-spy; mobile-friendly; print stylesheet.
- Every issue card carries a checkbox; ticking it marks that issue fixed — shown
  with a green left border, tinted header, and struck-through title (the body stays
  fully legible, not dimmed).
- Fix state persists across browser sessions via `localStorage`, namespaced per
  report so multiple audits hosted on one domain never collide.
- Live remediation progress bar, a "hide fixed" filter (in both the overview and the
  sidebar, kept in sync), and a reset control.

## Notes

- Audit markup first; reference CSS or JS only where a markup issue depends on
  them (e.g. `prefers-reduced-motion`, JS-injected controls).
- If a finding can only be confirmed at runtime (colour contrast, JS-built ARIA),
  state that explicitly in the issue and describe what to verify.
- Re-running the script after editing `findings.json` regenerates both files;
  hosted fix-progress survives because it is keyed to the report slug.

## Language rules

Govern every prose field written into `findings.json` (summary, issue impacts,
fixes, recommendations).

1. **One point in time.** Each report is a standalone snapshot of the markup
   audited — it has no memory. Never reference a previous audit, an earlier run,
   or a prior state of the code (e.g. "fixed since the last review", "previously
   flagged", "remaining from last time"). Report only the issues present in the
   code as it stands now. (Forward-looking fix instructions like "re-check the
   heading outline afterwards" are fine — this bans only backward references.)
2. **Plain and literal.** Write for a non-technical reader first. Strip jargon —
   gloss any unavoidable technical term the first time it appears — and avoid
   metaphors, idioms, and clever flourishes; say what you mean in plain, generic
   words. "There's no fire here, only polish" → "Nothing here is broken; these
   are refinements". (Technical terms that genuinely belong in a fix — element
   names, ARIA attributes — are fine; this targets needless jargon and figurative
   phrasing, not precision.)

## Reference

- [REFERENCE.md](REFERENCE.md) — WCAG 2.1 success-criterion catalogue,
  issue-pattern detection checklist, severity rubric, and the `findings.json`
  schema with a worked example.
