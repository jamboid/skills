---
name: build-html-artifact
description: Render any documentation or captured knowledge — docs, notes, prototypes, transcripts — into a self-contained, styled HTML artifact with a consistent warm-stone look. Single page, side-nav page, or multi-page set.
disable-model-invocation: true
---

# build-html-artifact

Gives arbitrary content a consistent foundational look-and-feel. Guide-driven:
copy a **scaffold**, write plain semantic HTML into it. The scaffold carries the
tokens, base element styling, layout shell, and nav JS — so plain HTML inherits
the look without per-piece styling.

This is a foundation, not a component library. Style comes from styled base
elements and a layout shell, not from bespoke components — keep markup plain so
it works across docs, notes, prototypes, and transcripts alike.

## Design philosophy

- **Self-contained.** One HTML file, all CSS and JS inline. No external
  dependencies, no build step — must work opened straight from disk.
- **Token-system only.** Every colour, radius, and shadow comes from a token in
  the scaffold's `:root`. No hardcoded values in body markup.
- **Dark code, light page, always.** Never invert.
- **Plain HTML, styled by the shell.** Write semantic markup; let the scaffold
  style it. Reach for a one-off element only when base styles don't cover it, and
  build it from tokens.

## Workflow

### 1. Pick the layout
- **Single page** — one self-contained page, with or without the side nav.
- **Side-nav page** — sidebar of section links with scroll-spy (the default).
- **Multi-page set** — one `index.html` landing page plus one content page per
  topic, in one folder.

*Done when:* you know which scaffold(s) to copy.

### 2. Copy the scaffold
Copy `assets/page-template.html` (content page) or `assets/index-template.html`
(landing) into the output folder, one per page. Fill the `{{...}}` placeholders.
*Done when:* every placeholder is replaced and the `<head>` token/CSS/JS block is
untouched.

### 3. Write the content
Write plain semantic HTML into the content area — the base elements are styled
for you (see [REFERENCE.md](REFERENCE.md)). Derive structure from the source
content itself; don't impose a fixed shape. For a side-nav page, add one nav link
per major section.

*Done when (exhaustive):* all of the source content is present, and every nav
link's `data-target` resolves to a real section `id` — no orphan links, no
dropped content. For a set, every page has an `index.html` entry and every entry
links to a real file.

### 4. Verify self-containment
Open each file in a browser. *Done when:* no network requests fire, and the side
nav (scroll-spy + mobile toggle) works.

## Output location

Default to a `docs/` folder in the current project unless the user says
otherwise. A multi-page set gets its own subfolder.

## Quality rules (prose)

1. **Plain and literal.** Write for a smart non-specialist; no metaphors or
   flourishes.
2. **Define the jargon.** Gloss any technical term or acronym the first time it
   appears.

## Reference

- [REFERENCE.md](REFERENCE.md) — tokens, styled base elements, layouts, the nav JS.
- `assets/page-template.html`, `assets/index-template.html` — the scaffolds.
