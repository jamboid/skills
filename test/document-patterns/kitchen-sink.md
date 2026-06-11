---
title: Kitchen-Sink Pattern
eyebrow: Test Fixture
category: server
lede: A single doc that exercises **every** component the build script can render — use it to eyeball template style changes. Inline `code` works here too.
chips:
  - "Layer · fixtures"
  - "Entry · `kitchen-sink.md`"
  - "Covers · all components"
tags:
  - directives
  - regression
summary: Every callout, comparison, tab group, diagram, table, and file-card variant on one page.
icon: |
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M3 3h18v4H3zM3 10h18v11H3z"/><path d="M7 14h6"/></svg>
---

# Kitchen-Sink Pattern

## Problem statement

This section is plain prose with **bold**, *italic*, inline `code`, and a
[link](https://example.com). It should render with no special components — the
baseline case. There is deliberately no code in the problem statement, matching
the five-section contract.

## Implementation in this codebase

A normal code fence with a header label. The label is everything after the
language token on the fence line:

```js src/server/handler.js
export function handle(req, res) {
  const result = doWork(req.body)        // plain comment
  return res.json({ ok: true, result })  // a number 42 and a 'string'
}
```

A `:::callout` for a one-line takeaway:

:::callout
**The rule:** if it imports the framework it's plumbing; if it doesn't, it's logic.
:::

A `:::compare` — **this is the overflow regression guard.** The right side has a
deliberately long, unbreakable line that must scroll inside its column, not
burst the grid:

:::compare
@bad Wrong — direct mutation
```js identity unchanged; watcher never fires
props.modelValue.title = e.target.value
```
@good Right — spread emit
```js a very long line that exercises horizontal scroll inside a narrow grid column without breaking layout
emit('update:modelValue', { ...props.modelValue, [field]: value, updatedAt: Date.now(), revision: props.modelValue.revision + 1 })
```
:::

A `:::tabs` group with three tabs:

:::tabs
@tab JavaScript
```js
const sum = (a, b) => a + b
```
@tab TypeScript
```ts
const sum = (a: number, b: number): number => a + b
```
@tab Vue
```vue
<script setup>
const props = defineProps(['modelValue'])
</script>
```
:::

A `:::diagram` wrapping bespoke inline SVG (emitted verbatim):

:::diagram
<svg viewBox="0 0 320 80" width="320" height="80" fill="none" stroke="currentColor" stroke-width="1.5">
  <rect x="8" y="24" width="90" height="32" rx="6"/>
  <text x="53" y="44" text-anchor="middle" font-size="11" stroke="none" fill="currentColor">Input</text>
  <path d="M104 40h40" marker-end="url(#a)"/>
  <rect x="150" y="24" width="90" height="32" rx="6"/>
  <text x="195" y="44" text-anchor="middle" font-size="11" stroke="none" fill="currentColor">Logic</text>
  <path d="M246 40h40"/>
  <rect x="232" y="24" width="80" height="32" rx="6"/>
  <text x="272" y="44" text-anchor="middle" font-size="11" stroke="none" fill="currentColor">Output</text>
</svg>
:::

A `:::raw` escape hatch (verbatim HTML, no wrapper):

:::raw
<p style="font-size:13px;color:#888;">Raw HTML passed straight through.</p>
:::

### A subheading (`###`)

A GitHub pipe table:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | primary key |
| `count` | `number` | defaults to `0` |

A normal list:

- First item with `inline code`
- Second item with **bold lead.** and trailing prose
- Third item

---

A horizontal rule sits above this line.

## Advantages

- **Trivially testable.** Each component renders in isolation.
- **Consistent.** All chrome owned by the script.
- **Portable.** Output is dependency-free.

## Disadvantages

- **Discipline, not enforcement.** Nothing stops malformed directives.
- **Verbose at the seam.** Frontmatter must be authored per doc.

## Key files

- `src/server/handler.js` — JS icon variant
- `src/types/model.ts` — TS icon variant
- `src/components/Form.vue` — Vue icon variant
- `config/settings.json` — JSON icon variant
- `src/styles/tokens.css` — CSS icon variant
- `Makefile` — fallback icon (unknown extension)
