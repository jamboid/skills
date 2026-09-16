# Design system reference

A foundational warm-stone look — tokens, styled base HTML elements, a small set
of patterns, and a layout shell. Not a component library: you write plain
semantic HTML and it inherits the look. Three scaffolds carry the system and are
its **single source of truth**:

| Scaffold | Layout |
|---|---|
| `assets/page-template.html` | single column, masthead, no nav — the default |
| `assets/page-nav-template.html` | the same plus sidebar + scroll-spy |
| `assets/index-template.html` | landing page that links to the others |

Copy a scaffold; never paste a second copy of the tokens into a page. The shared
CSS is copied into all three by hand and held in sync by
`test/build-html-artifact/scaffold-parity.test.mjs` — if you change the tokens or
the base block, change them in every scaffold and run `npm test`.

---

## Tokens

The `:root` block lives in each scaffold, between the `/* == tokens:start == */`
markers. Never hardcode a colour, radius, or shadow in body markup — reach for
these:

| Token | Use for |
|---|---|
| `--c-bg` | page background (warm stone) |
| `--c-surface` / `--c-surface-alt` | raised surfaces; alt for table headers, inline code |
| `--c-text` / `--c-text-muted` / `--c-text-faint` | body / secondary / faint text |
| `--c-border` / `--c-border-strong` | hairlines / hover + structural lines |
| `--c-accent` | **the one brand knob** — links, eyebrow, bands, active nav |
| `--c-accent-ink` / `--c-accent-soft` / `--c-accent-line` | derived from it: text on a tint / tinted fill / section rule |
| `--c-good` / `--c-warn` / `--c-bad` (+ `-soft`) | callout variants, status accents |
| `--c-code-bg` / `--c-code-text` / `--c-code-border` | dark code blocks (always dark) |
| `--c-sidebar-*` | sidebar surfaces and active state |
| `--radius`, `--shadow-sm`/`-md`, `--sidebar-w`, `--content-max` | shape / layout |

There is one radius (6px) for every rounded thing on the page — boxes, code
chips, images, the sidebar toggle. Don't add a second one.
| `--font-display` / `--font-body` / `--font-mono` | type (see below) |

If a context needs a one-off element the base styles don't cover, build it from
these tokens so it stays in family — don't introduce new raw values.

### Accent

`--c-accent` is the only colour that changes per brand. The other three are
derived from it with `color-mix()` and must never be set by hand:

```css
--c-accent:      #3341c2;                                         /* set this */
--c-accent-ink:  color-mix(in srgb, var(--c-accent) 85%, black);
--c-accent-soft: color-mix(in srgb, var(--c-accent) 12%, var(--c-bg));
--c-accent-line: color-mix(in srgb, var(--c-accent) 25%, var(--c-bg));
```

Text on a tinted fill uses `--c-accent-ink`, not `--c-accent` — the raw accent
falls below 4.5:1 on its own 12% tint for mid-light hues (teal, orange, bright
blue all fail; the darkened ink clears 5.4:1 at worst). So: `--c-accent` for
anything on the page background, `--c-accent-ink` for anything on
`--c-accent-soft`.

`--c-accent` itself must clear 4.5:1 on `--c-bg`. `color-mix()` needs a browser
from 2023 or later, which is also when `text-wrap: balance` landed, so the
scaffolds already assume that baseline.

### Type

Three families, three jobs. All system stacks — nothing is downloaded.

- `--font-display` — headings, ledes, tables, figcaptions, key-fact values.
- `--font-body` — body prose (serif). This is what makes a page read as a
  document rather than a README.
- `--font-mono` — eyebrows, metadata, labels, table headers, step numerals,
  footers, inline and block code.

`--font-sans` is kept as an alias of `--font-display` so older pages don't break.

---

## The measure rule

**The column width lives on the container, never on individual elements.**

`max-width: 70ch` on every child looks right and is not: `ch` resolves against
each element's *own* font-size, so a 26px `h2` and a 17px `p` get different
widths and the page ends up with several ragged right edges. The scaffolds set
one `--content-max` on the container and let everything inherit it.

So: tables, figures and diagrams simply fill the column. If you find yourself
writing `max-width` in the body, stop — the answer is a change to the scaffold,
not to the page.

---

## Styled base elements

Anything you write in the content area is styled automatically — no classes
needed:

`h1`–`h4`, `p`, `ul`/`ol`/`li` (nested), `a`, `strong`, `em`, `hr`, `img`,
`blockquote`, `code` (inline, on a stone chip), `pre`/`pre code` (dark block,
always), `table`/`th`/`td` (bordered, stone header), and
`figure`/`figcaption`.

`h2` is preceded by a full-width 3px rule in pale blue (`--c-accent-line`) that
separates one section from the next. The first `h2` on a page drops it, since the
masthead already closes with a rule. Every heading level uses
`text-wrap: balance`.

This is the point of the system: throw plain HTML (or rendered markdown) at it
and it looks consistent across docs, notes, prototypes, and transcripts.

---

## Patterns

Six patterns, for structure that prose can't carry. Reach for one before
inventing markup — and never in place of a plain paragraph that would do.

### `.masthead`
The document opener, pre-placed in both page scaffolds: an optional `.brand` row
(client mark left, `assets/brand-good.svg` right — delete the row if unbranded),
`.page-eyebrow`, `h1`, `.lede`, and a `.meta` list of mono facts.

```html
<ul class="meta">
  <li><strong>Jamie Boyd</strong></li><li>15 Sep 2026</li><li>Draft</li>
</ul>
```

### `.callout`
A note that needs to sit apart from the prose. Variants: `--note` (accent, blue),
`--good` (green), `--warn` (amber), `--bad` (red); with no variant it's a plain
stone box. The label is optional. Each variant is a saturated tint with a label
in the strong colour — every label/tint pair clears 4.5:1, so don't lighten a
`--c-*` colour or deepen its `-soft` tint without re-checking.

The left colour band is a positioned `::before`, not a `border-left`, and the box
is `overflow: hidden` with a radius on all four corners. The radius therefore
slices the band instead of bending it round the curve, the way a real border
would. The band's width is `var(--radius)`, matching the box's corner radius, so
it fills the corner and reaches the top and bottom of the box. Change one and
change the other, or the band goes back to stopping short of the corner.

```html
<div class="callout callout--warn">
  <span class="callout-label">Order matters</span>
  <p>The CMS change must go live before the site change.</p>
</div>
```

### `.keyfact`
A label, a value worth seeing at a glance, and an optional note.

```html
<p class="keyfact">
  <span class="keyfact-label">Estimated timescale</span>
  <span class="keyfact-value">3–4 hours per component</span>
  <span class="keyfact-note">Including testing, review and handover.</span>
</p>
```

### `.deflist`
Term and description, side by side from 720px up, stacked below. A real `<dl>`,
one `<div>` per row.

```html
<dl class="deflist">
  <div><dt>Access to open merge requests</dt><dd><p>Reporter access can't…</p></dd></div>
</dl>
```

### `.steps`
A numbered sequence where the order is the point. Numerals come from a CSS
counter — don't write them into the markup.

```html
<ol class="steps">
  <li><h3>Prototype</h3><p>…</p></li>
</ol>
```

### `figure`
Diagrams and captioned media. The figure is a white box that lifts the diagram
off the page; the `figcaption` is its own strip, flush to the bottom of that box.
Put inline SVG straight inside — it fills the box and scales. Style the SVG with
`var(--token)` values so it follows the palette. One SVG that works at every
width: no media queries, no per-page CSS block.

```html
<figure>
  <svg viewBox="0 0 640 656" width="100%" role="img" aria-label="…">…</svg>
  <figcaption>What the diagram shows.</figcaption>
</figure>
```

---

## Layouts

### Single page (default)
`page-template.html`. Fill the masthead placeholders and write the body into
`{{CONTENT}}`. Nothing to delete.

### Content page with side nav
`page-nav-template.html`. Also fill the sidebar header (`{{PROJECT}}` /
`{{TITLE}}` / `{{DATE}}`) and `{{SIDEBAR_NAV}}`. One nav link per major section:

```html
<a href="#setup" data-target="setup">Setup</a>
```

`data-target` **must** equal the section's `id` — that drives scroll-spy. Group
links with `<div class="nav-label">Group</div>`. The sidebar collapses to an
off-canvas drawer (toggle + overlay) below 900px automatically.

### Landing page (multi-page set)
`index-template.html`. A **set** is one `index.html` plus one content page per
topic in the same folder. Fill `{{LINKS}}` with one entry per page:

```html
<a href="detail-slug.html"><h2>Page title</h2><p>One-line description.</p></a>
```

Each linked page is a page scaffold (give it its own back-link to `index.html` if
you want one — a plain `<a href="index.html">`).

---

## JS (in `page-nav-template.html`, do not duplicate)

A single small script: the mobile sidebar toggle/overlay and an
`IntersectionObserver` scroll-spy that marks the active nav link. It no-ops when
there's no sidebar or no `data-target` links. The other two scaffolds need no JS.

---

## Rules

- **Self-contained.** All CSS and JS stay inline, in one `<head>` block. No CDN,
  no external fonts, no build step — must work opened straight from disk.
- **Token-only.** Every colour, radius, and shadow from a token.
- **One measure**, on the container.
- **Dark code, light page, always.** Never invert.
