# Skill Test Fixtures

Synthetic fixtures that exercise the HTML/Markdown output of skills whose build
scripts render templates. They are **not** real docs or audits — they exist to
preview and regression-check the template styles after editing.

Each skill has its own folder; output is generated into that folder's `out/`
(gitignored). Rebuild with the dispatcher from the repo root:

```
./test/build.sh                       # rebuild every skill, open each result
./test/build.sh document-patterns     # rebuild one skill only
./test/build.sh accessibility-audit
./test/build.sh --no-open [skill]     # rebuild without opening
```

## Skills

- [`document-patterns/`](document-patterns/README.md) — pattern-doc HTML
  template gallery; fixtures cover every `:::` component and the compare-grid
  overflow regression guard.
- [`accessibility-audit/`](accessibility-audit/README.md) — kitchen-sink
  `findings.json` exercising every report component across all severity tiers.

## Adding a skill

1. Create `test/<skill>/` with its input fixture(s) and a short `README.md`.
2. Add a `build_<skill>()` function and a `case` arm to `build.sh` that runs the
   skill's build script with `--out-dir "$here/<skill>/out"`.
