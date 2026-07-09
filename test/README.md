# Skill Tests

Unit tests for skills that bundle executable JS scripts. Run from the repo root:

```
npm test
```

## Skills

- [`scaffold-components/`](scaffold-components/README.md) — vitest unit tests for
  that skill's `scripts/` (`new-component.mjs`, `scaffold-from-markup.mjs`).

## Adding a skill

Add `test/<skill>/` with `*.test.mjs` files that import the skill's scripts from
`../../skills/<skill>/scripts/`. vitest discovers them automatically; no config needed.
