# scaffold-components tests

Unlike the other folders here (visual fixtures rendered by `build.sh`), these are
**vitest unit tests** for the JS scripts bundled in
[`scaffold-components/scripts/`](../../skills/scaffold-components/scripts/) — the
markup↔CSS/JS parsing, idempotent merge, `app.js` wiring, and Eleventy-vs-Twig
target resolution.

Run from the repo root:

```
npm test
```

They are pure Node tests (no DOM, no fixtures to eyeball) and are not part of the
`build.sh` gallery flow.
