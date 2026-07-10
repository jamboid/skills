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
    "overrideCount":     12,   // tokens with >1 definition (overridden)
    "themingStyle":      "mixed", // color-scheme | data-attr | responsive | motion | mixed | none
    "cascadeSmellCount": 0,    // cascade-smell findings
    "hardcodeRatio":     0.41,  // share of tokenizable declarations that are raw literals (#22)
    "nearDuplicateCount":2,     // near-duplicate token clusters (#23)
    "findingCount":      11,    // SURFACED findings (suppressed excluded)
    "suppressedCount":   2,      // findings accepted via the conventions file (#24)
    "houseRuleFindingCount": 0,  // SURFACED findings from PROMOTED house rules (#25)
    "promotableCount":   1       // inferred norms available to `promote` (#25)
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
      },

      // AXIS 4 (slice #21): scope & cascade. Where each token lives in the
      // cascade, where it gets overridden, and how theming is wired — all
      // static, from the selector + `@`-rule structure (no headless browser).
      // Per-DEFINITION `cascadeScope` (root/theme/component) is embedded on each
      // token definition; this axis aggregates it. Orthogonal to `tier`/`layer`:
      // a token holds definitions in several cascade scopes (that IS an override).
      "scopeCascade": {
        // Per-token HOME scope (mutually exclusive; sums to tokenCount): root if
        // it has any unconditional `:root` base, else component, else theme.
        "scopes": { "root": 48, "theme": 0, "component": 5 },
        "overrides": {
          "tokenCount":         12,        // tokens with >1 definition
          "themeVariants":       9,        // root base re-defined by conditional root variants (healthy theming)
          "componentOverrides":  0,        // root/global base re-defined INSIDE a component (the notable smell)
          "localMultiScope":     3,        // no root base; defined across ≥2 component scopes
          "norm":                "theme",  // dominant override kind: theme | component | local | none
          // Each overridden token: its base def + the overriding defs. A def is
          // { selector, atScope, cascadeScope, value, file, line }.
          "sites": [
            { "name": "--theme-bg", "kind": "theme",
              "base":      { "selector": ":root", "atScope": null, "cascadeScope": "root", "value": "var(--clr-sand)", "file": "…", "line": 1 },
              "overrides": [ { "selector": "[data-theme=dark]", "atScope": null, "cascadeScope": "theme", "value": "var(--clr-slate)", "file": "…", "line": 1 } ] }
          ]
        },
        // Static theming approximation: the CONDITIONS under which root tokens get
        // a variant (an `@`-rule if any, else the variant selector), ranked by how
        // many tokens each themes, plus a coarse dominant `style`.
        "theming": {
          "mechanisms": [
            { "condition": "[data-theme=dark]", "tokenCount": 6 },
            { "condition": "@media (prefers-color-scheme:dark)", "tokenCount": 6 }
          ],
          "themedTokens": 9,               // distinct tokens with ≥1 theme-scope definition
          "style":        "mixed"          // color-scheme | data-attr | responsive | motion | mixed | none
        }
      },

      // AXIS 5 (slice #22): coverage / hardcode. Over the declarations a token
      // scheme typically governs (colour, spacing, borders, typography, motion —
      // the TOKENIZABLE set), how many consume a token via var() vs a raw literal.
      // Coarse by design (a literal `0` counts as hardcoded), so read `ratio` as a
      // direction, not a grade. `topHardcodedProperties` are the richest leads.
      "coverage": {
        "tokenizableDeclarations": 160,    // ordinary (non-custom-prop) decls on a tokenizable property
        "covered":                 109,    // …that consume a token (hasVar)
        "hardcoded":               51,     // …that hold a raw literal
        "ratio":                   0.68,   // covered / tokenizable — share routed through a token
        "topHardcodedProperties":  [ { "property": "margin", "count": 7 } ]
      },

      // AXIS 6 (slice #22): fallback usage. Catalogue of `var(--x, fallback)`
      // patterns by kind — token (a chained dependency the main graph doesn't
      // model), literal (a hardcoded default), or empty (`var(--x,)`). Catalogue
      // only; no finding in this slice.
      "fallback": {
        "total":          304,             // total var() references
        "withFallback":   40,              // …carrying a fallback
        "withoutFallback":264,
        "byKind":         { "token": 15, "literal": 25, "empty": 0 },
        "samples": [
          { "name": "--section-bg", "fallback": "transparent", "kind": "literal",
            "scope": ".b_section", "file": "…", "line": 1 }
        ]
      },

      // AXIS 7 (slice #23): near-duplicates. Clusters of DEFINED tokens whose raw
      // values are *nearly* (not exactly) the same — the juiciest consolidation
      // leads. Built on the value-distance substrate: colour distance in RGBA,
      // numeric relative proximity for lengths, fuzzy fallback otherwise. Each
      // token contributes ONE representative value (its root base, else first
      // def); aliases (a value that is a var()) are skipped. Clustering is gated
      // to DISTINCTIVE values (a colour, or a non-zero size-unit length) so the
      // output stays high-signal — coincidental `1fr`/`100%`/keyword matches are
      // dropped. `closeness` = worst pairwise distance ÷ type threshold (0 =
      // identical, → 1 at the edge); it drives the finding's confidence.
      "nearDuplicates": {
        "clusterCount": 2,
        "clusters": [
          { "valueType": "color",           // color | length
            "closeness":  0.61,             // 0 identical → 1 at threshold
            "tokens": [
              { "name": "--clr-ice",   "value": "#f4f4f4",
                "selector": ":root", "atScope": null, "file": "…", "line": 1 },
              { "name": "--clr-water", "value": "#eef0f5",
                "selector": ":root", "atScope": null, "file": "…", "line": 1 }
            ] }
        ]
      },

      // AXIS 8 (slice #25): promotable house rules. Inferred norms the audit does
      // NOT enforce by default — offered as candidates a human may `promote` into
      // the conventions file. Each carries the exact violation set strict
      // enforcement WOULD raise (the curation preview / blast radius). Off by
      // default: a candidate enforces nothing until promoted. `allowed` is frozen
      // into the rule at promote time. Kinds so far: `naming-prefix` (the global
      // tier's recurring category prefixes as a CLOSED vocabulary).
      "houseRuleCandidates": [
        { "rule": "naming-prefix:global",   // stable rule id (kind:tier)
          "kind": "naming-prefix",
          "tier": "global",
          "title": "Global tokens use a recurring category prefix",
          "allowed": [ "clr", "space", "text" ],   // the recurring vocabulary (frozen on promote)
          "violationCount": 1,
          "violations": [
            { "name": "--zzz-odd", "prefix": "zzz",
              "locations": [ { "selector": ":root", "atScope": null, "file": "…", "line": 1 } ] }
          ] }
      ]
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
          // cascadeScope (#21): root | theme | component — this definition's place
          // in the cascade (see the scope & cascade axis).
          { "value": "#e91e63", "scope": ":root", "atScope": null, "cascadeScope": "root", "file": "assets/jbdn.css", "line": 1 }
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
      "id":          "F1",             // render-order id (NOT stable across runs)
      "type":        "dead-token",     // dead-token | exact-duplicate | naming-* | tier-leak | cascade-smell | literal-hardcode | near-duplicate | house-rule
      "subject":     "--clr-blue",     // the finding's identity within its type
      "fingerprint": "dead-token:--clr-blue", // STABLE `type:subject` — the conventions key (#24)
      "basis":       "universal",      // universal | convention | house-rule (#25 — a PROMOTED rule)
      "confidence":  "medium",         // high | medium | low
      "disposition": "open",           // open (uncurated) | accept | fix — set from the conventions file
      "suppressed":  false,            // true when disposition==accept — excluded from findingCount + main report listing
      "note":        null,             // the human's note from the conventions file, if any
      "title":       "Dead token `--clr-blue` — defined but never referenced",
      // Each location leads with the selector (the defining scope here) so it
      // stays useful on minified CSS where line is always 1.
      "locations":   [ { "selector": ":root", "atScope": null, "file": "assets/jbdn.css", "line": 1 } ],
      "evidence":    "…why this was flagged, in plain words."
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
| `cascade-smell` (shadowed) | universal | `high` | The same token defined ≥2× under the **identical** (selector, at-rule) scope with **differing values** — source order alone decides, so the earlier definition can never win (dead code). Provable from the AST. Complement of `exact-duplicate` (identical value); a **different** scope is a legitimate override, not this. |
| `cascade-smell` (stray override) | convention | `low` | A **global/root** token redefined **inside a component** — a local meaning that fights the global cascade. **Only** flagged where theming is the codebase's own override norm (globals otherwise re-scoped only via theme variants); cites the share. Silent where local/component overriding is the house style (wattage). Low confidence: a local override may be deliberate. |
| `literal-hardcode` | universal | `medium` | A hardcoded literal whose **normalized value** equals an existing token's value — a missed tokenization. Matching keys off the normalized value (`#f00` matches a token holding `#ffffff`) and is restricted to distinctive types (colour, non-zero length); a bare `0`/`1`/keyword is too generic. Cites the matched token(s). Medium: the literal may be a coincidence. |
| `near-duplicate` | universal | `high`\|`medium`\|`low` | A cluster of tokens whose raw values are **nearly** (not exactly) the same — a consolidation lead. Per-value-type proximity: colour distance in RGBA, numeric relative proximity for lengths. Restricted to distinctive values (a colour, or a non-zero size-unit length) so coincidental `1fr`/`100%`/keyword matches don't fire. Confidence tracks **closeness** — an identical/near-exact cluster is high, one approaching the type threshold is low (the further apart, the likelier the difference is intentional). |
| `house-rule` | house-rule | `high` | A violation of a **promoted** house rule (#25) — an inferred norm a human enshrined via the conventions file (`promote` disposition). Off by default: raised **only** where the conventions file carries the rule. `subject` is `<ruleId>:<token>`; `basis` is always `house-rule`. Deterministic given the rule, so confidence is high. Vanilla runs (no conventions) never raise one. |

`convention`-basis findings **cite the norm** they're measured against, per the PRD.
`house-rule`-basis findings are raised by a norm the human **opted into** via `promote`.

## Conventions file (the propose/dispose feedback loop, #24 · #25)

The audit *proposes* findings; a human *disposes* of each one. Dispositions
persist to a **versioned, human-readable conventions file** — the audit's **4th
input** (alongside the CSS tree, the CLI flags, and `notes.md`). It is the only
new **human-editable** input; `audit.json` and the report stay **generated**.

Three dispositions, narrow → broad:

- **`accept`** — a local exception; suppress **this instance** of the finding
  (`suppressed: true`, excluded from `findingCount` and the main report listing,
  shown under "Accepted exceptions"). Narrow — it keys on the exact fingerprint.
- **`fix`** — a real problem; leave it flagged (a refactor lead). Recorded so the
  triage is complete/auditable, but it does not change surfacing.
- **`promote`** (#25) — the broadest: enshrine an inferred-but-unenforced **norm**
  as a **house rule**. Unlike accept/fix (which key on a finding fingerprint),
  promote keys on a **rule id** from `model.axes.houseRuleCandidates` — because
  the promotable norms are exactly the ones the audit keeps quiet by default. On
  re-run the rule is enforced: a `basis: house-rule` finding is raised per
  violation. Broad and dangerous — enforcing raises **new** violations elsewhere
  — so `curate` shows a **preview** of that blast radius and persists the rule
  **only** with `--confirm`. Off by default (opt-in): a fresh conventions file
  has none.

accept/fix key on a finding's **stable `fingerprint`** (`type:subject`), never its
render-order `Fn` id — so an accepted finding stays matched as other findings come
and go. Re-running the audit with `--conventions <file>` reads it: accepted
instances stay quiet, promoted rules are enforced, everything else re-surfaces.

```jsonc
{
  "conventionsVersion": "1.0.0",       // versioned contract (CONVENTIONS_VERSION)
  "project": "jbdn",
  "dispositions": {                    // accept/fix — keyed by finding fingerprint
    "dead-token:--clr-blue": {
      "disposition": "accept",         // accept | fix
      "note":        "deliberate public-API token",  // optional human note
      "title":       "Dead token `--clr-blue` …",    // finding title for context
      "recordedAt":  "2026-07-10"
    }
  },
  "houseRules": {                      // promote — keyed by rule id (#25)
    "naming-prefix:global": {
      "kind":       "naming-prefix",
      "tier":       "global",
      "allowed":    [ "clr", "space", "text" ],   // frozen vocabulary at promote time
      "title":      "Global tokens use a recurring category prefix",
      "note":       "our category-prefix house style",  // optional
      "recordedAt": "2026-07-10"
    }
  }
}
```

Written/updated by `curate` (`conventions.mjs`), which **merges** — it never
clobbers prior human decisions on other findings or rules. A rendered
`conventions.md` companion view is optional (`--md`). The JSON stays the source of
truth.

```
# accept / fix
node conventions.mjs --conventions conventions.json --audit audit.json \
     --accept <fingerprint> --note "why" [--fix <fingerprint>]... [--md conventions.md]

# promote — preview the blast radius; add --confirm to persist
node conventions.mjs --conventions conventions.json --audit audit.json \
     --promote <ruleId> [--note "why"] [--confirm] [--md conventions.md]
```

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

- `scripts/analyze.mjs` — parser + graph + all axes + findings → `audit.json`; reads the conventions file (`--conventions`) as the 4th input.
- `scripts/build_report.mjs` — renders `audit.json` → Markdown (refuses incompatible major).
- `scripts/conventions.mjs` — the propose/dispose feedback loop: `loadConventions` / `applyConventions` (read by analyze) + the `curate` CLI (`recordDispositions` for accept/fix, `promoteRule` / `previewHouseRule` for promote, `renderConventions`).
- `notes-template.md` — copied to `notes.md` by `init`; a human-editable input.
