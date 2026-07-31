---
name: css-token-architect
description: Formalizes a target CSS custom-property (design-token) architecture from a css-token-audit run plus the human's curated conventions file, and emits a versioned target.json and a Markdown target report. Use when the user wants to turn an audit into a plan, formalize a token architecture, define a target token system, carry curated decisions forward into a target, or see what a token refactor has committed to. Proposes only - it writes its own target.json and report, never source CSS. First slice carries confirmed dispositions forward as structured decisions and promoted house rules as standing constraints; gap-filling, consolidation, naming, tier and tokenization passes land in later slices.
disable-model-invocation: true
---

# css-token-architect

The **formalizer**, second in the `css-tokens` arc: `css-token-audit` reverse-
engineers what a codebase *has*, this turns that plus the human's confirmed
decisions into what it *should be* — a `target.json` in the shared schema, plus
a readable target report.

**Proposes only.** This skill writes exactly two files, its own `target.json` and
its report. It never touches source CSS — that's `css-token-refactor`'s job, and
keeping the safe steps uncoupled from the mutating one is the whole point of the
three-skill split.

**It formalizes; it does not invent.** Every decision in the target traces to a
disposition a human recorded in the conventions file. If nothing has been
curated, the target is an empty shell — and says so. Run the audit's `curate`
pass first.

`target.json` is the generated source of truth; `build_target_report.mjs` renders
it. **Never hand-edit** `target.json` or the report — edit the **conventions
file** and re-run. See [REFERENCE.md](REFERENCE.md) for the schema.

## Inputs

Two, both produced by `css-token-audit`:

- **`audit.json`** — the model + findings. Must be from a compatible schema major;
  an incompatible one is refused rather than mis-read.
- **`conventions.json`** — the human's dispositions (`accept` / `fix`) and any
  promoted house rules. Optional but nearly pointless to omit: it's the source of
  every decision.

## What the target carries (this slice)

- **Decisions** — one per confirmed disposition, joined to the audit finding it
  settles. A `fix` becomes `intent: change` (a refactor lead the target commits
  to); an `accept` becomes `intent: keep` (an intentional exception later
  formalization passes must not "fix").
- **Constraints** — each promoted house rule as a standing rule the whole target
  must satisfy, with its frozen `allowed` vocabulary.
- **Stale decisions** — a disposition the current audit no longer raises (the
  token went away, or the finding stopped firing) is **carried and flagged**,
  never silently dropped. A human decided it; the target says so.

## `/css-token-architect init [slug]`

1. Target directory: the existing audit directory — `~/GitHub/audits/YYYY-MM-DD-[slug]-tokens/`.
   The architect works **alongside** its audit, not in a new folder.
2. Copy `notes-template.md` → `target-notes.md`, replacing placeholders.
3. Tell the user the absolute path, and that `audit.json` + `conventions.json`
   must both exist there before `draft`.

## `/css-token-architect draft`

1. **Check the inputs.** Both files present? If `conventions.json` is missing or
   has no dispositions, say so plainly and recommend `/css-token-audit curate`
   first — a target with no decisions is an empty shell, not a plan.
2. **Formalize:**
   ```
   node scripts/formalize.mjs --audit audit.json --conventions conventions.json \
        --out target.json
   ```
3. **Build the report:**
   ```
   node scripts/build_target_report.mjs target.json --out <slug>-token-target.md
   ```
4. **Report back** the two output paths and the headline: how many decisions
   split into change vs keep, how many constraints, and — surfaced, not buried —
   **any stale decisions**, since those mean the conventions file and the audit
   have drifted apart.

## Reading the output

- **Changes** — findings the human marked `fix`. The refactor leads this target
  commits to; `css-token-refactor` will consume them.
- **Deliberately kept** — findings the human `accept`ed. Intentional. Their
  presence in the target is what stops a later pass from "helpfully" fixing them.
- **Constraints** — promoted house rules. Standing, cross-cutting, and enforced
  by the audit on every re-run.
- **Stale** — a decision whose finding the current audit doesn't raise. Usually
  means the problem is gone (good) or the audit was re-pointed at a different CSS
  tree (worth checking). Not an error; a prompt to re-curate.

## Bundled files

- `scripts/schema.mjs` — the shared versioned contract, bundled verbatim across the arc (see the audit's copy; a repo drift-guard test keeps them identical).
- `scripts/formalize.mjs` — `audit.json` + `conventions.json` → `target.json`; refuses an incompatible schema major.
- `scripts/build_target_report.mjs` — renders `target.json` → Markdown; refuses an incompatible major.
- `notes-template.md` — copied to `target-notes.md` by `init`.
- `REFERENCE.md` — the `target.json` schema and the versioning contract.
