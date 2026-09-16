---
name: build-html-artifact
description: Render any documentation or captured knowledge — docs, notes, prototypes, transcripts — into a self-contained, styled HTML artifact with a consistent warm-stone look. Single page, side-nav page, or multi-page set.
disable-model-invocation: true
---

# build-html-artifact

Gives arbitrary content a consistent foundational look-and-feel. Guide-driven:
copy a **scaffold**, write plain semantic HTML into it. The scaffold carries the
tokens, base element styling, a small set of patterns, the layout shell, and the
nav JS — so plain HTML inherits the look without per-piece styling.

This is a foundation, not a component library. Style comes from styled base
elements, a short list of patterns, and a layout shell — not from bespoke
per-document CSS.

## Design philosophy

- **Self-contained.** One HTML file, all CSS and JS inline. No external
  dependencies, no build step — must work opened straight from disk. System font
  stacks only: no webfonts.
- **Token-system only.** Every colour, radius, and shadow comes from a token in
  the scaffold's `:root`. No hardcoded values in body markup.
- **Three typefaces, three jobs.** Display sans for headings, serif for body,
  mono for labels and metadata. That contrast is what makes a page read as a
  document rather than a README.
- **One measure.** The column width lives on the container. Never put a
  `max-width` on an individual element — see [REFERENCE.md](REFERENCE.md).
- **Dark code, light page, always.** Never invert.
- **Plain HTML, styled by the shell.** Write semantic markup; let the scaffold
  style it. If the content has structure, reach for a pattern before inventing
  markup — and never add a per-page CSS block.

## Workflow

### 1. Pick the layout
- **Single page** (`page-template.html`) — the default. One self-contained page
  with a masthead. Use it for anything read start to finish.
- **Side-nav page** (`page-nav-template.html`) — the same page plus a sidebar of
  section links with scroll-spy. Use it when the reader needs to jump around
  rather than read through: roughly 8+ sections, or reference-shaped content.
- **Multi-page set** — one `index.html` landing page plus one content page per
  topic, in one folder.

*Done when:* you know which scaffold(s) to copy.

### 2. Copy the scaffold
Copy the chosen scaffold from `assets/` into the output folder, one per page.
Fill the `{{...}}` placeholders. The masthead's brand row is optional — paste the
client's mark inline on the left, `assets/brand-good.svg` on the right, or delete
the row.

*Done when:* every placeholder is replaced and the `<head>` token/CSS/JS block is
untouched apart from the accent (below).

### 2a. Set the brand accent
Ask which brand the document belongs to, or take it from the context. Then change
**one line** in the scaffold's `:root`:

```css
--c-accent:           #3341c2;   /* ← the client's colour */
```

Everything tinted follows it: links, the section rules, the eyebrow, step
numerals, the note callout, the active nav item. Don't touch `--c-accent-ink`,
`--c-accent-soft` or `--c-accent-line` — they're derived with `color-mix()`.

The colour must clear **4.5:1 against `--c-bg` (`#fafaf9`)**. Most brand colours
do; a bright or pastel one won't, and the fix is to darken it for this use rather
than to loosen the rule. Pre-checked: `#3341c2` blue (default), `#0f766e` teal,
`#a21caf` magenta, `#166534` forest, `#b91c1c` red, `#1f2937` near-black.

*Done when:* `--c-accent` is the brand colour and the derived three are untouched.

### 3. Write the content
Write plain semantic HTML into the content area — the base elements are styled
for you, and the patterns cover the structure prose can't carry (see
[REFERENCE.md](REFERENCE.md)). Derive structure from the source content itself;
don't impose a fixed shape. For a side-nav page, add one nav link per major
section.

*Done when (exhaustive):* all of the source content is present, and every nav
link's `data-target` resolves to a real section `id` — no orphan links, no
dropped content. For a set, every page has an `index.html` entry and every entry
links to a real file.

### 4. Verify
Open each file in a browser. *Done when:*

- no network requests fire;
- the page contains **no `<style>` block outside `<head>` and no `max-width`
  override in the body** — if you needed either, you reached past the system, so
  fix the scaffold rather than the page;
- the side nav (scroll-spy + mobile toggle) works, if the page has one.

## Output location

Default to a `docs/` folder in the current project unless the user says
otherwise. A multi-page set gets its own subfolder.

## Quality rules (prose)

1. **Plain and literal.** Write for a smart non-specialist; no metaphors or
   flourishes.
2. **Define the jargon.** Gloss any technical term or acronym the first time it
   appears.

## Reference

- [REFERENCE.md](REFERENCE.md) — tokens, styled base elements, the patterns,
  layouts, the nav JS.
- `assets/page-template.html`, `assets/page-nav-template.html`,
  `assets/index-template.html` — the scaffolds.
- `assets/brand-good.svg` — the Good mark, for the masthead brand row.
