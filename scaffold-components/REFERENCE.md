# scaffold-components reference

The judgement layer behind the scripts: the token vocabulary to fill stubs with,
the naming/cascade conventions the scripts can't enforce, the behaviour-vs-action
call, and how to enrich a generated skeleton into semantic, accessible markup.

**Always read the project's actual `src/css/tokens/*.css` first** — token _names_
and values vary per project. The families below are the canonical
eleventy-site-starter shape; treat them as the pattern to look for, not literal
guaranteed names.

## Token families → intent

A two-level system: **primitives** (raw values, no meaning) aliased by
**semantic** tokens (meaningful vocabulary). Blocks consume the semantic level.

| Intent | Token family | Notes |
| --- | --- | --- |
| Space: gap, padding, margin (fixed) | `--size-1 … --size-9` | 4px-based ramp, px→rem |
| Space: fluid ranges | `--space-3-4 … --space-7-11` | Utopia `clamp()` pairs |
| Colour | `--theme-bg`, `--theme-surface`, `--theme-text`, `--theme-muted`, `--theme-accent`, `--theme-border` | semantic aliases of `--clr-*`; never use raw `--clr-*`/hex in a block |
| Type (composite) | `--text-heading-xl/lg/md`, `--text-body-lead/body/body-sm` | `font:` shorthand — one declaration |
| Type (parts) | `--fs-100 … --fs-800`, `--ff-body/heading`, `--fw-normal/bold` | when a composite doesn't fit |
| Radius | `--radius-sm`, `--radius-md` | |
| Motion | `--trans-*` | respect `prefers-reduced-motion` |
| Layout primitives | `--content-width`, `--measure`, `--gutter-def`, `--flow-space` | often better expressed via a `u_*` utility |

Rules: **only `var(--token)` in blocks** — no raw values a token covers, and no
`utopia.clamp()` / `$size` inline (those are the token layer's job). Reach for the
composite `--text-*` shorthand before assembling `--fs-*` + `--ff-*` + `--fw-*`.

## Prefer utilities over re-declaring

The starter ships utilities — use them in the markup instead of re-implementing
their effect in a block: `u_flow` (owl vertical rhythm), `u_gutter` (inline
padding), `u_measure` (line-length cap), `u_list` (reset list), `u_srOnly`,
`u_blockLink`, `u_covMedia`/`u_resMedia`, `u_pseudo`. Check `src/css/utilities/`
for the set actually present.

## Naming & cascade conventions

- Block = `b_camelCase`; BEM element = `b_camelCase__element`; modifier =
  `b_camelCase--modifier`. All written as **full-class selectors**.
- `&__el` is invalid here — native CSS nesting has no string concatenation, so it
  parses as a type selector. Reserve `&` for states/attrs/media only: `&:hover`,
  `&:is(:hover, :focus-visible)`, `&[aria-current]`, `@media`.
- Behaviour / data-hook name = `kebab-case`. A behaviour anchors on
  `data-<name>="root"` and finds parts via `data-<name>="<part>"`.
- No `@layer`; cascade is source order: `reset → tokens → functions → global →
  blocks → utilities`. Blocks are flat-specificity, so block order is irrelevant.

## Behaviour vs action

Two JS unit shapes (both bootstrapped by `run(...)` in `app.js`):

- **`behaviour(name, init)`** — the default the scaffolder emits. Scans for
  `[data-<name>="root"]` and runs `init(root)` once. Use when a component needs an
  init pass: initial state, ARIA sync, focus management, observers. `init` may
  return a teardown fn — needed **only** for listeners/observers/timers on
  `document`/`window` (subtree-local listeners are GC'd with the node).
- **`action(name, handlers)`** — for purely event-driven components. One shared
  `document` listener routes `data-action="[event->]name#method"` hooks; no
  per-element scan, dynamic DOM works with no re-scan. The scaffolder **notes**
  `data-action` hooks but does not generate the action module — write it by hand
  when the logic is fully event-driven and state is readable from the DOM.

## Enriching markup (semantic + ARIA)

The forward scaffolder emits neutral `<div>`s — replace them:

- Use the right element: `<nav>`, `<ul>`/`<li>`, `<button type="button">` for
  controls, `<a>` for navigation, `<figure>`/`<img>` for media, headings for
  titles. Never a `<div>` where a semantic element exists.
- Disclosure/toggle patterns: the toggle is a `<button>` with `aria-expanded` (the
  single source of truth) and `aria-controls` pointing at the panel's `id`; the
  panel reflects state via `hidden`. Escape closes; focus returns to the toggle.
- Tabs, menus, dialogs: follow the matching ARIA Authoring Practices pattern.
- Current page/section: `aria-current="page"`. Icon-only controls need an
  `aria-label`. Decorative media: empty `alt`.
- Keep the `data-<name>` hooks intact while restructuring — they are the contract
  the CSS and JS join on. If you add or rename a hook, re-run the reverse tool to
  sync the stubs (it's idempotent).
