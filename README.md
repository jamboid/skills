# skills

A collection of personal Claude Code skills for writing and styling web applications.

## Frontend Development

These skills help you write consistent, well-structured frontend code.

- **scaffold-components** — Scaffold and style components in an eleventy-site-starter–convention project. Bundles the deterministic scaffolder scripts (spec → wired component, or markup → CSS/JS stubs) and adds the judgement layer: semantic markup + ARIA, and filling stubs with the project's design tokens. Works in both static/Eleventy and Drupal theme-pipeline modes.

  ```
  npx skills@latest add jamboid/skills/skills/scaffold-components
  ```

- **document-patterns** — Write documentation detailing the common software design patterns found in a codebase, and render it into styled, navigable HTML.

  ```
  npx skills@latest add jamboid/skills/skills/document-patterns
  ```

## Documentation

These skills turn notes, docs, and findings into styled HTML artifacts.

- **build-html-artifact** — Turn any documentation or captured knowledge into a self-contained, styled HTML artifact (single page or multi-page set) using a shared warm-stone design system. Guide-driven: copy a scaffold, fill the body from a component catalog.

  ```
  npx skills@latest add jamboid/skills/skills/build-html-artifact
  ```

- **performance-audit** — Draft a performance-focused site audit from your notes plus Lighthouse/WebPageTest exports. Scaffolds a dated audit directory, writes a first-pass analysis you review and amend, and builds both a Markdown report and a static HTML report.

  ```
  npx skills@latest add jamboid/skills/skills/performance-audit
  ```

- **accessibility-audit** — Audit a codebase or folder of template files against WCAG 2.1 and produce a Markdown report plus an interactive HTML report with a localStorage-backed per-issue fix checklist.

  ```
  npx skills@latest add jamboid/skills/skills/accessibility-audit
  ```
