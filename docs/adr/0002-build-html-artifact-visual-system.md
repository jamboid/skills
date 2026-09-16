# 2. build-html-artifact — type split, one measure, and a small pattern set

Status: accepted (2026-09-16)

## Context

Two renderings of the same source document were compared side by side: one built
with `build-html-artifact`, one written from scratch by a model with no skill
loaded. The hand-made one looked better, and the reasons were systemic rather
than matters of craft.

1. **One typeface did every job.** The scaffolds used `system-ui` for headings,
   body, labels and metadata alike. The hand-made page split display sans / serif
   body / mono metadata, and read as a document rather than a README.
2. **The measure was broken.** `.content-inner > * { max-width: 70ch }` resolves
   `ch` against each child's *own* font-size, so a 23px `h2` capped near 800px
   (clamped to the column) while a 16px `p` capped near 560px. Paragraphs stopped
   ~180px short of the underline above them, and `h3`/`h4`/`li` each landed
   somewhere else — several ragged right edges down one page.
3. **Colour was declared but never spent.** Seven warm greys, an accent used only
   for links, and `--c-good/warn/bad(-soft)` that no base style referenced.
4. **Structure flattened.** With only `h1`–`h4`/`p`/`ul` available, content that
   had estimates, warnings, numbered steps and definition rows was rendered as
   flat prose — "Estimated timescale" became an `<h4>` plus a paragraph. Where
   flattening was impossible (a process diagram), the page injected its own
   `<style>` block mid-body.

Cause 4 is the interesting one: the skill's stated philosophy was "styled base
elements, not a component library". That is right for arbitrary dumped markdown
and wrong for the documents the skill is actually used for, which have structure
the base elements cannot express.

## Decision

**Keep the foundation, but give it three typefaces, one measure, and six
patterns.**

- **Type split.** `--font-display` (headings), `--font-body` (serif prose),
  `--font-mono` (labels, metadata, code). System stacks only — the
  self-containment rule stands, so no webfonts. Body rises to 17px/1.6.
- **One measure, on the container.** The per-child `max-width` is deleted; the
  column width lives on `--content-max`. Tables, figures and diagrams fill the
  column. A `max-width` in body markup is now a defect, not an escape hatch — no
  `.wide`/`.bleed` helper is provided, deliberately, so the pressure lands on the
  scaffold instead of on each page.
- **Colour gets a job.** The accent numbers each step and tints the eyebrow; the
  status tokens become the visible tint on callout variants. Sections are marked
  by a pale chip hanging in the margin beside each `h2` (`--c-accent-pale`), not
  by a rule. Three rule treatments were tried and rejected — a short accent bar
  above the heading (too styled), a grey hairline (too weak), a full-width 3px
  pale-blue rule (a horizontal line at every section is too insistent when it
  repeats a dozen times).
- **Six patterns:** `.masthead`, `.callout`, `.keyfact`, `.deflist`, `.steps`,
  and styled `figure`/`figcaption`. This is a deliberate, bounded reversal of
  "not a component library" — bounded because the test of a seventh pattern is
  whether a real document had to reach past the system without it.
- **Side-nav becomes opt-in.** Three scaffolds (`page-template.html`,
  `page-nav-template.html`, `index-template.html`) rather than one scaffold with
  a documented deletion procedure. The common case should not be the harder one.

## Consequences

- Three scaffolds now carry copies of the same token and base CSS. They must each
  stand alone on disk, so this is **copy + guard, not a build step** — the same
  policy as the css-token schema (ADR 1). The guard is
  `test/build-html-artifact/scaffold-parity.test.mjs`, which asserts byte-identical
  shared blocks, that no scaffold uses a `--c-*` token it doesn't define, that no
  colour is hardcoded outside `:root`, and that nothing reaches the network.
- Pages built before this change still render: `--font-sans` is kept as an alias
  of `--font-display`.
- Dark mode was considered and **not** adopted. The existing "dark code, light
  page, always" rule stands.
- Verified by rebuilding the source markdown of the compared document through the
  new scaffolds: it now carries no per-page `<style>` block and no `max-width`
  override.
