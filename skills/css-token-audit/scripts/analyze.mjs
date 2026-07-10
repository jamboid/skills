#!/usr/bin/env node
/**
 * css-token-audit — analyzer (walking skeleton, slice #18).
 *
 * Reverse-engineers a project's CSS custom-property architecture from a
 * DETERMINISTIC parse (css-tree AST) — never by reading CSS by eye. Globs the
 * compiled CSS, extracts the custom-property dependency graph as structured
 * facts, computes the fan-in / fan-out axis, and emits the two cheapest
 * `universal` findings: dead tokens and exact-duplicate definitions.
 *
 * Output is `audit.json` — the single generated source of truth, carrying a
 * mandatory `schemaVersion` (the shared contract). See ../REFERENCE.md.
 *
 * Usage:
 *   node analyze.mjs --root <dir> [--slug <slug>] [--out <audit.json>]
 *                    [--exclude <glob-substr>]... [--top <n>]
 *
 * The analyzer is fully deterministic: given the same CSS it emits the same
 * audit.json. Later slices layer model judgment (naming, tiers, …) on top of
 * the facts this embeds.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';
import * as csstree from 'css-tree';

export const SCHEMA_VERSION = '1.0.0';

// ── CLI ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { root: null, slug: null, out: null, exclude: [], top: 15 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = argv[++i];
    else if (a === '--slug') args.slug = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--exclude') args.exclude.push(argv[++i]);
    else if (a === '--top') args.top = Number(argv[++i]);
    else if (!args.root) args.root = a;
  }
  return args;
}

const DEFAULT_EXCLUDES = ['node_modules', '.git', '.cache'];

/** Recursively collect .css files under root, skipping excluded path fragments. */
function findCssFiles(root, excludes) {
  const out = [];
  const skip = [...DEFAULT_EXCLUDES, ...excludes];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (skip.some((s) => full.includes(s))) continue;
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith('.css')) out.push(full);
    }
  }
  walk(root);
  return out.sort();
}

/** Normalize a selector/at-rule prelude for grouping (collapse whitespace). */
function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** True when a selector attaches to a component (has a class), vs a root/theme
 *  scope (`:root`, `[data-theme=…]`, `html`). */
function isComponentScope(scope) {
  return /\.[a-zA-Z_-]/.test(scope || '');
}

/** Component scope for the cascade axis — broader than `isComponentScope`:
 *  also matches attribute-class selectors (`[class*=b_prose]`) that name a
 *  block without a literal `.`. Kept separate so the coarse naming/layering
 *  `tier` split (which reads `isComponentScope`) is unchanged. */
function isComponentSelector(scope) {
  return isComponentScope(scope) || /\[class[*^$~|]?=/.test(scope || '');
}

/** A root-level VARIANT selector — a conditional re-scoping of root tokens for a
 *  theme/state (`[data-theme=dark]`, `.dark`, `.theme-x`, `:root[data-…]`),
 *  distinct from an unconditional `:root`/`html`. */
function isVariantSelector(scope) {
  const s = scope || '';
  return /\[data-[a-z-]*(theme|mode|scheme|color)/i.test(s) ||
    /(^|\s|:root)\.(dark|light|theme[\w-]*)\b/i.test(s) || /:root\s*\[/.test(s);
}

/**
 * Classify one definition by the cascade scope it lives in (scope & cascade
 * axis, #21) — statically, from the selector plus any enclosing @-rule:
 *   component — under a component/block selector (a class or `[class*=…]`)
 *   theme     — root-level but CONDITIONAL: a variant selector, or gated by an
 *               @-rule (`@media prefers-color-scheme`, a breakpoint, …)
 *   root      — an unconditional `:root`/`html` base value
 * A token with definitions in several of these is being overridden (see
 * buildScopeCascadeAxis).
 */
function classifyCascadeScope(def) {
  if (isComponentSelector(def.scope)) return 'component';
  if (def.atScope || isVariantSelector(def.scope)) return 'theme';
  return 'root';
}

/**
 * COARSE tier split — `global` (defined only at root/theme scope) vs `block`
 * (defined under any component selector). Deliberately shallow: full
 * primitive/semantic/component tiering is #20. The naming axis needs *some*
 * tier to infer a grammar per tier, and this is free from the scope facts.
 */
function classifyTier(definitions) {
  if (!definitions.length) return null;
  return definitions.some((d) => isComponentScope(d.scope)) ? 'block' : 'global';
}

/**
 * DEEP tier (layer) — reconstructed from the graph, not from names. This is the
 * layering axis (#20): where a token sits in the primitive → semantic →
 * component flow.
 *   primitive — global scope, holds a raw value (references no other token)
 *   semantic  — global scope, aliases another token (fan-out ≥ 1)
 *   component — defined under a component selector (block-local)
 * Orthogonal to the coarse `tier` (global/block), which the naming axis reads:
 * `global` splits into primitive + semantic by graph position; `block` maps to
 * component. Null for a token with no definitions (a dangling reference).
 */
function classifyLayer(coarseTier, fanOut) {
  if (coarseTier == null) return null;
  if (coarseTier === 'block') return 'component';
  return fanOut === 0 ? 'primitive' : 'semantic';
}

const LAYER_RANK = { primitive: 0, semantic: 1, component: 2 };

// ── Value normalization (the substrate #22 adds; #23 extends to fuzzy) ──────
// Named CSS colors we recognise for TYPING a value (not exhaustive — enough to
// tell a colour literal from an identifier). Exact literal↔token matching keys
// off the normalized string, so a named colour only ever matches another spelt
// the same way; this set just steers value-type classification.
const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'black', 'white', 'red', 'green', 'blue',
  'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'cyan', 'magenta',
  'silver', 'gold', 'navy', 'teal', 'olive', 'maroon', 'lime', 'aqua',
  'fuchsia', 'brown', 'beige', 'coral', 'crimson', 'indigo', 'violet',
]);

const LENGTH_UNIT = /(px|rem|em|vh|vw|vmin|vmax|%|pt|pc|ch|ex|fr|deg|rad|turn|s|ms)/;

/**
 * Classify a declaration value by type — `color` | `length` | `number` |
 * `other` — so a match/near-match can be judged per type (#22 exact, #23 fuzzy).
 * Single-value only: a compound value (`0 0 2px #000`) is `other` here.
 */
export function valueType(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(v) || /^(rgba?|hsla?)\(/.test(v) || NAMED_COLORS.has(v))
    return 'color';
  if (new RegExp(`^-?(\\d+\\.?\\d*|\\.\\d+)${LENGTH_UNIT.source}$`).test(v)) return 'length';
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(v)) return 'number';
  return 'other';
}

/**
 * Canonicalize a declaration value so equal values compare equal: lowercase,
 * whitespace collapsed, spaces around commas dropped, and short hex expanded to
 * long (`#f00` → `#ff0000`). Applied to BOTH a token's value and a literal, so
 * only consistency matters — aggressiveness is safe (this is never rendered).
 * The exact-match key for literal↔token findings, and #23's near-match input.
 */
export function normalizeValue(raw) {
  let v = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',');
  const m = /^#([0-9a-f]{3,4})$/.exec(v);
  if (m) v = '#' + [...m[1]].map((c) => c + c).join('');
  return v;
}

// ── Value distance (the near-duplicate substrate #23 adds) ─────────────────
// Basic named colours we can resolve to RGB — enough to let a `white`/`black`
// token cluster with a near-identical hex. Steers ONLY distance; typing still
// uses the broader NAMED_COLORS set above.
const NAMED_COLOR_HEX = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', navy: '#000080',
  teal: '#008080', olive: '#808000', maroon: '#800000', lime: '#00ff00',
  aqua: '#00ffff', cyan: '#00ffff', fuchsia: '#ff00ff', magenta: '#ff00ff',
};

/**
 * Parse a colour literal to `{ r, g, b, a }` (channels 0–255, alpha 0–1), or
 * null if it isn't a colour we can resolve. Handles hex (`#rgb`/`#rgba`/`#rrggbb`
 * /`#rrggbbaa`), functional `rgb()/rgba()` (integer channels), and the basic
 * named colours — enough to measure how far apart two colours are for clustering.
 */
export function parseColor(raw) {
  let v = normalizeValue(raw); // lowercases, expands short hex
  if (NAMED_COLOR_HEX[v]) v = NAMED_COLOR_HEX[v];
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: hex[2] != null ? parseInt(hex[2], 16) / 255 : 1 };
  }
  const fn = /^(rgba?)\(([^)]+)\)$/.exec(v);
  if (fn) {
    const parts = fn[2].split(',').map((s) => s.trim());
    if (parts.length < 3 || parts.some((p) => p.includes('%'))) return null; // integer channels only
    const [r, g, b] = parts.slice(0, 3).map((p) => parseInt(p, 10));
    if ([r, g, b].some((x) => Number.isNaN(x))) return null;
    const a = parts[3] != null ? parseFloat(parts[3]) : 1;
    return { r, g, b, a: Number.isNaN(a) ? 1 : a };
  }
  return null;
}

/** Euclidean distance between two colours in RGBA space (alpha scaled to 0–255).
 *  Infinity if either isn't a resolvable colour. 0 = identical. */
export function colorDistance(a, b) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return Infinity;
  const dr = ca.r - cb.r, dg = ca.g - cb.g, db = ca.b - cb.b, da = (ca.a - cb.a) * 255;
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/** Split a length literal into `[number, unit]` (unit '' for a bare number). */
function splitLength(raw) {
  const m = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/.exec((raw || '').trim().toLowerCase());
  return m ? [parseFloat(m[1]), m[2]] : [NaN, ''];
}

/** Relative difference of two numbers, 0 (equal) → 1+ (far apart). */
function relDiff(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale === 0 ? 0 : Math.abs(a - b) / scale;
}

/** Normalized Levenshtein distance (0 identical → 1 wholly different). */
function fuzzyDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return 1;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n] / Math.max(m, n);
}

// Per-value-type default thresholds — the closeness at/under which two values
// are "near-duplicate". Colour is an RGBA Euclidean distance (0–~442); length /
// number are RELATIVE differences; `other` is a normalized edit distance. Later
// slices make these tunable via the conventions file (out of scope for #23).
const NEAR_THRESHOLDS = { color: 12, length: 0.03, number: 0.03, other: 0.12 };

/**
 * Distance between two values of the SAME type, or null when they're
 * incomparable (different types, or lengths in different units). Returns
 * `{ type, distance, threshold }`; `distance <= threshold` means near-duplicate.
 * The per-type normalization the near-duplicate axis (#23) clusters on.
 */
// Absolute/relative SIZE units — a near-duplicate on one of these is a real
// scale-value lead. Layout-structural units (`%`, `fr`) and time/angle units
// are deliberately excluded: two tokens both `1fr` or `100%` share a value by
// coincidence of layout, not a redundant scale step worth consolidating.
const SIZE_UNITS = new Set(['px', 'rem', 'em', 'pt', 'pc', 'ch', 'ex', 'vh', 'vw', 'vmin', 'vmax']);

/**
 * Gate a value into near-duplicate clustering — restricted to the DISTINCTIVE
 * types where a near-match is a genuine consolidation lead: a colour, or a
 * non-zero length in a size unit. Bare numbers, `0`s, percentages/fractions, and
 * keyword/compound values (`block`, `1fr`, `clamp(…)`) share values coincidentally
 * and only add noise (verified on both test beds). `valueDistance` itself still
 * handles every type — this just keeps the clustering output high-signal.
 */
function isClusterableValue(raw) {
  const type = valueType(raw);
  if (type === 'color') return true;
  if (type === 'length') {
    const [n, unit] = splitLength(raw);
    return !Number.isNaN(n) && n !== 0 && SIZE_UNITS.has(unit);
  }
  return false;
}

export function valueDistance(a, b) {
  const ta = valueType(a);
  if (ta !== valueType(b)) return null;
  if (ta === 'color') {
    const d = colorDistance(a, b);
    return d === Infinity ? null : { type: 'color', distance: d, threshold: NEAR_THRESHOLDS.color };
  }
  if (ta === 'length') {
    const [na, ua] = splitLength(a);
    const [nb, ub] = splitLength(b);
    if (ua !== ub || Number.isNaN(na) || Number.isNaN(nb)) return null; // units must match
    return { type: 'length', distance: relDiff(na, nb), threshold: NEAR_THRESHOLDS.length };
  }
  if (ta === 'number') {
    return { type: 'number', distance: relDiff(parseFloat(a), parseFloat(b)), threshold: NEAR_THRESHOLDS.number };
  }
  return { type: 'other', distance: fuzzyDistance((a || '').trim().toLowerCase(), (b || '').trim().toLowerCase()), threshold: NEAR_THRESHOLDS.other };
}

// Properties whose values are the ones a token system typically governs —
// colour, spacing, borders, typography, motion. The coverage axis measures how
// many of THESE consume a token vs a raw literal; other properties (`display`,
// `position`, `flex`) aren't tokenizable in this sense and are excluded so the
// ratio isn't diluted by declarations no token scheme would cover.
const TOKENIZABLE = new Set([
  'color', 'background', 'background-color', 'border-color', 'outline-color',
  'fill', 'stroke', 'box-shadow', 'text-shadow', 'caret-color', 'accent-color',
  'text-decoration-color', 'column-rule-color', 'border', 'border-top',
  'border-right', 'border-bottom', 'border-left', 'border-top-color',
  'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-width', 'border-radius', 'outline', 'column-rule',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'inset',
  'font-size', 'line-height', 'font-weight', 'letter-spacing', 'font-family',
  'transition', 'transition-duration', 'animation-duration',
]);

/** True when a property's value is one a token scheme typically governs (see
 *  TOKENIZABLE) — the coverage axis only weighs these. */
function isTokenizableProperty(property) {
  return TOKENIZABLE.has((property || '').toLowerCase());
}

/** A value distinctive enough to implicate a token when it appears as a raw
 *  literal: a colour, or a non-zero length. Bare numbers, `0`-lengths, and
 *  keywords (`none`, `inherit`) are too generic — matching them is noise. */
function isMatchableLiteral(raw) {
  const type = valueType(raw);
  if (type === 'color') return true;
  if (type === 'length') return parseFloat((raw || '').trim()) !== 0;
  return false;
}

/** Split a custom-property name into its grammar segments: `--nav-link-bg`
 *  → ['nav','link','bg']. Empty segments (from `--`, `--x--y`) dropped. */
function segmentName(name) {
  return name.replace(/^--/, '').split('-').filter(Boolean);
}

/** First path segment of a relative file path (its top-level tree). */
function topDir(file) {
  const i = file.indexOf('/');
  return i === -1 ? '.' : file.slice(0, i);
}

/**
 * Detect source+build "tree doubling": the same project's CSS audited twice
 * because `--root` spanned both an authored tree and its compiled output. The
 * tell is the SAME token defined with an IDENTICAL value under two different
 * top-level dirs, at scale. This is a distinct failure from a parse error — it
 * can happen silently on all-valid plain CSS — so it earns its own warning.
 * The skill does not auto-resolve it: the fix (pick one tree) is the user's.
 */
function detectDoubling(defs, definedCount) {
  // Minified files (many custom-prop defs crammed onto one line) mark the tree
  // that is almost certainly the compiled build.
  const perFileLines = new Map();
  for (const d of defs) {
    if (!perFileLines.has(d.file)) perFileLines.set(d.file, new Map());
    const m = perFileLines.get(d.file);
    m.set(d.line, (m.get(d.line) || 0) + 1);
  }
  const minifiedDirs = new Set();
  for (const [file, lines] of perFileLines) {
    const maxOnLine = Math.max(...lines.values());
    const total = [...lines.values()].reduce((a, b) => a + b, 0);
    if (maxOnLine >= 5 || (total >= 10 && lines.size <= 2)) minifiedDirs.add(topDir(file));
  }

  // Count tokens defined with an identical value across each pair of top dirs.
  const byName = new Map();
  for (const d of defs) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name).push(d);
  }
  const pairTokens = new Map(); // "dirA||dirB" -> Set<tokenName>
  for (const [name, ds] of byName) {
    const dirsByValue = new Map();
    for (const d of ds) {
      if (!dirsByValue.has(d.value)) dirsByValue.set(d.value, new Set());
      dirsByValue.get(d.value).add(topDir(d.file));
    }
    for (const dirs of dirsByValue.values()) {
      const arr = [...dirs].sort();
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++) {
          const key = `${arr[i]}||${arr[j]}`;
          if (!pairTokens.has(key)) pairTokens.set(key, new Set());
          pairTokens.get(key).add(name);
        }
    }
  }

  let best = null;
  for (const [key, names] of pairTokens) {
    if (!best || names.size > best.count) best = { key, count: names.size };
  }
  if (!best) return null;
  const share = definedCount ? best.count / definedCount : 0;
  // Systemic, not incidental: ≥3 tokens AND ≥25% of the token set.
  if (best.count < 3 || share < 0.25) return null;

  const [dirA, dirB] = best.key.split('||');
  const compiledDir = minifiedDirs.has(dirA) ? dirA : minifiedDirs.has(dirB) ? dirB : null;
  return {
    dirA,
    dirB,
    sharedTokens: best.count,
    share: Number(share.toFixed(2)),
    compiledDir, // which tree looks like the build, or null if neither is minified
  };
}

// ── Fact extraction (the deterministic AST pass) ───────────────────────────
/**
 * Parse one CSS file and push definitions + references into the accumulators.
 * A "definition" is a `--custom-property: value` declaration; a "reference" is
 * a `var(--x)` use anywhere in a value (including inside another token's value
 * and inside fallbacks).
 */
function extractFacts(css, relPath, defs, refs, parseErrors, decls = []) {
  let ast;
  try {
    ast = csstree.parse(css, {
      positions: true,
      filename: relPath,
      // Custom-property values are Raw by default (spec: `--x` holds arbitrary
      // tokens). Without this we'd never see a `var()` that lives inside another
      // token's value — every token-to-token edge, and most fan-in, would vanish.
      parseCustomProperty: true,
      onParseError(err) {
        parseErrors.push({ file: relPath, message: err.message });
      },
    });
  } catch (err) {
    parseErrors.push({ file: relPath, message: String(err.message || err) });
    return;
  }

  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      const line = node.loc ? node.loc.start.line : null;
      const value = csstree.generate(node.value).trim();
      const isCustomProp = node.property.startsWith('--');

      // Scope = enclosing selector prelude; atScope = enclosing @-rule prelude.
      const rule = this.rule;
      const scope = rule && rule.prelude ? norm(csstree.generate(rule.prelude)) : '(root-less)';
      const atrule = this.atrule;
      const atScope = atrule
        ? norm(`@${atrule.name} ${atrule.prelude ? csstree.generate(atrule.prelude) : ''}`)
        : null;

      if (isCustomProp) {
        defs.push({ name: node.property, value, scope, atScope, file: relPath, line });
      }

      // References: any var() inside this declaration's value.
      let declHasVar = false;
      csstree.walk(node.value, {
        visit: 'Function',
        enter(fn) {
          if (fn.name !== 'var') return;
          const first = fn.children && fn.children.first;
          if (!first || first.type !== 'Identifier') return;
          declHasVar = true;
          // Fallback = everything after the first Operator(',') inside var().
          const parts = fn.children ? fn.children.toArray() : [];
          const comma = parts.findIndex((c) => c.type === 'Operator' && c.value === ',');
          const fallback =
            comma === -1
              ? null
              : csstree.generate({ type: 'Value', children: parts.slice(comma + 1) }).trim();
          refs.push({
            name: first.name,
            owner: isCustomProp ? node.property : null, // token that references it, if any
            inProperty: node.property,
            scope, // the selector this var() is used under — survives minification
            atScope,
            fallback, // null (no fallback), or the fallback expression text
            file: relPath,
            line: fn.loc ? fn.loc.start.line : line,
          });
        },
      });

      // Coverage subject: an ORDINARY declaration on a tokenizable property (a
      // custom-property definition is a token, not a coverage subject). `hasVar`
      // = it consumes a token; otherwise it holds a raw literal.
      if (!isCustomProp && isTokenizableProperty(node.property)) {
        decls.push({
          property: node.property.toLowerCase(),
          value,
          hasVar: declHasVar,
          scope,
          atScope,
          file: relPath,
          line,
        });
      }
    },
  });
}

/**
 * Roll a token's references up into the distinct selectors that consume it,
 * most-frequent first. This is the location signal that survives minification:
 * a compiled build collapses every line to 1, but the selector a `var()` sits
 * under is intact. A reference inside another token's value (owner set) is
 * attributed to `var --owner` rather than a page selector.
 */
function computeUsedIn(references) {
  const byKey = new Map();
  for (const r of references) {
    const selector = r.owner ? `var ${r.owner}` : r.scope;
    const key = `${r.atScope || ''}||${selector}`;
    if (!byKey.has(key)) byKey.set(key, { selector, atScope: r.atScope || null, count: 0 });
    byKey.get(key).count += 1;
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.selector.localeCompare(b.selector)
  );
}

// Known short/long spellings of the same concept. A tier using two forms of one
// concept (e.g. `hov` and `hover`) is internally inconsistent. Kept to
// unambiguous pairs — `col`/`c` (column? colour?) are omitted on purpose.
const ABBR_GROUPS = {
  hover: ['hover', 'hov', 'hvr'],
  active: ['active', 'act'],
  disabled: ['disabled', 'disable', 'dis'],
  focus: ['focus', 'foc'],
  background: ['background', 'bg'],
  color: ['color', 'colour', 'clr'],
  border: ['border', 'brd'],
  small: ['small', 'sm'],
  medium: ['medium', 'med', 'md'],
  large: ['large', 'lg'],
  default: ['default', 'def', 'dflt'],
  primary: ['primary', 'prim'],
  secondary: ['secondary', 'sec'],
  button: ['button', 'btn'],
  vertical: ['vertical', 'vert'],
  horizontal: ['horizontal', 'horiz'],
  padding: ['padding', 'pad'],
  transition: ['transition', 'trans'],
};
const FORM_TO_CONCEPT = new Map();
for (const [concept, forms] of Object.entries(ABBR_GROUPS))
  for (const f of forms) FORM_TO_CONCEPT.set(f, concept);

/** Concepts spelled ≥2 ways within a tier (naming inconsistency). */
function tierAbbreviationConflicts(toks) {
  const concepts = new Map(); // concept -> Map(form -> tokenNames[])
  for (const t of toks) {
    for (const seg of t.segments) {
      const c = FORM_TO_CONCEPT.get(seg);
      if (!c) continue;
      if (!concepts.has(c)) concepts.set(c, new Map());
      const forms = concepts.get(c);
      if (!forms.has(seg)) forms.set(seg, []);
      forms.get(seg).push(t.name);
    }
  }
  const conflicts = [];
  for (const [concept, forms] of concepts) {
    if (forms.size < 2) continue;
    const arr = [...forms]
      .map(([form, names]) => ({ form, count: names.length, tokens: names }))
      .sort((a, b) => b.count - a.count || a.form.localeCompare(b.form));
    conflicts.push({ concept, forms: arr });
  }
  return conflicts;
}

/** Per-tier grammar summary: prefix vocabulary, segment-length shape, and a
 *  consistency measure (share of tokens whose first segment is a recurring
 *  category/namespace prefix). */
function summariseTierGrammar(toks, template) {
  const firstSeg = new Map();
  const segLen = new Map();
  for (const t of toks) {
    const p = t.segments[0] ?? '(none)';
    firstSeg.set(p, (firstSeg.get(p) || 0) + 1);
    segLen.set(t.segments.length, (segLen.get(t.segments.length) || 0) + 1);
  }
  const prefixes = [...firstSeg]
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));
  const recurring = prefixes.filter((p) => p.count >= 2).map((p) => p.prefix);
  const singletons = prefixes.filter((p) => p.count === 1).map((p) => p.prefix);
  const conforming = toks.filter((t) => recurring.includes(t.segments[0])).length;
  const dominantSegmentCount =
    [...segLen].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
  return {
    template,
    tokenCount: toks.length,
    prefixes,
    recurringPrefixes: recurring,
    singletonPrefixes: singletons,
    dominantSegmentCount,
    consistency: toks.length ? Number((conforming / toks.length).toFixed(2)) : 0,
  };
}

/** The naming axis: an inferred grammar per tier. */
function buildNamingAxis(defined) {
  const byTier = { global: [], block: [] };
  for (const t of defined) if (byTier[t.tier]) byTier[t.tier].push(t);
  const tier = (toks, template) => ({
    ...summariseTierGrammar(toks, template),
    abbreviationConflicts: tierAbbreviationConflicts(toks),
  });
  return {
    tiers: {
      global: tier(byTier.global, '--{category}-{role}[-{variant}]'),
      block: tier(byTier.block, '--{block}-{part}[-{state}]'),
    },
  };
}

/**
 * The layering axis (#20): reconstruct the tier system from the graph and
 * measure how value flows through it. Tiers rank primitive(0) → semantic(1) →
 * component(2); a healthy reference points DOWN-tier (a component's value holds
 * `var(--semantic)`, a semantic's holds `var(--primitive)`). An edge pointing
 * up-tier leaks; a token in a `var()` cycle leaks universally.
 *
 * `defined` are the tokens with ≥1 definition; `byName` resolves a referenced
 * name to its token (to read the referenced token's layer).
 */
function buildLayeringAxis(defined, byName) {
  const tierNames = ['primitive', 'semantic', 'component'];
  const tiers = {};
  for (const name of tierNames) tiers[name] = { tokenCount: 0, tokens: [] };
  for (const t of defined) {
    if (!tiers[t.layer]) continue;
    tiers[t.layer].tokenCount += 1;
    tiers[t.layer].tokens.push(t.name);
  }
  for (const name of tierNames) tiers[name].tokens.sort();
  const tierCount = tierNames.filter((n) => tiers[n].tokenCount > 0).length;

  // Classify every token→token edge by the tiers it connects.
  let healthy = 0; // points strictly down-tier
  let backward = 0; // points up-tier — a leak
  let skip = 0; // down-tier but jumps a tier (e.g. component → primitive)
  let lateral = 0; // same tier (semantic→semantic, component→component)
  let throughSemantic = 0; // down-tier refs that route via a semantic token
  let directToPrimitive = 0; // down-tier refs that hit a primitive directly
  const skipEdges = [];
  const backwardEdges = [];
  for (const t of defined) {
    const from = LAYER_RANK[t.layer];
    if (from == null) continue;
    for (const refName of t.referencedTokens) {
      const ref = byName.get(refName);
      if (!ref || ref.layer == null) continue; // dangling / unclassified
      const to = LAYER_RANK[ref.layer];
      if (to > from) {
        backward += 1;
        backwardEdges.push({ from: t.name, to: refName });
      } else if (to === from) {
        lateral += 1;
      } else {
        healthy += 1;
        // The routing norm is about COMPONENT tokens only: does a component
        // route through a semantic, or reach for a primitive directly? A
        // semantic→primitive edge is the semantic tier doing its job, not a
        // routing choice, so it's excluded from the norm.
        if (from === LAYER_RANK.component) {
          if (to === LAYER_RANK.semantic) throughSemantic += 1;
          else if (to === LAYER_RANK.primitive) directToPrimitive += 1;
        }
        if (from - to >= 2) {
          skip += 1;
          skipEdges.push({ from: t.name, to: refName });
        }
      }
    }
  }

  // Is routing a down-tier reference THROUGH a semantic token the norm here, or
  // is referencing a primitive directly the norm? A skip only leaks against a
  // semantic-routing norm (see buildFindings). On a codebase that routes
  // directly (both test beds do), skips are the house style, not a smell.
  const routed = throughSemantic + directToPrimitive;
  const norm = routed === 0 ? 'none' : throughSemantic > directToPrimitive ? 'semantic' : 'direct';

  const cycles = findReferenceCycles(defined, byName);
  const direction = cycles.length ? 'circular' : backward > 0 ? 'mixed' : 'downward';

  return {
    tiers,
    tierCount,
    flow: {
      edges: healthy + backward + lateral,
      healthy,
      backward,
      skip,
      lateral,
      throughSemantic,
      directToPrimitive,
      norm,
      direction,
    },
    leaks: { backwardEdges, skipEdges, cycles },
  };
}

/**
 * Find `var()` reference cycles among defined tokens (A → … → A). Returns each
 * cycle once as an array of token names (the loop, first node repeated implied).
 * A cycle is a `basis: universal` leak — a value that can never resolve.
 */
function findReferenceCycles(defined, byName) {
  const cycles = [];
  const seen = new Set(); // canonical cycle keys already recorded
  const state = new Map(); // name -> 'visiting' | 'done'
  const stack = [];

  function visit(name) {
    const t = byName.get(name);
    if (!t || t.layer == null) return; // only walk defined tokens
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') {
      const at = stack.indexOf(name);
      if (at === -1) return;
      const loop = stack.slice(at);
      const key = [...loop].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(loop);
      }
      return;
    }
    state.set(name, 'visiting');
    stack.push(name);
    for (const ref of t.referencedTokens) visit(ref);
    stack.pop();
    state.set(name, 'done');
  }

  for (const t of defined) visit(t.name);
  return cycles;
}

/**
 * The scope & cascade axis (#21): where each token is defined in the cascade,
 * where it gets overridden, and how theming is wired — all statically, from the
 * selector + @-rule structure (no headless browser).
 *
 * A token's HOME scope is root if it has any unconditional `:root` base, else
 * component, else theme. A token with definitions in more than one scope (or
 * under more than one condition) is being OVERRIDDEN; each override site is
 * classified by kind:
 *   theme     — a root base re-defined by conditional root variants (healthy
 *               theming: `[data-theme]`, `@media prefers-color-scheme`, …)
 *   component — a root/global base re-defined INSIDE a component (a global
 *               token given a different meaning locally — the notable smell)
 *   local     — no root base; defined across several component scopes
 */
function buildScopeCascadeAxis(defined) {
  const scopes = { root: 0, theme: 0, component: 0 };
  for (const t of defined) {
    const kinds = new Set(t.definitions.map((d) => d.cascadeScope));
    const home = kinds.has('root') ? 'root' : kinds.has('component') ? 'component' : 'theme';
    scopes[home] += 1;
  }

  const pick = (d) => ({
    selector: d.scope,
    atScope: d.atScope,
    cascadeScope: d.cascadeScope,
    value: d.value,
    file: d.file,
    line: d.line,
  });
  const sites = [];
  let themeVariants = 0;
  let componentOverrides = 0;
  let localMultiScope = 0;
  for (const t of defined) {
    if (t.definitions.length < 2) continue;
    const kinds = new Set(t.definitions.map((d) => d.cascadeScope));
    const hasRoot = kinds.has('root');
    let kind;
    if (hasRoot && kinds.has('component')) kind = 'component';
    else if (hasRoot && kinds.has('theme')) kind = 'theme';
    else kind = 'local';
    if (kind === 'theme') themeVariants += 1;
    else if (kind === 'component') componentOverrides += 1;
    else localMultiScope += 1;

    // Base = the unconditional root def if any, else the first definition.
    const base = t.definitions.find((d) => d.cascadeScope === 'root') || t.definitions[0];
    const overrides = t.definitions.filter((d) => d !== base);
    sites.push({ name: t.name, kind, base: pick(base), overrides: overrides.map(pick) });
  }
  sites.sort((a, b) => a.name.localeCompare(b.name));

  const counts = { theme: themeVariants, component: componentOverrides, local: localMultiScope };
  const total = themeVariants + componentOverrides + localMultiScope;
  const norm =
    total === 0
      ? 'none'
      : Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

  return {
    scopes,
    overrides: {
      tokenCount: sites.length,
      themeVariants,
      componentOverrides,
      localMultiScope,
      norm,
      sites,
    },
    theming: buildTheming(defined),
  };
}

/**
 * Static theming approximation: the CONDITIONS under which root-level tokens get
 * a theme variant, ranked by how many tokens each themes, plus a coarse `style`.
 * A theme def's condition is its enclosing @-rule if any (`@media prefers-color-
 * scheme:dark`), else the variant selector (`[data-theme=dark]`). No headless
 * browser — this is purely the selector/@-rule structure.
 */
function buildTheming(defined) {
  const byCondition = new Map(); // condition -> Set<tokenName>
  for (const t of defined) {
    for (const d of t.definitions) {
      if (d.cascadeScope !== 'theme') continue;
      const condition = d.atScope || d.scope;
      if (!byCondition.has(condition)) byCondition.set(condition, new Set());
      byCondition.get(condition).add(t.name);
    }
  }
  const mechanisms = [...byCondition]
    .map(([condition, names]) => ({ condition, tokenCount: names.size }))
    .sort((a, b) => b.tokenCount - a.tokenCount || a.condition.localeCompare(b.condition));
  const themed = new Set();
  for (const names of byCondition.values()) for (const n of names) themed.add(n);

  // Classify each mechanism into a family, then name the dominant style. `none`
  // only when nothing is themed; otherwise every themed mechanism lands in a
  // family, so `themedTokens > 0` never reads as `none`.
  const family = (c) =>
    /prefers-color-scheme/i.test(c) ? 'color-scheme'
      : isVariantSelector(c) ? 'data-attr'
        : /@media[^,]*(min-width|max-width)|@container/i.test(c) ? 'responsive'
          : /prefers-reduced-motion/i.test(c) ? 'motion'
            : 'other';
  const families = [...new Set(mechanisms.map((m) => family(m.condition)))];
  const style =
    families.length === 0 ? 'none' : families.length > 1 ? 'mixed' : families[0];

  return { mechanisms, themedTokens: themed.size, style };
}

/**
 * The coverage / hardcode axis (#22): over the tokenizable declarations, how
 * many consume a token (`var()`) vs hold a raw literal. `ratio` is the share
 * covered — 1.0 = every tokenizable value routes through a token. Coarse by
 * design: a literal `0` counts as hardcoded even where a token is unwarranted,
 * so read the ratio as a direction, not a grade. `topHardcodedProperties` ranks
 * the properties most often literal — the richest tokenization leads.
 */
function buildCoverageAxis(decls) {
  let covered = 0;
  let hardcoded = 0;
  const byProperty = new Map();
  for (const d of decls) {
    if (d.hasVar) covered += 1;
    else {
      hardcoded += 1;
      byProperty.set(d.property, (byProperty.get(d.property) || 0) + 1);
    }
  }
  const total = covered + hardcoded;
  const topHardcodedProperties = [...byProperty]
    .map(([property, count]) => ({ property, count }))
    .sort((a, b) => b.count - a.count || a.property.localeCompare(b.property))
    .slice(0, 10);
  return {
    tokenizableDeclarations: total,
    covered,
    hardcoded,
    ratio: total ? Number((covered / total).toFixed(2)) : 0,
    topHardcodedProperties,
  };
}

/**
 * The fallback-usage axis (#22): catalogue `var(--x, fallback)` patterns. A
 * fallback's kind tells what it implies —
 *   token   — the fallback is itself a `var()`: a chained dependency (the token
 *             graph doesn't model this second edge; worth surfacing)
 *   literal — a hardcoded default the token would otherwise supply
 *   empty   — `var(--x,)`: an explicit empty fallback (renders nothing if unset)
 * Purely a catalogue with counts + samples; no finding in this slice.
 */
function buildFallbackAxis(refs) {
  let withFallback = 0;
  const byKind = { token: 0, literal: 0, empty: 0 };
  const samples = [];
  for (const r of refs) {
    if (r.fallback == null) continue;
    withFallback += 1;
    const kind = r.fallback === '' ? 'empty' : /var\(/.test(r.fallback) ? 'token' : 'literal';
    byKind[kind] += 1;
    if (samples.length < 10)
      samples.push({ name: r.name, fallback: r.fallback, kind, scope: r.scope, file: r.file, line: r.line });
  }
  return {
    total: refs.length,
    withFallback,
    withoutFallback: refs.length - withFallback,
    byKind,
    samples,
  };
}

/**
 * The near-duplicate axis (#23): cluster DEFINED tokens whose raw values are
 * *nearly* the same — the juiciest consolidation leads. Each token contributes
 * one representative value (its unconditional root base, else its first
 * definition); alias tokens (a value that is itself a `var()`) are skipped —
 * they hold a reference, not a raw value. Tokens are grouped by value type, then
 * connected (union-find) when their pairwise `valueDistance` is within the
 * per-type threshold. A connected component of ≥2 tokens is a cluster.
 * `closeness` = worst pairwise distance ÷ threshold (0 = exact, 1 = at the edge).
 */
function buildNearDuplicateAxis(defined) {
  // One representative literal value per token.
  const nodes = [];
  for (const t of defined) {
    const base = t.definitions.find((d) => d.cascadeScope === 'root') || t.definitions[0];
    if (!base) continue;
    const value = base.value;
    if (/var\(/.test(value)) continue; // an alias, not a raw value
    if (!isClusterableValue(value)) continue; // keep clusters to distinctive values
    const type = valueType(value);
    nodes.push({ name: t.name, value, type, base });
  }

  const clusters = [];
  const byType = new Map();
  for (const n of nodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type).push(n);
  }

  for (const group of byType.values()) {
    // Union-find over the group; record the worst distance seen on any edge so
    // the cluster's closeness reflects its loosest pair.
    const parent = group.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (i, j) => { parent[find(i)] = find(j); };
    const edges = new Map(); // "root" -> max distance/threshold ratio seen
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const d = valueDistance(group[i].value, group[j].value);
        if (!d || d.distance > d.threshold) continue;
        union(i, j);
      }
    }
    // Second pass: attribute each near edge's ratio to its component root.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const d = valueDistance(group[i].value, group[j].value);
        if (!d || d.distance > d.threshold) continue;
        if (find(i) !== find(j)) continue;
        const root = find(i);
        const ratio = d.threshold ? d.distance / d.threshold : 0;
        edges.set(root, Math.max(edges.get(root) || 0, ratio));
      }
    }
    const comps = new Map();
    for (let i = 0; i < group.length; i++) {
      const root = find(i);
      if (!comps.has(root)) comps.set(root, []);
      comps.get(root).push(group[i]);
    }
    for (const [root, members] of comps) {
      if (members.length < 2) continue;
      members.sort((a, b) => a.name.localeCompare(b.name));
      clusters.push({
        valueType: members[0].type,
        closeness: Number((edges.get(root) || 0).toFixed(2)),
        tokens: members.map((m) => ({
          name: m.name,
          value: m.value,
          file: m.base.file,
          line: m.base.line,
          selector: m.base.scope,
          atScope: m.base.atScope,
        })),
      });
    }
  }

  clusters.sort(
    (a, b) => a.valueType.localeCompare(b.valueType) ||
      a.tokens[0].name.localeCompare(b.tokens[0].name)
  );
  return { clusterCount: clusters.length, clusters };
}

// ── Model + findings ───────────────────────────────────────────────────────
function buildModel(defs, refs, decls = []) {
  // Token registry keyed by name.
  const tokens = new Map();
  const tokenOf = (name) => {
    if (!tokens.has(name)) {
      tokens.set(name, {
        name,
        definitions: [],
        references: [],
        fanIn: 0,
        fanOut: 0,
        referencedTokens: new Set(),
      });
    }
    return tokens.get(name);
  };

  for (const d of defs) {
    tokenOf(d.name).definitions.push({
      value: d.value,
      scope: d.scope,
      atScope: d.atScope,
      cascadeScope: classifyCascadeScope(d),
      file: d.file,
      line: d.line,
    });
  }

  for (const r of refs) {
    const t = tokenOf(r.name); // referenced token (may be defined elsewhere or undefined)
    t.fanIn += 1;
    t.references.push({
      inProperty: r.inProperty,
      scope: r.scope,
      atScope: r.atScope,
      owner: r.owner,
      file: r.file,
      line: r.line,
    });
    if (r.owner) tokenOf(r.owner).referencedTokens.add(r.name);
  }

  for (const t of tokens.values()) {
    t.fanOut = t.referencedTokens.size;
    t.usedIn = computeUsedIn(t.references); // selectors that consume this token
    t.tier = classifyTier(t.definitions); // null for dangling (undefined) refs
    t.layer = classifyLayer(t.tier, t.fanOut); // primitive | semantic | component
    t.segments = segmentName(t.name);
  }

  // A token is "defined" if it has ≥1 definition. Referenced-but-undefined
  // names are surfaced separately (a dangling var reference).
  const defined = [...tokens.values()].filter((t) => t.definitions.length > 0);
  const undefinedRefs = [...tokens.values()].filter((t) => t.definitions.length === 0);

  const dead = defined.filter((t) => t.fanIn === 0).map((t) => t.name).sort();
  const oneOff = defined.filter((t) => t.fanIn === 1).map((t) => t.name).sort();
  const loadBearing = [...defined]
    .filter((t) => t.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn || a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      fanIn: t.fanIn,
      fanOut: t.fanOut,
      usedIn: t.usedIn.slice(0, 6), // sample of consuming selectors
      usedInCount: t.usedIn.length, // distinct consuming selectors
    }));

  const naming = buildNamingAxis(defined);
  const layering = buildLayeringAxis(defined, tokens);
  const scopeCascade = buildScopeCascadeAxis(defined);
  const coverage = buildCoverageAxis(decls);
  const fallback = buildFallbackAxis(refs);
  const nearDuplicates = buildNearDuplicateAxis(defined);

  return { tokens, defined, undefinedRefs, dead, oneOff, loadBearing, naming, layering, scopeCascade, coverage, fallback, nearDuplicates, decls };
}

/** Serialize the token registry to plain JSON (facts embedded for later slices). */
function serializeTokens(defined) {
  return [...defined]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      tier: t.tier,
      layer: t.layer,
      segments: t.segments,
      fanIn: t.fanIn,
      fanOut: t.fanOut,
      referencedTokens: [...t.referencedTokens].sort(),
      usedIn: t.usedIn,
      definitions: t.definitions,
      references: t.references,
    }));
}

function buildFindings(model) {
  const findings = [];
  let n = 0;
  const nextId = () => `F${++n}`;

  // Dead tokens (defined, never referenced). Universal: a property nothing
  // reads is dead weight. Confidence is `medium`, not high: static analysis
  // can't see consumption via inline styles or JS, and design-system tokens
  // may be a public API. The dispose loop (slice #24) is where the human
  // accepts such intentional exceptions.
  for (const name of model.dead) {
    const t = model.tokens.get(name);
    findings.push({
      id: nextId(),
      type: 'dead-token',
      basis: 'universal',
      confidence: 'medium',
      title: `Dead token \`${name}\` — defined but never referenced`,
      locations: t.definitions.map((d) => ({
        selector: d.scope,
        atScope: d.atScope,
        file: d.file,
        line: d.line,
      })),
      evidence: `${name} is defined ${t.definitions.length}× but has zero \`var()\` references in the parsed CSS. (Static scope: consumption via inline styles or JS is not visible.)`,
    });
  }

  // Exact-duplicate definitions in one scope: the same token defined ≥2× with
  // an identical value under the same (selector, at-rule) scope — pure
  // redundancy, provable from the AST. Differing values in one scope are a
  // redefinition/override (cascade axis, slice #21), not flagged here.
  for (const t of model.defined) {
    const groups = new Map();
    for (const d of t.definitions) {
      const key = `${d.atScope || ''}||${d.scope}||${d.value}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      findings.push({
        id: nextId(),
        type: 'exact-duplicate',
        basis: 'universal',
        confidence: 'high',
        title: `Exact-duplicate definition of \`${t.name}\` in one scope`,
        locations: group.map((d) => ({
          selector: d.scope,
          atScope: d.atScope,
          file: d.file,
          line: d.line,
        })),
        evidence: `${t.name} is defined ${group.length}× with the identical value \`${group[0].value}\` under scope \`${group[0].scope}\`${group[0].atScope ? ` (${group[0].atScope})` : ''} — the later definitions are redundant.`,
      });
    }
  }

  // Literal matches an existing token (coverage axis, #22). A hardcoded literal
  // whose NORMALIZED value equals a token's value is a missed tokenization —
  // universal (defensible anywhere). Matching keys off the normalized value so
  // `#f00` matches a token holding `#ff0000`. Restricted to distinctive value
  // types (colour, non-zero length): a bare `0`/`1`/`none` is too generic to
  // implicate a token. Medium confidence — the literal may be a coincidence.
  const valueIndex = new Map(); // normalized value -> Set<token name>
  for (const t of model.defined) {
    for (const d of t.definitions) {
      if (!isMatchableLiteral(d.value)) continue;
      const key = normalizeValue(d.value);
      if (!valueIndex.has(key)) valueIndex.set(key, new Set());
      valueIndex.get(key).add(t.name);
    }
  }
  const literalSites = new Map(); // normalized value -> declaration sites
  for (const d of model.decls) {
    if (d.hasVar || !isMatchableLiteral(d.value)) continue;
    const key = normalizeValue(d.value);
    if (!valueIndex.has(key)) continue;
    if (!literalSites.has(key)) literalSites.set(key, []);
    literalSites.get(key).push(d);
  }
  for (const [key, sites] of [...literalSites].sort((a, b) => a[0].localeCompare(b[0]))) {
    const tokenNames = [...valueIndex.get(key)].sort();
    const tokens = tokenNames.map((n) => `\`${n}\``).join(', ');
    findings.push({
      id: nextId(),
      type: 'literal-hardcode',
      basis: 'universal',
      confidence: 'medium',
      title: `Hardcoded \`${sites[0].value}\` matches existing token${tokenNames.length > 1 ? 's' : ''} ${tokens}`,
      locations: sites.map((d) => ({
        selector: d.scope,
        atScope: d.atScope,
        property: d.property,
        file: d.file,
        line: d.line,
      })),
      evidence:
        `${sites.length} declaration${sites.length === 1 ? '' : 's'} hardcode \`${sites[0].value}\`, ` +
        `whose value equals the existing token${tokenNames.length > 1 ? 's' : ''} ${tokens}` +
        ` — a missed tokenization. Replace the literal with \`var(${tokenNames[0]})\`.`,
    });
  }

  // Near-duplicate tokens (near-duplicate axis, #23). A cluster of tokens whose
  // raw values are nearly identical — a consolidation lead. Universal: two tokens
  // resolving to (essentially) the same value are redundant in any codebase.
  // Confidence reflects CLOSENESS: an exact/near-exact cluster is high, a looser
  // one (approaching the type threshold) is lower — the further apart, the more
  // likely the difference is intentional.
  for (const cluster of model.nearDuplicates.clusters) {
    const confidence = cluster.closeness <= 0.34 ? 'high' : cluster.closeness <= 0.67 ? 'medium' : 'low';
    const names = cluster.tokens.map((t) => `\`${t.name}\``).join(', ');
    const pairs = cluster.tokens.map((t) => `\`${t.name}\` (${t.value})`).join(', ');
    findings.push({
      id: nextId(),
      type: 'near-duplicate',
      basis: 'universal',
      confidence,
      title: `Near-duplicate ${cluster.valueType} tokens: ${names}`,
      locations: cluster.tokens.map((t) => ({
        selector: t.selector,
        atScope: t.atScope,
        file: t.file,
        line: t.line,
      })),
      evidence:
        `${cluster.tokens.length} tokens hold near-identical ${cluster.valueType} values ` +
        `(${pairs}) — ${cluster.closeness === 0 ? 'identical' : 'within the near-duplicate threshold'}. ` +
        `Consolidation candidates: collapse to one token.`,
    });
  }

  // Shadowed definition (scope & cascade axis, #21). The same token defined ≥2×
  // under the IDENTICAL (selector, at-rule) scope but with DIFFERENT values:
  // source order alone decides the winner, so the earlier definition(s) can never
  // win — dead code, provable from the AST. Universal. (Same value → an
  // exact-duplicate; a different scope → a legitimate override, not this.)
  for (const t of model.defined) {
    const groups = new Map();
    for (const d of t.definitions) {
      const key = `${d.atScope || ''}||${d.scope}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      const values = new Set(group.map((d) => d.value));
      if (values.size < 2) continue; // identical → exact-duplicate handles it
      const winner = group[group.length - 1];
      const shadowed = group.slice(0, -1);
      findings.push({
        id: nextId(),
        type: 'cascade-smell',
        basis: 'universal',
        confidence: 'high',
        title: `Shadowed definition of \`${t.name}\` — an earlier value can never win`,
        locations: group.map((d) => ({
          selector: d.scope,
          atScope: d.atScope,
          file: d.file,
          line: d.line,
        })),
        evidence:
          `${t.name} is defined ${group.length}× under the identical scope \`${winner.scope}\`` +
          `${winner.atScope ? ` (${winner.atScope})` : ''} with differing values ` +
          `(${[...values].map((v) => `\`${v}\``).join(', ')}). Source order alone decides: ` +
          `\`${winner.value}\` wins and ${shadowed.map((d) => `\`${d.value}\``).join(', ')} ` +
          `${shadowed.length === 1 ? 'is' : 'are'} unreachable dead code.`,
      });
    }
  }

  // Stray override (scope & cascade axis, #21). A global/root token redefined
  // INSIDE a component gives it a different meaning locally, fighting the global
  // cascade. Only a smell where THEMING is the codebase's override norm (globals
  // are otherwise re-scoped only via theme variants) — cite that norm. On a
  // codebase that overrides locally by habit (norm component/local) it is the
  // house style, not a smell. Low confidence: a local override may be deliberate.
  const sc = model.scopeCascade;
  if (sc.overrides.norm === 'theme') {
    const themeShare = sc.overrides.tokenCount
      ? Math.round((sc.overrides.themeVariants / sc.overrides.tokenCount) * 100)
      : 0;
    for (const site of sc.overrides.sites) {
      if (site.kind !== 'component') continue;
      const compDefs = site.overrides.filter((o) => isComponentSelector(o.selector));
      if (!compDefs.length) continue;
      const selectors = compDefs.map((o) => `\`${o.selector}\``).join(', ');
      findings.push({
        id: nextId(),
        type: 'cascade-smell',
        basis: 'convention',
        confidence: 'low',
        title: `Stray override: global \`${site.name}\` redefined inside ${selectors}`,
        locations: compDefs.map((o) => ({
          selector: o.selector,
          atScope: o.atScope,
          file: o.file,
          line: o.line,
        })),
        evidence:
          `${themeShare}% of this codebase's overrides are theme variants (globals re-scoped ` +
          `only for a theme), but \`${site.name}\` is a global redefined inside a component ` +
          `(${selectors}) with value \`${compDefs[0].value}\` — a local meaning that deviates ` +
          `from the theming norm.`,
      });
    }
  }

  // Off-grammar prefix (basis: convention — cites the norm). A global token
  // whose first segment is used by nothing else, in a tier that otherwise
  // clusters into recurring category prefixes. Global only — per the #18
  // refinement, block-local brevity/per-block namespaces make singletons normal
  // there. Low confidence: a singleton may be a legitimate one-off category.
  const byName = new Map(model.defined.map((t) => [t.name, t]));
  const locOf = (name) =>
    (byName.get(name)?.definitions || []).map((d) => ({
      selector: d.scope,
      atScope: d.atScope,
      file: d.file,
      line: d.line,
    }));
  // Abbreviation conflict (basis: convention). One concept spelled two ways
  // within a tier. The dominant form is the norm; minority forms deviate. High
  // confidence — a factual inconsistency, not a judgement call.
  for (const [tierName, grammar] of Object.entries(model.naming.tiers)) {
    for (const c of grammar.abbreviationConflicts) {
      const norm = c.forms[0];
      const minority = c.forms.slice(1);
      const deviants = [...new Set(minority.flatMap((f) => f.tokens))];
      findings.push({
        id: nextId(),
        type: 'naming-inconsistency',
        basis: 'convention',
        confidence: 'high',
        title: `Concept "${c.concept}" is spelled ${c.forms.length} ways in the ${tierName} tier`,
        locations: deviants.flatMap(locOf),
        evidence:
          `In the ${tierName} tier, "${c.concept}" appears as ` +
          c.forms.map((f) => `\`${f.form}\` (${f.count}×)`).join(', ') +
          `. The dominant form is \`${norm.form}\`; ` +
          minority.map((f) => `\`${f.form}\` (${f.tokens.join(', ')})`).join('; ') +
          ` deviate${deviants.length === 1 ? 's' : ''}.`,
      });
    }
  }

  // Tier leaks (layering axis, #20). Value should flow one way — primitive →
  // semantic → component. A reference pointing the other way, or a plainly
  // circular one, leaks. Backward leaks are judged against the codebase's own
  // reconstructed tiering (basis convention); a cycle is universal.
  const layering = model.layering;
  const layerOf = (name) => byName.get(name)?.layer;
  const TIER_NORM = 'primitive → semantic → component';
  for (const e of layering.leaks.backwardEdges) {
    findings.push({
      id: nextId(),
      type: 'tier-leak',
      basis: 'convention',
      confidence: 'medium',
      title: `Tier leak: \`${e.from}\` (${layerOf(e.from)}) reads \`${e.to}\` (${layerOf(e.to)})`,
      locations: locOf(e.from),
      evidence:
        `\`${e.from}\` (${layerOf(e.from)}) references \`${e.to}\` (${layerOf(e.to)}), so value flows ` +
        `${layerOf(e.to)} → ${layerOf(e.from)} — against the tiering norm (${TIER_NORM}). ` +
        `A ${layerOf(e.to)} token is being consumed as a base value.`,
    });
  }

  // Tier skip — a component reaches a primitive directly, jumping the semantic
  // tier. Only a leak where routing THROUGH a semantic is the codebase's own
  // norm (cite the share); on a codebase that routes directly it's the house
  // style, not a smell. Low confidence — a direct reference may be intentional.
  if (layering.flow.norm === 'semantic') {
    const total = layering.flow.throughSemantic + layering.flow.directToPrimitive;
    const share = total ? Math.round((layering.flow.throughSemantic / total) * 100) : 0;
    for (const e of layering.leaks.skipEdges) {
      findings.push({
        id: nextId(),
        type: 'tier-leak',
        basis: 'convention',
        confidence: 'low',
        title: `Tier skip: \`${e.from}\` (${layerOf(e.from)}) reaches \`${e.to}\` (${layerOf(e.to)}) directly`,
        locations: locOf(e.from),
        evidence:
          `${share}% of component references route through a semantic token, but \`${e.from}\` ` +
          `reads the ${layerOf(e.to)} \`${e.to}\` directly, skipping the semantic tier.`,
      });
    }
  }

  for (const cycle of layering.leaks.cycles) {
    const chain = [...cycle, cycle[0]].map((n) => `\`${n}\``).join(' → ');
    findings.push({
      id: nextId(),
      type: 'tier-leak',
      basis: 'universal',
      confidence: 'high',
      title: `Circular \`var()\` chain: ${cycle.map((n) => `\`${n}\``).join(' ↔ ')}`,
      locations: cycle.flatMap(locOf),
      evidence: `The tokens ${chain} form a reference cycle — the value can never resolve. Circular in any codebase.`,
    });
  }

  const g = model.naming.tiers.global;
  const clustered =
    g.consistency >= 0.6 &&
    g.recurringPrefixes.length >= 3 &&
    g.singletonPrefixes.length <= g.recurringPrefixes.length;
  if (clustered) {
    const share = Math.round(g.consistency * 100);
    const norms = g.recurringPrefixes.slice(0, 8).map((p) => `\`${p}-\``).join(', ');
    for (const t of model.defined) {
      if (t.tier !== 'global' || !g.singletonPrefixes.includes(t.segments[0])) continue;
      findings.push({
        id: nextId(),
        type: 'naming-outlier',
        basis: 'convention',
        confidence: 'low',
        title: `Off-grammar prefix \`${t.segments[0]}-\` on \`${t.name}\` (global tier)`,
        locations: locOf(t.name),
        evidence: `${share}% of global tokens use a recurring category prefix (${norms}); \`${t.name}\` is the only token with prefix \`${t.segments[0]}-\`.`,
      });
    }
  }

  return findings;
}

// ── Assemble audit.json ────────────────────────────────────────────────────
function analyze({ root, slug, exclude, top }) {
  const absRoot = resolve(root);
  const files = findCssFiles(absRoot, exclude);
  const defs = [];
  const refs = [];
  const decls = [];
  const parseErrors = [];

  for (const file of files) {
    const rel = relative(absRoot, file);
    let css;
    try {
      css = readFileSync(file, 'utf8');
    } catch (err) {
      parseErrors.push({ file: rel, message: String(err.message || err) });
      continue;
    }
    extractFacts(css, rel, defs, refs, parseErrors, decls);
  }

  const model = buildModel(defs, refs, decls);
  const findings = buildFindings(model);
  const doubling = detectDoubling(defs, model.defined.length);

  const audit = {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      project: slug || basename(absRoot),
      slug: slug || basename(absRoot),
      root: absRoot,
      date: new Date().toISOString().slice(0, 10),
      generatedBy: 'css-token-audit/analyze.mjs',
      cssFiles: files.length,
      declarations: defs.length,
      parseErrors: parseErrors.length,
    },
    summary: {
      tokenCount: model.defined.length,
      referenceCount: refs.length,
      deadCount: model.dead.length,
      oneOffCount: model.oneOff.length,
      undefinedRefCount: model.undefinedRefs.length,
      tierCount: model.layering.tierCount,
      flowDirection: model.layering.flow.direction,
      tierLeakCount: findings.filter((f) => f.type === 'tier-leak').length,
      overrideCount: model.scopeCascade.overrides.tokenCount,
      themingStyle: model.scopeCascade.theming.style,
      cascadeSmellCount: findings.filter((f) => f.type === 'cascade-smell').length,
      nearDuplicateCount: model.nearDuplicates.clusterCount,
      hardcodeRatio: model.coverage.tokenizableDeclarations
        ? Number((model.coverage.hardcoded / model.coverage.tokenizableDeclarations).toFixed(2))
        : 0,
      findingCount: findings.length,
    },
    model: {
      axes: {
        fanInOut: {
          tokenCount: model.defined.length,
          loadBearing: model.loadBearing.slice(0, top),
          dead: model.dead,
          oneOff: model.oneOff,
          undefinedReferences: model.undefinedRefs
            .map((t) => ({ name: t.name, fanIn: t.fanIn }))
            .sort((a, b) => b.fanIn - a.fanIn || a.name.localeCompare(b.name)),
        },
        naming: model.naming,
        layering: {
          tiers: model.layering.tiers,
          tierCount: model.layering.tierCount,
          flow: model.layering.flow,
        },
        scopeCascade: model.scopeCascade,
        coverage: model.coverage,
        fallback: model.fallback,
        nearDuplicates: model.nearDuplicates,
      },
      tokens: serializeTokens(model.defined),
    },
    findings,
    doubling, // null, or a source+build tree-doubling warning (see build_report)
    parseErrors,
  };

  return audit;
}

// ── Entry point ────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) {
    console.error('Usage: node analyze.mjs --root <dir> [--slug <slug>] [--out <file>] [--exclude <frag>]... [--top <n>]');
    process.exit(2);
  }
  const audit = analyze(args);
  const outPath = args.out || 'audit.json';
  writeFileSync(outPath, JSON.stringify(audit, null, 2) + '\n');
  const s = audit.summary;
  console.error(
    `css-token-audit: ${audit.meta.cssFiles} files, ${s.tokenCount} tokens, ` +
      `${s.deadCount} dead, ${s.oneOffCount} one-off, ${s.findingCount} findings` +
      (audit.meta.parseErrors ? `, ${audit.meta.parseErrors} parse errors` : '') +
      (audit.doubling ? `, ⚠ tree doubling (${audit.doubling.dirA}/ + ${audit.doubling.dirB}/)` : '') +
      ` → ${outPath}`
  );
}

// Export for tests; run when invoked directly.
export { analyze, buildModel, buildFindings, extractFacts, findCssFiles, parseArgs };


if (import.meta.url === `file://${process.argv[1]}`) main();
