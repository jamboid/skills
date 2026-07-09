---
name: scaffold-components
description: Scaffold and style components in an eleventy-site-starter–convention project (BEM-ish `b_` blocks, `data-` hook behaviours, a two-level design-token layer). Bundles the deterministic scaffolder scripts and adds the judgement layer they leave as TODO — enriching skeleton markup with semantic elements + ARIA, and filling generated CSS stubs with the project's `var(--token)` values. Use when creating a new component, adding classes/hooks to a template and needing matching CSS/JS stubs, filling stub selectors with design tokens, or porting a component to Drupal Twig.
---

# Scaffold Components

Two scripts do the deterministic work — naming, file creation, idempotent merge,
manifest wiring. **You do the judgement they leave as `TODO`:** semantic markup +
ARIA, and picking the right `var(--token)` for each declaration. Never hand-write
the block/behaviour boilerplate the scripts generate; never leave a stub as raw
values a token already covers.

## Read the project first

Before styling anything, read the project's own conventions — don't assume:

- `src/css/tokens/*.css` — the actual token vocabulary (names vary per project).
- One existing `src/css/blocks/b_*.css` — the block/BEM style in use.
- `src/js/behaviours/*.js` + `src/js/core/` — the behaviour shape.
- `CONTEXT.md` / `docs/adr/` if present — the decisions behind the structure.

See [REFERENCE.md](REFERENCE.md) for the token families, BEM rules, and the
behaviour-vs-action decision.

## Invocation

Run from the **project root** (in theme-pipeline mode that's the theme's
`assets/`). Prefer the project's npm scripts if it has them; otherwise call the
bundled copies directly:

```sh
npm run scaffold:component -- <args>     # if package.json defines it
npm run scaffold:markup   -- <args>
# else, bundled:
node <skill-dir>/scripts/new-component.mjs <args>
node <skill-dir>/scripts/scaffold-from-markup.mjs <args>
```

Both take `--dry-run` (preview) and `--no-wire` (skip manifest edits). **Always
`--dry-run` first** and show the plan before writing.

## Forward — new component from a spec

1. **Clarify the shape** with the user: name; is it interactive (JS behaviour) or
   a static visual block; its elements (styled parts) and its hook parts
   (interactive parts that JS targets).
2. **Generate** (static by default; `--part`/`--behaviour` makes it interactive):
   ```sh
   node scripts/new-component.mjs accordion --el title,item --part trigger,panel
   ```
   Writes an `.njk` (Eleventy) or `.html.twig` (theme-pipeline) skeleton, the
   block CSS, a behaviour stub, and wires the manifests.
3. **Enrich the markup** — replace the neutral `<div>`s with semantic elements,
   add ARIA and sensible nesting (see REFERENCE.md § Enriching markup).
4. **Re-sync** if enriching added/renamed hooks — the reverse tool is idempotent:
   ```sh
   node scripts/scaffold-from-markup.mjs <path-to-markup>
   ```
5. **Fill the stubs** (below).

## Reverse — stubs from existing markup

Already have (or just wrote) a template? Derive the CSS/JS from it:

```sh
node scripts/scaffold-from-markup.mjs eleventy/_includes/components/foo.njk
```

Idempotent + additive: re-run after adding a class/hook and only the missing
selectors are appended. Then fill the stubs.

## Fill the stubs (the judgement step)

For each `/* TODO */` in the generated block CSS, write real declarations using
**only `var(--token)`** — never raw values a token covers, never
`utopia.clamp()`/`$size` inline (that lives in the token layer). Map intent to
the project's token families (details + names in REFERENCE.md):

- spacing / gap / padding → `--size-*` (fixed) or `--space-*` (fluid)
- colour → semantic `--theme-*` aliases, not raw hues
- type → composite `--text-*` shorthands (or `--fs-*` / `--ff-*` / `--fw-*`)
- radius / motion / layout → `--radius-*` / `--trans-*` / `--measure` etc.

Prefer an existing `u_*` utility (flow, gutter, measure, list…) over re-declaring
its job in a block. For interactive components, implement the behaviour JS: query
the `data-` part hooks, drive state from ARIA attributes, add teardown only for
document/window listeners.

## Guardrails

- Blocks read design decisions **only** as `var(--token)`.
- BEM elements are **full-class selectors** (`.b_x__el`), never `&__el`. Reserve
  `&` for states/attrs/media (`&:hover`, `&[aria-*]`, `@media`).
- The class names + `data-` hooks are the **portability contract** — markup ports
  to Twig unchanged. Keep them stable.
- Verify before finishing: `npm run lint` and a build if available.
