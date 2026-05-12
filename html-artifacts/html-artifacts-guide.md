# HTML Artifact Style Guide

Rules for generating editorial code-documentation HTML. Written for Claude. General-purpose — applies to any project, not just jbdn.

Canonical reference files (jbdn):
- Detail page: `docs/patterns/HTML/dependency-injection.html`
- Index/landing page: `docs/patterns/HTML/index.html`
- Tabs + comparison table: `docs/patterns/HTML/sse-streaming.html`

---

## Design philosophy

- **Editorial, not app UI.** Serif headings signal reading material. The page feels like a well-typeset technical article, not a dashboard or product.
- **Dark code, light page. Always.** Code blocks are always dark (`#16181d` background). The surrounding page surface is always light. Never invert this, never mix tone within a code block.
- **Token system only.** Every colour, radius, and shadow value comes from a CSS custom property. No hardcoded values in component rules.
- **No external dependencies.** All CSS and JS is inline in the HTML file. No frameworks, no CDN links.

---

## Design tokens

Copy this `:root` block verbatim into every artifact. Omit `--warn`, `--purple`, `--orange` and their `-soft` variants unless the page is an index/landing with categorised cards.

```css
:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  --surface-alt: #f4f4f2;
  --border: #e5e4e0;
  --border-strong: #d4d2cc;
  --text: #1a1a18;
  --text-muted: #5a5a55;
  --text-faint: #8a8a82;
  --accent: #3a5cff;
  --accent-soft: #eaf0ff;
  --good: #1f7a3a;
  --good-soft: #e7f5ec;
  --bad: #b1432a;
  --bad-soft: #fbece5;
  /* index pages only: */
  --warn: #b27800;        --warn-soft: #fff5e1;
  --purple: #7c3aed;      --purple-soft: #f3e8ff;
  --orange: #c84a1f;      --orange-soft: #fbece5;
  /* code syntax */
  --code-bg: #16181d;
  --code-fg: #e5e5e0;
  --code-comment: #7e8aa1;
  --code-string: #c5d99d;
  --code-keyword: #c697e6;
  --code-fn: #8ec7ff;
  --code-num: #f5a97f;
  /* shape */
  --radius: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 2px rgba(20,20,18,.04);
  --shadow-md: 0 4px 14px rgba(20,20,18,.06);
  --shadow-lg: 0 10px 30px rgba(20,20,18,.08);  /* index pages only */
  /* type */
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
}
```

---

## Page types

### Detail page (article/pattern doc)

Use for any single-topic documentation page generated from a markdown source.

**Layout:** 2-column grid — sticky 260px TOC sidebar + fluid content area.

```css
.page {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  max-width: 1200px;
  margin: 0 auto;
  gap: 48px;
  padding: 48px 32px;
}
```

**HTML skeleton:**
```html
<div class="page">
  <aside class="toc">…</aside>
  <main>
    <a class="back-link" href="index.html">…</a>
    <header class="hero">…</header>
    <section id="…">…</section>
    …
    <footer>…</footer>
  </main>
</div>
```

**Content structure:** Derive sections directly from the source markdown headings — their number, order, and titles. Do not impose a fixed order. The fixed chrome is: back-link → hero → sections from markdown → footer. Each markdown `##` heading becomes a `<section id="slug">` with `scroll-margin-top: 24px`. The TOC entries are generated from those same section IDs.

**Collapses** to single column at ≤900px; TOC becomes `position: static`.

---

### Index / landing page

Use for a page that lists and links to multiple detail pages.

**Layout:** Single column, narrower max-width.

```css
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 64px 32px 80px;
}
```

**HTML skeleton:**
```html
<div class="page">
  <header class="hero">…</header>
  <div class="intro">…</div>
  <p class="section-eyebrow">Index</p>
  <h2>…</h2>
  <div class="patterns">
    <a class="pattern [type]" href="…">…</a>
    …
  </div>
  <footer>…</footer>
</div>
```

No TOC, no back-link.

---

## Typography

| Element | Family | Size | Weight | Notes |
|---|---|---|---|---|
| h1 | serif | 44px (detail) / 52px (index) | 600 | letter-spacing −0.01em / −0.015em |
| h2 | serif | 28px (detail) / 30px (index) | 600 | border-bottom, letter-spacing −0.005em |
| h3 | sans | 16px | 600 | serif 20–22px inside cards only |
| body | sans | 16px | 400 | line-height 1.6 |
| `<pre>` | mono | 13px | 400 | line-height 1.65 |
| `.lede` | sans | 19–20px | 400 | color: text-muted, max-width 62–64ch |
| `<p>` | — | — | — | max-width 70ch |
| inline `<code>` | mono | 0.88em | — | surface-alt bg, border, 4px radius, 1px 6px padding |

---

## Component catalog

### Hero

Use on every page. Synthesise from the markdown title and opening paragraph.

```html
<header class="hero">
  <span class="eyebrow">Pattern</span>
  <h1>Page Title</h1>
  <p class="lede">One or two sentences. What this is and why it matters.</p>
  <div class="meta">
    <span class="chip">Label&nbsp;·&nbsp;Value</span>
    <span class="chip">Entry point&nbsp;·&nbsp;<code>functionName()</code></span>
  </div>
</header>
```

- Eyebrow: accent bg pill, 12px, uppercase, letter-spacing 0.1em
- `.chip`: surface bg, border, round, 13px; use `·` (middle dot) as separator

---

### Back link

Detail pages only. Place inside `<main>`, before `<header class="hero">`.

```html
<a class="back-link" href="index.html"><span class="arrow">←</span> All patterns</a>
```

- `display: inline-flex`, 13px, text-muted; hover: accent colour + accent-soft bg
- Arrow animates `translateX(-2px)` on hover

---

### TOC

Detail pages only. Sections and IDs are derived from the markdown headings.

```html
<aside class="toc">
  <p class="toc-eyebrow">On this page</p>
  <ol>
    <li><a href="#section-id">Section title</a></li>
  </ol>
</aside>
```

- Use `<ol>`, not `<ul>`
- Active link: `background: accent-soft; color: accent; border-left-color: accent`
- JS: `IntersectionObserver` with `rootMargin: '-10% 0px -80% 0px'`; toggle `.active` class on the matching `<a>`

---

### Code block

All code blocks are dark. No exceptions.

```html
<div class="code">
  <div class="code-header">
    <span><span class="dot"></span><span class="dot"></span><span class="dot"></span>&nbsp;&nbsp;filename.js</span>
    <button class="copy-btn" data-copy-target="pre-id">Copy</button>
  </div>
  <pre id="pre-id">…syntax-highlighted code…</pre>
</div>
```

- `.code-header` bg: `rgba(255,255,255,.04)`; border-bottom: `rgba(255,255,255,.06)`
- Three `.dot` elements (8px circles, `#4a5060`) before the filename label
- Copy button: transparent bg, `rgba(255,255,255,.1)` border; `.copied` state: green text + border
- `data-copy-target` must match the `id` on the `<pre>`

**Syntax token classes** (apply as `<span>` wrappers inside `<pre>`):

| Class | Colour | Use for |
|---|---|---|
| `.tk-kw` | `--code-keyword` (purple) | keywords: `async`, `function`, `const`, `return`, `await` |
| `.tk-fn` | `--code-fn` (blue) | function names, template literal expressions |
| `.tk-str` | `--code-string` (green) | string literals, template literal text |
| `.tk-cmt` | `--code-comment` (grey italic) | comments |
| `.tk-num` | `--code-num` (orange) | numeric literals |

---

### Tabs

Use inside a `.code` block when showing two or more related files together. Do not use tabs for unrelated content.

```html
<div class="code">
  <div class="tabs">
    <button class="tab-btn active" data-tab="tab-a">fileA.js</button>
    <button class="tab-btn" data-tab="tab-b">fileB.js</button>
  </div>
  <div class="tab-panel active" id="tab-a"><pre>…</pre></div>
  <div class="tab-panel" id="tab-b"><pre>…</pre></div>
</div>
```

```css
.tabs { display: flex; gap: 2px; padding: 8px 12px 0; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.06); }
.tab-btn { padding: 5px 12px; font-size: 12px; font-family: var(--mono); border: 1px solid transparent; border-bottom: none; border-radius: 4px 4px 0 0; background: none; color: #7e8aa1; cursor: pointer; }
.tab-btn.active { background: rgba(255,255,255,.08); color: var(--code-fg); border-color: rgba(255,255,255,.1); }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
```

JS: on click, toggle `.active` on the button and the matching `.tab-panel`.

---

### Compare grid

Use for before/after or option A/option B code comparisons.

```html
<div class="compare-grid">
  <div>
    <div class="compare-label bad"><span class="dot"></span>Label for bad example</div>
    <div class="code">…</div>
  </div>
  <div>
    <div class="compare-label good"><span class="dot"></span>Label for good example</div>
    <div class="code">…</div>
  </div>
</div>
```

- `.compare-label`: 12px, uppercase, letter-spacing 0.08em; `.bad` = bad colour, `.good` = good colour
- `.dot`: 7px circle, `background: currentColor`
- Code blocks inside: `margin: 0`
- Collapses to single column at ≤700px

---

### Callout

Use for a single key insight, constraint, or nuance. Not for multi-point content.

```html
<div class="callout">
  <p>Key point here.</p>
</div>
```

- `background: surface; border-left: 3px solid accent; box-shadow: shadow-sm`
- `padding: 16px 20px; border-radius: radius`

---

### Pros / cons cards

Use for trade-offs. Always pair pros and cons together.

```html
<div class="pc-grid">
  <div class="pc-card pros">
    <h3><span class="badge-icon">+</span>Advantages</h3>
    <ul>
      <li><strong>Headline.</strong> Explanation.</li>
    </ul>
  </div>
  <div class="pc-card cons">
    <h3><span class="badge-icon">−</span>Disadvantages</h3>
    <ul>
      <li><strong>Headline.</strong> Explanation.</li>
    </ul>
  </div>
</div>
```

- `.pc-card.pros`: `border-top: 3px solid var(--good)`; `.pc-card.cons`: `border-top: 3px solid var(--bad)`
- `.badge-icon`: 18px circle, white text, good/bad bg
- List items: `border-bottom: 1px dashed var(--border)`; last item: none
- Collapses to single column at ≤700px

---

### Flow diagram

Use for execution flows, data flows, or parallel-path comparisons. Max 2 columns for parallel paths.

```html
<div class="flow-diagram">
  <svg viewBox="0 0 640 300" width="640" height="300" …>
    <defs>
      <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M1,1 L7,4 L1,7 Z" fill="#8a8a82"/>
      </marker>
    </defs>
    …
  </svg>
</div>
```

- `.flow-diagram`: `background: surface; border: 1px solid border; border-radius: radius-lg; box-shadow: shadow-sm; overflow-x: auto`
- SVG: `display: block; margin: 0 auto; max-width: 100%; height: auto`
- Define arrowhead marker in `<defs>` inside the SVG
- Use inline `font-family` on the `<svg>` element; do not rely on inherited fonts in SVGs

---

### File list

Use in a "Key files" section. One entry per significant file.

```html
<ul class="files">
  <li>
    <span class="file-icon js">.js</span>
    <div>
      <div class="file-path">path/to/file.js</div>
      <div class="file-desc">What this file does and why it matters here.</div>
    </div>
  </li>
</ul>
```

- `<ul class="files">`: CSS grid, `gap: 10px`
- `<li>`: 2-column grid (icon | content), surface bg, border, `padding: 14px 16px`; hover: `border-color: border-strong; transform: translateY(-1px)`
- `.file-path`: mono, 13px, accent colour
- `.file-icon`: 36px square, 8px radius, mono 11px bold

**File icon colours by type:**

| Class | Background | Text | Use for |
|---|---|---|---|
| `.js` | `#fff5e1` | `#966100` | JavaScript files |
| `.srv` | `accent-soft` | `accent` | Server/Express files |
| `.tst` | `#f3e8ff` | `#7c3aed` | Test files |
| `.vue` | `#e8faf3` | `#1a6b47` | Vue components |
| `.cfg` | `#e0fafa` | `#0d6b6b` | Config/JSON files |
| `.str` | `#fef9e1` | `#8a6900` | Store files (Pinia etc.) |

Add new colour pairs for new file types following the same pattern: a pale tint background, a dark-on-light text colour.

---

### Pattern cards (index pages only)

Each card is an `<a>` linking to a detail page.

```html
<div class="patterns">
  <a class="pattern [type]" href="detail.html">
    <div class="pattern-head">
      <span class="pattern-icon" aria-hidden="true">
        <svg …>…</svg>
      </span>
      <div>
        <h3>Pattern Name</h3>
        <div class="file">detail.html</div>
      </div>
    </div>
    <div class="tags">
      <span class="tag">Layer · Server</span>
      <span class="tag">entryPoint()</span>
    </div>
    <p>Two-sentence description of the problem and how the pattern solves it.</p>
    <span class="read">Read pattern <span class="arrow">→</span></span>
  </a>
</div>
```

**Colour stripe classes** (drives `::before` top border and `.pattern-icon` tint):

| Class | Colour | Use for |
|---|---|---|
| `.server` | accent | Server-side patterns |
| `.client` | good | Client-side patterns |
| `.shared` | warn | Cross-boundary / shared packages |
| `.combo` | purple | Patterns spanning server + client |
| `.state` | orange | State management patterns |

- `::before` pseudo-element: 4px top border stripe, grows to 6px on hover
- Hover: `transform: translateY(-3px); box-shadow: shadow-lg; border-color: border-strong`
- `.read` arrow animates `translateX(3px)` on hover
- Grid: `grid-template-columns: 1fr 1fr`; collapses to 1 column at ≤800px

---

### Intro block (index pages only)

Use to frame the set of documents before the card grid.

```html
<div class="intro">
  <p>…</p>
  <p>…</p>
</div>
```

- `background: surface; border: 1px solid border; border-radius: radius-lg; box-shadow: shadow-sm`
- `padding: 24px 28px; margin-bottom: 56px`

---

### Section eyebrow (index pages only)

Optional label above an `<h2>`, used to name a section of the index.

```html
<p class="section-eyebrow">Index</p>
<h2>Patterns covered</h2>
```

- 11px, uppercase, letter-spacing 0.1em, text-faint

---

### Footer

Use on every page.

```html
<footer>
  <span>Project name · docs/context</span>
  <span>Page title</span>
</footer>
```

- `border-top: 1px solid border; padding-top: 24px; margin-top: 64–80px`
- `display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px`
- 13px, text-faint

---

## Responsive breakpoints

| Breakpoint | What changes |
|---|---|
| ≤900px | Detail page collapses to single column; TOC becomes `position: static` |
| ≤800px | Pattern card grid collapses to 1 column |
| ≤700px | Compare grid and pros/cons grid collapse to 1 column; h1 shrinks (detail 44px → ~34px, index 52px → 38px) |

---

## Interaction JS

All scripts go at the bottom of `<body>`. No external dependencies.

**Copy buttons:**
```js
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const pre = document.querySelector('#' + btn.dataset.copyTarget);
    if (!pre) return;
    navigator.clipboard.writeText(pre.innerText).then(() => {
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
  });
});
```

**TOC active state:**
```js
const tocLinks = Array.from(document.querySelectorAll('.toc a'));
const sections = tocLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    const link = tocLinks.find(a => a.getAttribute('href') === '#' + e.target.id);
    if (link) link.classList.toggle('active', e.isIntersecting);
  });
}, { rootMargin: '-10% 0px -80% 0px', threshold: [0, 0.1, 0.5, 1] });
sections.forEach(s => obs.observe(s));
```

**Tabs:**
```js
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const code = btn.closest('.code');
    code.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    code.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    code.querySelector('#' + btn.dataset.tab).classList.add('active');
  });
});
```
