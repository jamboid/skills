# 1. css-tokens schema versioning — semver + migration note

Status: accepted (2026-07-11)
Resolves: PRD #17 §9-Q1 · slice #34

## Context

The `css-tokens` arc is three skills — `css-token-audit`, `css-token-architect`,
`css-token-refactor` — chained by **one versioned structured-data schema** (the
`audit.json` / `target.json` family). The skills are authored and installed
independently (`npx skills add <one-skill>`), so nothing stops a newer skill from
being handed a document written by an older one, or vice versa. We need a rule
for how a version mismatch is handled, and PRD §9-Q1 left the mechanics open:
**semver with a compatibility window, or hard-break-only** (every schema change
bumps major, all consumers must move in lockstep).

Facts constraining the choice:

- The audit already behaves semver-ish: `assertSchema` refuses only on a **major**
  mismatch; minor/patch pass. This decision formalizes what the code does.
- Slices #36–#41 each **add** fields to the schema (consolidation, naming, tier,
  tokenization decisions). Additive change is the common case, not the exception.
- Because installs are independent, two skills at adjacent versions coexisting is
  normal, not a misconfiguration.

## Decision

**Semver, with a migration note per breaking change.**

- Every structured document carries a mandatory `schemaVersion` (semver string).
- A skill refuses input whose **major** it doesn't support (`SUPPORTED_MAJOR`),
  rather than silently mis-reading it — a clear error, not a wrong answer.
- **Additive, backward-compatible** fields bump **minor/patch** and are tolerated
  across a shared major: an older reader ignores unknown fields; a newer reader
  tolerates their absence.
- A **breaking** change (a field removed, renamed, or given new required
  semantics) bumps **major** and ships with a short **migration note** appended to
  this ADR describing what moved and how to convert an old document.
- `audit.json` and `target.json` are **one schema family** under one
  `SCHEMA_VERSION`. The human-editable **conventions file** versions separately
  (`CONVENTIONS_VERSION`) because it evolves on a hand-editing cadence.

The versions and the guard live in **one module, `scripts/schema.mjs`**, bundled
**verbatim** into each skill (there is no shared dir above a skill, by the install
model). A repo drift-guard test asserts the copies stay byte-identical — that test
_is_ the "no divergent copies" guarantee (**policy A**: copy + guard, not a build
step). Rejected alternative **B** (one root file + a sync/generator step) was set
aside: it adds tooling the standalone-install model never runs.

## Consequences

- The common case (adding a field) is cheap: bump minor, no coordinated release.
- Cross-major input fails loud and early with a self-explaining error, never a
  silent mis-read.
- A breaking change is deliberately expensive — a major bump + a migration note —
  which is the right amount of friction for a shared contract.
- The drift-guard test must be kept green: edit the `css-token-audit` copy of
  `schema.mjs`, then re-sync every other skill's copy in the same change.

## Migration notes

_None yet (schema at 1.0.0)._
