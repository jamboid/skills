---
name: css-token-audit
description: Reverse-engineers a project's CSS custom-property (design-token) architecture from a deterministic css-tree parse of the COMPILED CSS, and reports its shape and problems. Use when the user wants to audit CSS variables/tokens, see the shape of a token system, find dead or duplicate tokens, find near-duplicate tokens to consolidate, check naming consistency, check tier/layering leaks, check scope/cascade/theming, check token coverage / hardcoded literals / fallback usage, or check custom-property architecture. Axes so far: fan-in/fan-out + naming taxonomy + layering/tiers + scope & cascade + coverage/hardcode + fallback usage + near-duplicates; findings: dead, exact-duplicate, near-duplicate, naming outliers, tier leaks, cascade smells, hardcoded literals matching a token.
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

Seven axes so far: **fan-in/fan-out** (#18); **naming taxonomy** (#19, a grammar
inferred *per tier* — global `:root` design tokens vs block-scoped locals);
**layering/tiers** (#20, the primitive → semantic → component tier system
reconstructed from the graph, and whether value flows one way or leaks);
**scope & cascade** (#21, where each token lives in the cascade — root / theme /
component — where it gets overridden, and how theming is wired, all statically);
**coverage/hardcode** (#22, the share of tokenizable declarations that route
through a token vs a raw literal); **fallback usage** (#22, the catalogue of
`var(--x, fallback)` patterns by kind); and **near-duplicates** (#23, clusters of
tokens whose raw values are *nearly* the same — consolidation leads, by colour
distance / numeric proximity). Findings: dead tokens, exact-duplicate
definitions, near-duplicate token clusters, naming outliers (inconsistent
abbreviations, off-grammar prefixes), tier leaks (up-tier, circular, or a skip
against a semantic-routing norm), cascade smells (a shadowed unreachable
definition, or a global strayed into a component against a theming norm), and
hardcoded literals that match an existing token's value (a missed tokenization).
Later slices add the dispose/feedback loop.

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
3. **Check the two coverage guards** in `audit.json`:
   - `meta.parseErrors > 0` → you're likely parsing preprocessor source. Re-point
     at the compiled CSS before trusting the findings.
   - `doubling` non-null → `--root` spanned both a source tree and its build
     output; counts are doubled and the exact-duplicate findings are phantom.
     Re-run against the one tree it names as compiled.
   Either guard means the run is provisional — surface it to the user, don't
   bury it.
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
- **Naming (per tier)** — the inferred grammar and its consistency for the
  global and block tiers separately. **Off-grammar** globals and **abbreviation
  conflicts** (one concept spelled two ways in a tier) surface as `convention`
  findings — deviations to weigh, never "wrong".
- **Layering / tiers** — the primitive → semantic → component tiers rebuilt from
  the graph (primitive holds a raw value, semantic aliases a primitive,
  component is block-local), and whether value flows one direction. **Tier
  leaks** surface as findings: an **up-tier** reference (a component consumed as
  a base value) or a **skip** past the semantic tier are `convention`; a
  **circular** `var()` chain is `universal`.
- **Scope & cascade** — where each token lives in the cascade (an unconditional
  `:root` **root** base, a conditional **theme** variant, or a **component**
  local), where values get **overridden**, and a static **theming** approximation
  (the mechanisms — `[data-theme]`, `@media prefers-color-scheme`, breakpoints —
  and a dominant style). **Cascade smells** surface as findings: a **shadowed**
  definition (same scope, differing value → an earlier value that can never win)
  is `universal`; a **stray override** (a global redefined inside a component,
  against a theming norm) is `convention`.
- **Coverage / hardcode** — over the declarations a token scheme typically
  governs (colour, spacing, borders, typography, motion), the share that consume
  a token via `var()` vs a raw literal, plus the properties most often literal.
  Coarse — a literal `0` counts as hardcoded — so read the ratio as a direction.
  A hardcoded literal whose value equals an existing token's surfaces as a
  **`literal-hardcode`** finding (`universal`) — a missed tokenization.
- **Fallback usage** — the `var(--x, fallback)` patterns catalogued by kind: a
  **token** fallback (a chained dependency), a **literal** default, or an
  explicit **empty** one. A catalogue, not a finding.
- **Near-duplicates** — clusters of tokens whose raw values are *nearly* (not
  exactly) the same, by colour distance or numeric proximity — the juiciest
  consolidation leads. Restricted to distinctive values (a colour, or a non-zero
  size-unit length) so coincidental `1fr`/`100%`/keyword matches don't fire. Each
  cluster surfaces as a **`near-duplicate`** finding (`universal`), its confidence
  tracking closeness.

## Bundled files

- `scripts/analyze.mjs` — parser + graph + fan-in/fan-out + findings → `audit.json`.
- `scripts/build_report.mjs` — renders `audit.json` → Markdown; refuses an incompatible schema major.
- `notes-template.md` — copied to `notes.md` by `init`.
- `REFERENCE.md` — the `audit.json` schema and versioning contract.

## Requirements

Needs `css-tree` (a repo dependency). Run `npm install` in the skills repo if the
script reports it can't find the module.
