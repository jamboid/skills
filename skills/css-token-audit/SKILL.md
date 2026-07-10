---
name: css-token-audit
description: Reverse-engineers a project's CSS custom-property (design-token) architecture from a deterministic css-tree parse of the COMPILED CSS, and reports its shape and problems. Use when the user wants to audit CSS variables/tokens, see the shape of a token system, find dead or duplicate tokens, or check custom-property architecture. Walking skeleton — fan-in/fan-out axis + dead/duplicate findings.
disable-model-invocation: true
---

# css-token-audit

Reverse-engineers the CSS custom-property architecture a codebase actually has —
the *shape* of its token system — from a **deterministic parse**, and reports it
plus its cheapest problems. Framework-agnostic: it infers the codebase's own
scheme, it doesn't impose a house style.

**Never read the CSS by eye.** A bundled css-tree parser extracts the token
dependency graph as structured facts; the report is rendered from those facts.
Reading raw CSS misses references and hallucinates — the whole point of the
parser is to not do that.

`audit.json` is the single generated source of truth; `build_report.mjs` renders
it. `audit.json` is **never hand-edited** — re-run `analyze.mjs`. See
[REFERENCE.md](REFERENCE.md) for the schema (the versioned contract).

This is the **walking skeleton** (one axis: fan-in/fan-out; two findings: dead
tokens, exact-duplicate definitions). Later slices add naming, tiers, scope &
cascade, coverage, near-duplicates, and the dispose/feedback loop.

## Audit the COMPILED CSS, not the authored source

The single most important input decision. `var()` only resolves in the compiled
CSS — that is the source of truth. Authored source that runs through **any**
build step (Sass, PostCSS, CSS `@function`, `utopia.clamp()` and similar) is
**not** valid final CSS: the parser can't fully read it, silently drops `var()`
references, and reports **false dead tokens**.

Before auditing, find the one CSS tree to point at:

- Prefer the **compiled/served** stylesheet(s) — e.g. `build/…`, `dist/…`,
  `_site/…`, or whatever the site actually loads.
- If the project is genuinely plain CSS with no build step, the authored CSS is
  fine.
- **Don't** glob a repo root that contains *both* a source tree and a build
  output — that double-counts every token. Pick one tree.

If the run reports `parseErrors > 0`, treat the result as provisional: you're
almost certainly parsing preprocessor source. Re-point at the compiled CSS.

## `/css-token-audit init [slug]`

1. Target directory: `~/GitHub/audits/YYYY-MM-DD-[slug]-tokens/` (today's date, ISO).
2. Create it, copy `notes-template.md` → `notes.md`, replacing placeholders.
3. Tell the user the absolute path and that they should identify the **compiled**
   CSS tree, then run `/css-token-audit draft` pointing at it.

## `/css-token-audit draft`

1. **Identify the CSS tree** (see above). Determine the absolute path to the
   compiled/served CSS. If unsure which of several trees is the build output,
   ask the user rather than guessing — the wrong tree produces false findings.
2. **Analyse** — run the bundled parser:
   ```
   node scripts/analyze.mjs --root <css-tree> --slug <slug> --out audit.json
   ```
   Useful flags: `--exclude <fragment>` (repeatable, skips path fragments),
   `--top <n>` (load-bearing list length, default 15).
3. **Check parse coverage.** Read `meta.parseErrors` in `audit.json`. If it's
   non-zero, you're likely parsing preprocessor source — tell the user, and
   re-point at the compiled CSS before trusting the findings.
4. **Build the report:**
   ```
   node scripts/build_report.mjs audit.json --out <slug>-token-audit.md
   ```
5. **Report back** the two output paths and the headline shape: token count,
   the top load-bearing tokens, dead/one-off counts, and any parse-coverage
   caveat. This is the **validation gate** — confirm with the user that the
   reconstructed architecture is one they recognise as true before anything
   downstream is built on it.

## Reading the output

- **Fan-in** — how many places reference a token. High fan-in = load-bearing.
- **Fan-out** — how many other tokens a token references in its own value.
- **Dead** — defined, zero references. A refactor lead (but check the parse
  warning, and note static analysis can't see JS/inline consumption).
- **One-off** — referenced exactly once; inline or consolidation candidates.
- **Dangling references** — used via `var()` but never defined here (a typo, a
  token defined in an un-audited file, or a runtime/JS-set property).

## Bundled files

- `scripts/analyze.mjs` — parser + graph + fan-in/fan-out + findings → `audit.json`.
- `scripts/build_report.mjs` — renders `audit.json` → Markdown; refuses an incompatible schema major.
- `notes-template.md` — copied to `notes.md` by `init`.
- `REFERENCE.md` — the `audit.json` schema and versioning contract.

## Requirements

Needs `css-tree` (a repo dependency). Run `npm install` in the skills repo if the
script reports it can't find the module.
