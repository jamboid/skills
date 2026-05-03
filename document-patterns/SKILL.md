---
name: document-patterns
description: Explores a codebase to find recurring architectural design patterns, proposes up to 6 candidates, and writes structured markdown docs for the ones the user selects into docs/patterns/ at the project root. Use when the user wants to document design patterns, create architecture docs, explain how the codebase is structured, or invokes /document-patterns.
disable-model-invocation: true
---

# document-patterns

Explores the codebase, surfaces up to 6 design pattern candidates, lets the user pick, then writes a structured markdown doc for each into `docs/patterns/`.

## Workflow

### 1. Check existing docs
Read `docs/patterns/README.md` if it exists. Exclude any patterns already listed there from your candidates — don't repropose documented work.

### 2. Explore the codebase (two passes)
**Pass 1 — fast:** Scan directory structure and file names to map the codebase's layers (routes, services, domain, stores, components, middleware, etc.).

**Pass 2 — targeted:** Read entry points and 1–2 representative files per layer in full. Look for recurring structures — the same architectural decision appearing in multiple files.

**Good candidates:**
- Recur across multiple files (not a one-off trick)
- Shape how the whole codebase is organised
- A new developer who missed this pattern would struggle to add a feature or trace a bug

### 3. Propose up to 6 candidates
For each, write one paragraph: pattern name, one-sentence description of what it is, which files exemplify it, and why a new developer needs to understand it.

### 4. Wait for the user to select
Do not write any docs until the user has chosen which patterns they want.

### 5. Write all selected docs at once
One file per pattern: `docs/patterns/kebab-case-pattern-name.md`

**Fixed five-section structure — always in this order:**
1. **Problem statement** — what goes wrong without this pattern; no code in this section
2. **Implementation in this codebase** — real code examples from actual files; if the pattern belongs to a specific layer (API, I/O, state management), name that layer and explain why the pattern lives there
3. **Advantages**
4. **Disadvantages**
5. **Key files** — bulleted list of file paths, one-line description each

### 6. Create or update docs/patterns/README.md
One line per doc: a link and a one-sentence hook. Append new entries — never overwrite existing ones.

## Defaults

| Setting  | Default                                                                                                   |
|----------|-----------------------------------------------------------------------------------------------------------|
| audience | Developer with limited backend experience — explain the *why* before showing code, use analogies before abstractions, avoid assuming knowledge of HTTP internals, databases, or file I/O |
| length   | ~5-minute read (~800–1000 words including code blocks)                                                    |

Override with optional args:
```
/document-patterns audience="senior engineers"
/document-patterns length="brief"
/document-patterns audience="junior frontend devs" length="detailed"
```
