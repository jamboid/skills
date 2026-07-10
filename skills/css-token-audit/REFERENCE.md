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
    "referenceCount":    158,  // total var() uses
    "deadCount":         11,
    "oneOffCount":       13,
    "undefinedRefCount": 6,    // referenced but never defined (dangling)
    "findingCount":      11
  },

  "model": {
    "axes": {
      // AXIS 1 (slice #18): fan-in / fan-out. Later slices add sibling axes here
      // (naming, tiers, scope&cascade, coverage, fallback) without breaking v1.
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
      }
    },

    // The structured facts the graph is built from — embedded so later slices'
    // model judgment (naming, tiers) reads facts, never raw CSS. One entry per
    // DEFINED token, sorted by name.
    "tokens": [
      {
        "name":     "--theme-accent",
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
      "type":       "dead-token",      // dead-token | exact-duplicate (v1)
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

## Findings in v1

Both are `basis: universal` — defensible on any codebase:

| type | confidence | rule |
|---|---|---|
| `dead-token` | `medium` | Defined ≥1×, zero `var()` references. Medium, not high: static analysis can't see inline-style/JS consumption, and a design-system token may be a public API. The dispose loop (slice #24) is where the human accepts intentional exceptions. |
| `exact-duplicate` | `high` | Same token defined ≥2× with an **identical value** under the **same** (selector, at-rule) scope — pure redundancy, provable from the AST. Differing values in one scope are a redefinition/override → the cascade axis (slice #21), not flagged here. |

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
