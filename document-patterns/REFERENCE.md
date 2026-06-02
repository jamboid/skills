# HTML generation reference

`scripts/build_patterns.py` renders the pattern `.md` files into styled,
navigable HTML. **Markdown is the source of truth** — a plain doc with none of
the additions below still renders correctly. Frontmatter and directives are
opt-in layers for the editorial chrome and the rich components.

```
python3 scripts/build_patterns.py <patterns-dir> [--out-dir DIR] [--project NAME]
```

- `<patterns-dir>` — folder of `*.md` (e.g. `docs/patterns/`).
- `--out-dir` — defaults to `<patterns-dir>/HTML`.
- `--project` — name used in `<title>` and footers (default `Patterns`).

Each `*.md` → `<slug>.html`; `README.md` → `index.html`. Dependency-free
(Python standard library only). Re-run any time; HTML is regenerated, never
hand-edited.

## What the script owns vs. what you author

**Script owns (don't hand-write):** the `:root` token CSS, copy / tab /
scroll-spy JS, hero + back-link + footer scaffold, the on-this-page TOC (built
from `##` headings), syntax highlighting, and all component markup.

**You author:** section breakdown and titles, the lede and chips, counter-
examples, which directives to use, and any bespoke SVG.

## Frontmatter (optional)

A YAML block at the very top of a pattern `.md`. Minimal subset: `key: value`
scalars, `key:` + `  - item` lists, and `key: |` block scalars.

| Field | Used on | Purpose |
|---|---|---|
| `title` | page + index card | Page `<h1>`; falls back to the first `#` heading, then the filename. |
| `eyebrow` | page | Pill above the title (default `Pattern`). |
| `lede` | page | Subtitle paragraph under the title. Inline markdown allowed. |
| `chips` | page | List → hero meta chips. Inline markdown allowed (e.g. `` "Entry · `fn()`" ``). |
| `slug` | page | Output filename base (default: the `.md` filename). |
| `footer` | page + index | Footer-left text (default: `--project`). |
| `category` | index card | `server` \| `client` \| `shared` \| `combo` \| `state` — sets the card accent colour. |
| `icon` | index card | Block scalar (`icon: |`) holding a raw inline `<svg>`. |
| `tags` | index card | List → monospace tag pills on the card. |
| `summary` | index card | Card body text; falls back to the README link's hook. |

README frontmatter (index page): `title`, `eyebrow`, `heading`, `lede`,
`chips`, `intro` (block scalar; otherwise the README paragraphs before the link
list are used), `section_eyebrow`, `section_heading`, `footer`, `footer_right`.

## Markdown handled

`#` (dropped — title comes from frontmatter/hero), `##` → `<section>` + TOC
entry, `###` → subheading, paragraphs, `-`/`*` and `1.` lists, GitHub pipe
tables, `---` rule, and inline `` `code` ``, `**bold**`, `*italic*`, `[text](url)`.

**Two sections get special rendering:**

- **`## Advantages` immediately followed by `## Disadvantages`** (also accepts
  Pros/Cons) merge into one **Trade-offs** pros/cons card grid, with a single
  TOC entry. Write each as a normal bullet list; a `**bold lead.**` at the start
  of an item is preserved.
- **`## Key files`** — its bullet list renders as file cards. Each item should be
  `` `path/to/file.ext` — description ``; the icon label comes from the
  extension (`js`, `ts`, `vue`, `json`, `css`).

## Code fences

```` ```lang optional header label ````

The language token drives highlighting; **everything after it on the fence line
becomes the dark code-block's header label** (often a file path or a short
note). Omit it for just the traffic-light dots. Every block gets a Copy button
automatically.

## Directives

Fenced with `:::name` … `:::`.

### `:::callout`
Inner markdown rendered inside an accent-bordered box. Good for a one-line
takeaway.

### `:::compare`
Wrong/right comparison rendered as a **tabbed** component: one tab per side
(labelled from the marker, with a red/green dot) plus a **Both** tab that stacks
the two code cards full-width — it opens on **Both** by default. Each side is an
`@bad` / `@good` marker (the rest of the line is its label) followed by a fenced
code block:

```
:::compare
@bad Wrong — direct mutation
` ` `js reference unchanged
props.modelValue.title = e.target.value
` ` `
@good Right — spread emit
` ` `js new object; watcher fires
emit('update:modelValue', { ...props.modelValue, [field]: value })
` ` `
:::
```

### `:::tabs`
Tabbed code blocks. Each `@tab Label` marker (the label becomes the tab button)
is followed by a fenced code block. The fence's header label, if any, shows
inside the panel.

### `:::diagram`
Wraps its inner content (a bespoke inline `<svg>`) in the framed `.flow-diagram`
container. Emitted verbatim — not escaped or parsed.

### `:::raw`
Emits its inner content verbatim with no wrapper. Escape hatch for any one-off
HTML.
