---
name: write-vue-app
description: Write Vue components and related JS/CSS following preferred conventions. Use when writing, refactoring, or reviewing Vue components or their styles.
---

## Read existing code first

Before writing anything, review existing components and utilities in the project. Match the established patterns for component structure, naming, state management, and styling. When in doubt, follow what's already there.

---

## General principles

### Vue components

- **File order:** `<template>` → `<script setup>` → `<style scoped>`
- **Composition API only** — `<script setup>`, no Options API
- **Import order:** Vue core → child components → stores → composables
- **Props** — always define with type and required/default; use object long-form
- **State** — `reactive()` for grouped related state, `ref()` for standalone primitives
- **Computed** — arrow functions only
- **Async functions** — async arrow functions with try/catch
- **All styles scoped** — every `<style>` block must be scoped
- **Path alias** — use `@/` for all `src/` imports

### Naming

- Component files: PascalCase
- Props, emits, variables, functions: camelCase
- Composables: camelCase verb phrase
- Use `update:` prefix for v-model emits

### Templates

- Use `:` not `v-bind:`, `@` not `v-on:`
- Use `#` shorthand for named slots
- Use object syntax for dynamic class bindings

---

## CSS / styling

- **Custom properties over hardcoded values** — all colours, spacing, typography, and transitions must use tokens; never write raw values
- **Two-level token system** — primitives (raw values) referenced by semantic aliases via `var()`; use the semantic alias in components, not the primitive directly
- **Component-scoped tokens** — define per-component custom properties at the block root to avoid hardcoded local values
- **Shallow nesting** — avoid deep nesting; use it for state, pseudo-classes, and context-scoped overrides
- **Prefer logical properties** over physical for layout and spacing
- **Prefer fluid scaling** over explicit breakpoints where possible

---

## Comments

Brief section headers only. Explain intent, not mechanics.
