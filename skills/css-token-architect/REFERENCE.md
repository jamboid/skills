# `css-token-architect` — `target.json` schema (the contract)

The **target architecture** document: what the token system *should be*,
formalized from an audit plus the human's curated conventions. Same schema
family as `audit.json` — one `SCHEMA_VERSION`, one version guard, both defined in
`scripts/schema.mjs` (bundled verbatim across the arc).

`target.json` is **generated, never hand-edited**. The human-editable input is
the audit's **conventions file**.

## Versioning

Policy: **semver + a migration note per breaking change** — see
`docs/adr/0001-css-tokens-schema-versioning.md` in the skills repo.

- Every document carries a mandatory top-level `schemaVersion`.
- `assertSchema(doc, label)` refuses a document whose **major** this build doesn't
  support, rather than mis-reading it. Additive fields bump minor/patch.
- Current: `SCHEMA_VERSION` **`1.1.0`** (`1.1.0` added `constraints` + `summary`).

## Shape

```jsonc
{
  "schemaVersion": "1.1.0",
  "kind":          "target-architecture",  // discriminates a target from an audit

  "meta": {
    "project":     "jbdn",
    "slug":        "jbdn",
    "root":        "/abs/path/audited",    // the CSS tree the source audit parsed
    "date":        "2026-07-11",
    "generatedBy": "css-token-architect"
  },

  "summary": {
    "decisionCount":   2,
    "constraintCount": 1,
    "changeCount":     1,   // decisions with intent `change`
    "keepCount":       1,   // decisions with intent `keep`
    "staleCount":      1    // decisions the current audit no longer raises
  },

  // One per confirmed disposition, joined to the audit finding it settles.
  "decisions": [
    {
      "id":          "D1",
      "fingerprint": "dead-token:--clr-blue",  // the key the disposition was recorded under
      "disposition": "fix",                    // as recorded by the human: accept | fix
      "intent":      "change",                 // fix → change · accept → keep
      "stale":       false,                    // true when no current finding matches
      "note":        "genuinely unused",       // the human's reasoning, verbatim

      // Joined from the audit finding (absent fields when the decision is stale;
      // `type` + `subject` are then recovered from the fingerprint).
      "type":        "dead-token",
      "subject":     "--clr-blue",
      "basis":       "universal",
      "confidence":  "medium",
      "title":       "Dead token `--clr-blue` — defined but never referenced",
      "locations":   [{ "selector": ":root", "file": "css/tokens.css", "line": 12 }]
    }
  ],

  // One per promoted house rule — standing rules the whole target must satisfy.
  "constraints": [
    {
      "id":      "C1",
      "rule":    "naming-prefix:global",
      "kind":    "naming-prefix",
      "tier":    "global",
      "allowed": ["clr", "fw", "space"],   // copied, frozen at promote time
      "title":   "Global tokens use a known category prefix",
      "note":    "the house style"
    }
  ]
}
```

## `intent` — the split that matters

A disposition records what a human thought; `intent` records what the target must
do about it.

| disposition | intent | meaning downstream |
|---|---|---|
| `fix` | `change` | A refactor lead. `css-token-refactor` may act on it (within its provable-safe subset). |
| `accept` | `keep` | An intentional exception. Later formalization passes and the refactor must **leave it alone**. |

Carrying `accept` forward is deliberate: without it, a later pass re-derives the
finding from the audit and "fixes" something a human already ruled intentional.

## Stale decisions

A disposition whose `fingerprint` matches no finding in the current `audit.json`
is carried with `stale: true`. It's not an error — the problem may simply be
gone. It means the conventions file and the audit have drifted, so it's surfaced
in the report rather than dropped.

## Bundled files

- `scripts/schema.mjs` — versions, the `assertSchema` guard, `newTargetDoc`. Byte-identical across every skill in the arc.
- `scripts/formalize.mjs` — `formalize` / `buildDecisions` / `buildConstraints` + the CLI.
- `scripts/build_target_report.mjs` — `renderTargetReport` + the CLI.

## Later slices

`decisions` + `constraints` are the spine. Consolidation (#36), naming
canonicalization (#37), tier formalization (#38), tokenization (#39), gap-filling
and validation (#40), and the greenfield fallback (#41) add sibling sections —
additive, so a minor bump each.
