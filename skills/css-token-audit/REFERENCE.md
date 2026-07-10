# css-token-audit reference

The **contract** between `analyze.mjs` (which generates `audit.json`) and
`build_report.mjs` (which renders it). `audit.json` is **generated, never
hand-edited** — re-run `analyze.mjs` to regenerate it.

This schema is the shared, versioned contract the whole `css-tokens` arc is
built on. It is **born here** (slice #18) and extended by later slices — never
built up-front as a standalone artifact.

## Versioning (the contract)

`audit.json` carries a **mandatory** top-level `schemaVersion` (semver string).
`build_report.mjs` refuses any audit whose **major** version it doesn't support
(`SUPPORTED_MAJOR`), rather than silently mis-rendering. Additive, backward-
compatible changes bump minor/patch; a breaking change bumps major and requires
both scripts to move together.

Current: **`1.0.0`**.

## `audit.json` schema (v1)

```jsonc
{
  "schemaVersion": "1.0.0",         // mandatory; incompatible majors are refused

  "meta": {
    "project":     "jbdn-build",     // display name
    "slug":        "jbdn-build",     // output filename stem
    "root":        "/abs/path/audited",  // the CSS tree that was parsed
    "date":        "2026-07-10",     // ISO generation date
    "generatedBy": "css-token-audit/analyze.mjs",
    "cssFiles":    1,                // files parsed
    "declarations":87,              // custom-property declarations found
    "parseErrors": 0                 // recoverable parse errors (see below)
  },

  // Deterministic counts — the report's overview.
  "summary": {
    "tokenCount":        53,   // distinct tokens with ≥1 definition
    "globalTokens":      37,   // defined only at root/theme scope
    "blockTokens":       16,   // defined under a component selector
    "referenceCount":    158,  // total var() uses
    "deadCount":         11,
    "oneOffCount":       13,
    "undefinedRefCount": 6,    // referenced but never defined (dangling)
    "tierCount":         3,    // primitive/semantic/component tiers in use (0–3)
    "flowDirection":     "downward", // downward (healthy) | mixed (up-tier leak) | circular
    "tierLeakCount":     0,    // tier-leak findings
    "findingCount":      11
  },

  "model": {
    "axes": {
      // AXIS 1 (slice #18): fan-in / fan-out. Later slices add sibling axes here
      // (tiers, scope&cascade, coverage, fallback) without breaking v1.
      "fanInOut": {
        "tokenCount":  53,
        "loadBearing": [
          { "name": "--theme-accent", "fanIn": 17, "fanOut": 1,
            // sample of consuming selectors, most-frequent first, capped at 6;
            // usedInCount is the full distinct-selector total.
            "usedIn": [ { "selector": ".b_button", "atScope": null, "count": 3 } ],
            "usedInCount": 9 }
        ],
        "dead":        [ "--clr-blue", "..." ],   // fanIn === 0
        "oneOff":      [ "--base-font", "..." ],   // fanIn === 1
        "undefinedReferences": [ { "name": "--text-h1", "fanIn": 1 } ] // used, never defined
      },

      // AXIS 2 (slice #19): naming taxonomy. A grammar inferred PER TIER — the
      // codebase runs one convention for global :root tokens and another for
      // block-scoped locals, so they're measured separately.
      "naming": {
        "tiers": {
          "global": {
            "template":           "--{category}-{role}[-{variant}]",
            "tokenCount":         37,
            "prefixes":           [ { "prefix": "clr", "count": 8 } ], // first-segment freq, desc
            "recurringPrefixes":  [ "clr", "space", "fs" ],   // count ≥ 2 — the category vocabulary
            "singletonPrefixes":  [ "measure", "flow" ],       // count 1 — outlier candidates
            "dominantSegmentCount": 2,
            "consistency":        0.93,   // share whose first segment is a recurring prefix
            // one concept spelled ≥2 ways within the tier
            "abbreviationConflicts": [
              { "concept": "default",
                "forms": [ { "form": "default", "count": 3, "tokens": ["--x-default"] },
                           { "form": "def", "count": 1, "tokens": ["--y-def"] } ] }
            ]
          },
          "block": { /* same shape, template "--{block}-{part}[-{state}]" */ }
        }
      },

      // AXIS 3 (slice #20): layering / tiers. The primitive → semantic →
      // component tier system reconstructed FROM THE GRAPH (not names), and how
      // cleanly value flows through it. `tier` (global/block) is the coarse
      // definition-scope split the naming axis reads; `layer` is this deeper
      // classification — `global` splits into primitive (holds a raw value) +
      // semantic (aliases a token) by graph position; `block` maps to component.
      "layering": {
        "tierCount": 3,                    // tiers populated (0–3)
        "tiers": {
          "primitive": { "tokenCount": 34, "tokens": [ "--clr-pink", "..." ] },
          "semantic":  { "tokenCount": 15, "tokens": [ "--theme-accent", "..." ] },
          "component": { "tokenCount": 4,  "tokens": [ "--base-font", "..." ] }
        },
        // Every token→token edge classified by the tiers it connects. A healthy
        // reference points DOWN-tier (component reads semantic reads primitive).
        "flow": {
          "edges":            31,          // healthy + backward + lateral
          "healthy":          30,          // points strictly down-tier
          "backward":         0,           // points up-tier — a leak
          "skip":             2,           // down-tier but jumps a tier (component→primitive)
          "lateral":          1,           // same-tier (semantic→semantic, component→component)
          "throughSemantic":  2,           // component refs routed via a semantic token
          "directToPrimitive":2,           // component refs hitting a primitive directly
          "norm":             "direct",    // component routing norm: semantic | direct | none
          "direction":        "downward"   // downward | mixed (a backward edge) | circular (a cycle)
        }
      }
    },

    // The structured facts the graph is built from — embedded so later slices'
    // model judgment (naming, tiers) reads facts, never raw CSS. One entry per
    // DEFINED token, sorted by name.
    "tokens": [
      {
        "name":     "--theme-accent",
        "tier":     "global",               // global | block — coarse definition-scope split (naming axis)
        "layer":    "semantic",             // primitive | semantic | component — deep graph tier (#20); null for dangling
        "segments": [ "theme", "accent" ],   // name split on '-' (after the '--')
        "fanIn":    17,
        "fanOut":   1,
        "referencedTokens": [ "--clr-pink" ],           // tokens this one uses in its value(s)
        // distinct selectors that consume this token, most-frequent first.
        // `var --x` means it feeds another token's value. The location signal
        // that survives minification (line collapses to 1; the selector doesn't).
        "usedIn": [ { "selector": ".b_button", "atScope": null, "count": 3 } ],
        "definitions": [
          { "value": "#e91e63", "scope": ":root", "atScope": null, "file": "assets/jbdn.css", "line": 1 }
        ],
        "references": [
          { "inProperty": "color", "scope": ".b_button", "atScope": null, "owner": null,
            "file": "assets/jbdn.css", "line": 1 }
          // scope  = the selector this var() sits under.
          // owner  = the custom property whose value holds this var(), or null in a normal declaration.
        ]
      }
    ]
  },

  // Findings. Each is one record with the fields the PRD fixes: id, type, basis,
  // confidence, location(s), evidence. Ordered by type then discovery.
  "findings": [
    {
      "id":         "F1",              // stable Fn id, render order
      "type":       "dead-token",      // dead-token | exact-duplicate | naming-* | tier-leak
      "basis":      "universal",       // universal | convention | house-rule
      "confidence": "medium",          // high | medium | low
      "title":      "Dead token `--clr-blue` — defined but never referenced",
      // Each location leads with the selector (the defining scope here) so it
      // stays useful on minified CSS where line is always 1.
      "locations":  [ { "selector": ":root", "atScope": null, "file": "assets/jbdn.css", "line": 1 } ],
      "evidence":   "…why this was flagged, in plain words."
    }
  ],

  // null, or a source+build tree-doubling warning (see "Tree doubling" below).
  "doubling": {
    "dirA":        "build",
    "dirB":        "source",
    "sharedTokens":31,       // tokens defined identically under both trees
    "share":       0.53,     // sharedTokens / tokenCount
    "compiledDir": "build"   // the tree that looks minified/compiled, or null
  },

  "parseErrors": [ { "file": "x.css", "message": "Identifier is expected" } ]
}
```

## Findings

| type | basis | confidence | rule |
|---|---|---|---|
| `dead-token` | universal | `medium` | Defined ≥1×, zero `var()` references. Medium, not high: static analysis can't see inline-style/JS consumption, and a design-system token may be a public API. The dispose loop (slice #24) is where the human accepts intentional exceptions. |
| `exact-duplicate` | universal | `high` | Same token defined ≥2× with an **identical value** under the **same** (selector, at-rule) scope — pure redundancy, provable from the AST. Differing values in one scope are a redefinition/override → the cascade axis (slice #21), not flagged here. |
| `naming-inconsistency` | convention | `high` | One concept spelled ≥2 ways **within a tier** (e.g. `hov` and `hover`). Cites the dominant form as the norm; minority forms deviate. A factual inconsistency. |
| `naming-outlier` | convention | `low` | A **global** token whose first segment is a one-of-a-kind prefix, in a tier that otherwise clusters into recurring category prefixes. Cites the norm (recurring prefixes + share). Global only — block-local brevity/per-block namespaces make singletons normal there (#18 refinement). Low confidence: a singleton may be a legit category. |
| `tier-leak` (backward) | convention | `medium` | A `var()` reference flows **up-tier** against the reconstructed tiering (`primitive → semantic → component`) — e.g. a component token consumed as a base value. Cites the tiering norm. |
| `tier-leak` (skip) | convention | `low` | A component reaches a **primitive directly**, jumping the semantic tier — **only** flagged where routing through a semantic is the codebase's own norm (cites the share). Silent on a codebase that routes directly (both test beds do). Low confidence: a direct reference may be intentional. |
| `tier-leak` (circular) | universal | `high` | Tokens form a `var()` reference cycle — the value can never resolve. Provable from the AST. |

`convention`-basis findings **cite the norm** they're measured against, per the PRD.

## Parse coverage (correctness caveat)

`analyze.mjs` parses with css-tree and `parseCustomProperty: true` so that a
`var()` inside another token's value is seen (without it, most fan-in vanishes
and tokens look falsely dead).

When a value contains syntax css-tree can't parse — **preprocessor / authored
source** (Sass, CSS `@function`, `utopia.clamp()`, custom functions) — css-tree
recovers by dropping the rest of that value to a raw string, so `var()`s after
the error point are **invisible**. That undercounts fan-in and produces **false
dead tokens**. Every such error is counted in `meta.parseErrors` and the report
prints a loud warning.

**The fix is not in the parser — it's the input.** Point the audit at the
**compiled** CSS, the only place `var()` actually resolves (PRD §5.2). Authored
preprocessor source is never a reliable graph. A run with `parseErrors > 0`
should be treated as provisional.

## Tree doubling (a second correctness caveat)

Distinct from parse coverage. If `--root` spans **both** an authored tree and
its compiled build, every token is parsed twice — counts inflate and dozens of
phantom `exact-duplicate` findings fire (the same token in two copies, misread
as redundancy). Unlike a parse error this can happen **silently** on all-valid
plain CSS, so it gets its own detector and warning.

`detectDoubling` flags it when the same token is defined with an **identical
value** across two top-level dirs at scale (≥3 tokens **and** ≥25% of the set),
and names the minified tree as the likely build. The skill does **not**
auto-resolve it — the fix is the user's: re-run against one tree (the compiled
one). `audit.doubling` is `null` when nothing systemic is found.

## Bundled files

- `scripts/analyze.mjs` — parser + graph + fan-in/fan-out axis + findings → `audit.json`.
- `scripts/build_report.mjs` — renders `audit.json` → Markdown (refuses incompatible major).
- `notes-template.md` — copied to `notes.md` by `init`; the human-editable input.
