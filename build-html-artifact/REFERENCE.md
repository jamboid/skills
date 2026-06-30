# Design system reference

A foundational warm-stone look — tokens, styled base HTML elements, and a layout
shell. Not a component library: you write plain semantic HTML and it inherits the
look. Two scaffolds carry the system and are its **single source of truth**:
`assets/page-template.html` (content page, optional side nav) and
`assets/index-template.html` (landing page that links to others). Copy a
scaffold; never paste a second copy of the tokens into a page.

---

## Tokens

The `:root` block lives in each scaffold. Never hardcode a colour, radius, or
shadow in body markup — reach for these:

| Token | Use for |
|---|---|
| `--c-bg` | page background (warm stone) |
| `--c-surface` / `--c-surface-alt` | raised surfaces; alt for table headers, inline code |
| `--c-text` / `--c-text-muted` / `--c-text-faint` | body / secondary / faint text |
| `--c-border` / `--c-border-strong` | hairlines / hover + structural lines |
| `--c-accent` / `--c-accent-soft` | links, active nav, emphasis |
| `--c-good` / `--c-warn` / `--c-bad` (+ `-soft`) | status accents, when you need them |
| `--c-code-bg` / `--c-code-text` | dark code blocks (always dark) |
| `--radius` / `--radius-lg`, `--shadow-sm`/`-md`, `--sidebar-w`, `--content-max` | shape / layout |
| `--font-sans` / `--font-mono` | type |

If a context needs a one-off element the base styles don't cover, build it from
these tokens so it stays in family — don't introduce new raw values.

---

## Styled base elements

In `page-template.html`, anything you write inside `.content-inner` is styled
automatically — no classes needed:

`h1`–`h4`, `p`, `ul`/`ol`/`li` (nested), `a`, `strong`, `em`, `hr`, `img`,
`blockquote`, `code` (inline, on a stone chip), `pre`/`pre code` (dark block,
always), and `table`/`th`/`td` (bordered, stone header). Body columns cap at
70ch for readability.

This is the point of the system: throw plain HTML (or rendered markdown) at it
and it looks consistent across docs, notes, prototypes, and transcripts.

Optional helpers if you want them: `.page-header` + `.page-eyebrow` + `.lede` for
a titled opener; the `<footer>` is pre-placed.

---

## Layouts

### Content page with side nav (default)
`page-template.html`. Fill the sidebar header (`{{PROJECT}}` / `{{TITLE}}` /
`{{DATE}}`) and `{{SIDEBAR_NAV}}`, write the body into `{{CONTENT}}`. One nav
link per major section:

```html
<a href="#setup" data-target="setup">Setup</a>
```

`data-target` **must** equal the section's `id` — that drives scroll-spy. Group
links with `<div class="nav-label">Group</div>`. The sidebar collapses to an
off-canvas drawer (toggle + overlay) below 900px automatically.

### Plain single page (no nav)
Same scaffold: delete the `<aside>`, the `<button class="mob-toggle">`, and the
`.sidebar-overlay`, then add `class="no-sidebar"` to `<body>`. Content centres
in the same column.

### Landing page (multi-page set)
`index-template.html`. A **set** is one `index.html` plus one content page per
topic in the same folder. Fill `{{LINKS}}` with one entry per page:

```html
<a href="detail-slug.html"><h2>Page title</h2><p>One-line description.</p></a>
```

Each linked page is a `page-template.html` (give it its own back-link to
`index.html` if you want one — a plain `<a href="index.html">`).

---

## JS (in `page-template.html`, do not duplicate)

A single small script: the mobile sidebar toggle/overlay and an
`IntersectionObserver` scroll-spy that marks the active nav link. It no-ops when
there's no sidebar or no `data-target` links. `index-template.html` needs no JS.

---

## Rules

- **Self-contained.** All CSS and JS stay inline. No CDN, no external fonts, no
  build step — must work opened straight from disk.
- **Token-only.** Every colour, radius, and shadow from a token.
- **Dark code, light page, always.** Never invert.
