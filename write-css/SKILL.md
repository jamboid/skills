---
name: write-css
description: Write CSS following preferred conventions. Use when writing, refactoring, or reviewing CSS, or when creating a new component that needs styling.
---

## Read existing code first

Before writing any CSS, review the existing stylesheets. Match the established naming conventions, file structure, custom property patterns, and class naming. When in doubt, follow what's already there.

---

## Custom properties — 2-level system

Use a consistent two-level approach throughout all files.

**Level 1 — primitives:** raw values with no semantic meaning. Define once, reuse everywhere.

**Level 2 — semantic aliases:** reference Level 1 values via `var()`. Give components and themes a meaningful vocabulary. May reference other Level 2 props.

Never hard-code a raw value where a token already exists. Never use a Level 1 token directly in a component when a Level 2 alias better expresses intent.

---

## General principles

- **Logical properties over physical** — prefer `margin-inline`, `padding-block`, `inline-size` etc. for layout and spacing
- **Fluid scaling over breakpoints** — use `clamp()` for typography and spacing where possible rather than explicit media queries
- **Shallow nesting** — avoid deep nesting; use it for state, pseudo-classes, and context-scoped overrides
- **Cascade custom properties** — set component-scoped custom properties on a parent and let children override them via the cascade
- **Accessibility defaults** — motion off by default, opt in via `prefers-reduced-motion`; support both media query and attribute-based theming for colour schemes

---

## Comments

Brief section headers only. Explain intent, not mechanics.
