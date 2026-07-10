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
function extractFacts(css, relPath, defs, refs, parseErrors) {
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
      csstree.walk(node.value, {
        visit: 'Function',
        enter(fn) {
          if (fn.name !== 'var') return;
          const first = fn.children && fn.children.first;
          if (!first || first.type !== 'Identifier') return;
          refs.push({
            name: first.name,
            owner: isCustomProp ? node.property : null, // token that references it, if any
            inProperty: node.property,
            file: relPath,
            line: fn.loc ? fn.loc.start.line : line,
          });
        },
      });
    },
  });
}

// ── Model + findings ───────────────────────────────────────────────────────
function buildModel(defs, refs) {
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
      file: d.file,
      line: d.line,
    });
  }

  for (const r of refs) {
    const t = tokenOf(r.name); // referenced token (may be defined elsewhere or undefined)
    t.fanIn += 1;
    t.references.push({ inProperty: r.inProperty, file: r.file, line: r.line, owner: r.owner });
    if (r.owner) tokenOf(r.owner).referencedTokens.add(r.name);
  }

  for (const t of tokens.values()) t.fanOut = t.referencedTokens.size;

  // A token is "defined" if it has ≥1 definition. Referenced-but-undefined
  // names are surfaced separately (a dangling var reference).
  const defined = [...tokens.values()].filter((t) => t.definitions.length > 0);
  const undefinedRefs = [...tokens.values()].filter((t) => t.definitions.length === 0);

  const dead = defined.filter((t) => t.fanIn === 0).map((t) => t.name).sort();
  const oneOff = defined.filter((t) => t.fanIn === 1).map((t) => t.name).sort();
  const loadBearing = [...defined]
    .filter((t) => t.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn || a.name.localeCompare(b.name))
    .map((t) => ({ name: t.name, fanIn: t.fanIn, fanOut: t.fanOut }));

  return { tokens, defined, undefinedRefs, dead, oneOff, loadBearing };
}

/** Serialize the token registry to plain JSON (facts embedded for later slices). */
function serializeTokens(defined) {
  return [...defined]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      fanIn: t.fanIn,
      fanOut: t.fanOut,
      referencedTokens: [...t.referencedTokens].sort(),
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
      locations: t.definitions.map((d) => ({ file: d.file, line: d.line })),
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
        locations: group.map((d) => ({ file: d.file, line: d.line })),
        evidence: `${t.name} is defined ${group.length}× with the identical value \`${group[0].value}\` under scope \`${group[0].scope}\`${group[0].atScope ? ` (${group[0].atScope})` : ''} — the later definitions are redundant.`,
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
    extractFacts(css, rel, defs, refs, parseErrors);
  }

  const model = buildModel(defs, refs);
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
