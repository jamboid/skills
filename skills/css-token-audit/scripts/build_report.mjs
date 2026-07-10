#!/usr/bin/env node
/**
 * css-token-audit — Markdown report builder (walking skeleton, slice #18).
 *
 * Renders a human-readable report from `audit.json`, the single generated
 * source of truth. audit.json is never hand-edited; re-run analyze.mjs to
 * regenerate it. This script is a pure renderer — it computes nothing new.
 *
 * The `schemaVersion` is the contract: this builder refuses an audit.json whose
 * MAJOR version it doesn't support, rather than silently mis-rendering.
 *
 * Usage:
 *   node build_report.mjs <audit.json> [--out <report.md>]
 */

import { readFileSync, writeFileSync } from 'node:fs';

export const SUPPORTED_MAJOR = 1;

const BASIS_NOTE = {
  universal: 'defensible anywhere',
  convention: "earned from this codebase's own patterns",
  'house-rule': 'an opt-in cross-project preference',
};

function parseArgs(argv) {
  const args = { input: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (!args.input) args.input = a;
  }
  return args;
}

/** Refuse an audit whose schema major version we can't render. */
export function assertSchema(audit) {
  const v = audit && audit.schemaVersion;
  if (!v || typeof v !== 'string') {
    throw new Error('audit.json is missing a mandatory `schemaVersion`.');
  }
  const major = Number(v.split('.')[0]);
  if (!Number.isInteger(major) || major !== SUPPORTED_MAJOR) {
    throw new Error(
      `Unsupported schemaVersion ${v}: this builder handles major ${SUPPORTED_MAJOR}.x only. ` +
        'Re-run analyze.mjs with a matching version of the skill.'
    );
  }
}

const code = (s) => '`' + s + '`';

/** Render one location, preferring the selector (survives minification) and
 *  keeping file:line as a secondary hint. */
function fmtLocation(l) {
  const parts = [];
  if (l.selector) parts.push(code(l.selector));
  if (l.atScope) parts.push(`in ${code(l.atScope)}`);
  const fileLine = l.file ? `${l.file}:${l.line ?? '?'}` : null;
  if (fileLine) parts.push(parts.length ? `(${fileLine})` : code(fileLine));
  return parts.join(' ') || '_no location_';
}

function fmtLocations(locations) {
  if (!locations || !locations.length) return '_no location_';
  return locations.map(fmtLocation).join(', ');
}

/** Compact list of the selectors that consume a token. */
function fmtUsedIn(usedIn, total) {
  if (!usedIn || !usedIn.length) return '';
  const shown = usedIn.map((u) => code(u.selector)).join(', ');
  const more = total > usedIn.length ? `, +${total - usedIn.length} more` : '';
  return `${shown}${more}`;
}

/** Render the naming-taxonomy axis: an inferred grammar per tier, its
 *  consistency, prefix vocabulary, and any abbreviation conflicts. */
function renderNaming(L, naming) {
  L.push('## Naming taxonomy');
  L.push('');
  L.push(
    'The grammar is inferred **per tier** — the codebase runs one convention for global ' +
      '`:root` design tokens and another for block-scoped locals, so they are measured ' +
      'separately. Consistency is the share of a tier\'s tokens whose first segment is a ' +
      'recurring category/namespace prefix.'
  );
  L.push('');
  for (const [tierName, g] of Object.entries(naming.tiers)) {
    if (!g.tokenCount) continue;
    L.push(`### ${tierName} tier — ${g.tokenCount} tokens`);
    L.push('');
    L.push(`- **Inferred grammar:** ${code(g.template)}`);
    L.push(`- **Consistency:** ${Math.round(g.consistency * 100)}% follow a recurring prefix`);
    L.push(`- **Typical shape:** ${g.dominantSegmentCount} segments`);
    if (g.recurringPrefixes.length)
      L.push(`- **Category/namespace vocabulary:** ${g.recurringPrefixes.map((p) => code(p + '-')).join(', ')}`);
    if (g.singletonPrefixes.length)
      L.push(`- **One-of-a-kind prefixes:** ${g.singletonPrefixes.map((p) => code(p + '-')).join(', ')}`);
    if (g.abbreviationConflicts.length) {
      L.push('- **Abbreviation conflicts:**');
      for (const c of g.abbreviationConflicts)
        L.push(`  - "${c.concept}": ${c.forms.map((f) => `${code(f.form)} ×${f.count}`).join(' vs ')}`);
    }
    L.push('');
  }
}

/** Render the layering / tiers axis: the reconstructed primitive → semantic →
 *  component tier system and how cleanly value flows through it. */
function renderLayering(L, layering) {
  const { tiers, tierCount, flow } = layering;
  L.push('## Layering / tiers');
  L.push('');
  L.push(
    'Tiers are reconstructed from the dependency graph, not from names: a **primitive** ' +
      'holds a raw value, a **semantic** token aliases a primitive, and a **component** token ' +
      'is a block-local. Value should flow one way — `primitive → semantic → component`; a ' +
      'reference pointing the other way (or in a cycle) leaks.'
  );
  L.push('');
  L.push(`- **Tiers in use:** ${tierCount} of 3`);
  for (const name of ['primitive', 'semantic', 'component']) {
    const t = tiers[name];
    if (t && t.tokenCount) L.push(`  - **${name}:** ${t.tokenCount}`);
  }
  const dir =
    flow.direction === 'downward'
      ? 'one-directional (`primitive → semantic → component`)'
      : flow.direction === 'circular'
        ? '**circular** — at least one `var()` cycle'
        : '**mixed** — some references flow up-tier'; // 'mixed'
  L.push(`- **Flow:** ${dir}`);
  L.push(
    `- **Token→token edges:** ${flow.edges} (${flow.healthy} down-tier, ${flow.backward} up-tier, ` +
      `${flow.lateral} same-tier)`
  );
  if (flow.norm !== 'none')
    L.push(
      `- **Component routing norm:** ${
        flow.norm === 'semantic' ? 'through a semantic token' : 'directly to a primitive'
      } (${flow.throughSemantic} via semantic, ${flow.directToPrimitive} direct)`
    );
  L.push('');
}

/** Render the scope & cascade axis: where tokens are defined in the cascade,
 *  where they get overridden, and the static theming approximation. */
function renderScopeCascade(L, sc) {
  const { scopes, overrides, theming } = sc;
  L.push('## Scope & cascade');
  L.push('');
  L.push(
    'Where each token lives in the cascade — an unconditional `:root` **root** base, a ' +
      'conditional **theme** variant (`[data-theme=…]`, `@media prefers-color-scheme`, a ' +
      'breakpoint), or a **component**-scoped local — plus where values get overridden and how ' +
      'theming is wired. All static, from selectors + `@`-rules (no headless browser).'
  );
  L.push('');
  L.push(
    `- **Home scope:** ${scopes.root} root, ${scopes.theme} theme, ${scopes.component} component`
  );
  const oNorm =
    overrides.norm === 'none'
      ? 'no overrides'
      : `mostly ${overrides.norm === 'theme' ? 'theme variants' : overrides.norm === 'component' ? 'component overrides' : 'local multi-scope'}`;
  L.push(
    `- **Overridden tokens:** ${overrides.tokenCount} (${overrides.themeVariants} theme, ` +
      `${overrides.componentOverrides} component, ${overrides.localMultiScope} local) — ${oNorm}`
  );
  const styleNote =
    theming.style === 'none'
      ? 'none detected'
      : theming.style === 'mixed'
        ? 'mixed (more than one mechanism)'
        : theming.style;
  L.push(`- **Theming style:** ${styleNote}`);
  if (theming.mechanisms.length) {
    L.push('- **Mechanisms:**');
    for (const m of theming.mechanisms)
      L.push(`  - ${code(m.condition)} — ${m.tokenCount} token(s)`);
  }
  L.push('');
}

/** Render the coverage / hardcode axis: what share of tokenizable declarations
 *  route through a token vs a raw literal, and the properties most often literal. */
function renderCoverage(L, coverage) {
  const { tokenizableDeclarations, covered, hardcoded, ratio, topHardcodedProperties } = coverage;
  L.push('## Coverage / hardcode');
  L.push('');
  L.push(
    'Of the declarations a token scheme typically governs (colour, spacing, borders, ' +
      'typography, motion), how many consume a token via `var()` vs hold a raw literal. ' +
      'Coarse by design — a literal `0` counts as hardcoded even where a token is unwarranted — ' +
      'so read the ratio as a direction, not a grade.'
  );
  L.push('');
  L.push(
    `- **Tokenizable declarations:** ${tokenizableDeclarations} (${covered} via token, ${hardcoded} literal)`
  );
  L.push(`- **Coverage:** ${Math.round(ratio * 100)}% route through a token`);
  if (topHardcodedProperties.length) {
    L.push('- **Most-hardcoded properties:**');
    for (const p of topHardcodedProperties)
      L.push(`  - ${code(p.property)} — ${p.count} literal(s)`);
  }
  L.push('');
}

/** Render the fallback-usage axis: how many `var()` uses carry a fallback and of
 *  what kind (a chained token, a literal default, or an explicit empty). */
function renderFallback(L, fallback) {
  const { total, withFallback, byKind, samples } = fallback;
  L.push('## Fallback usage');
  L.push('');
  L.push(
    'How many `var()` references carry a fallback (`var(--x, …)`) and of what kind: a **token** ' +
      '(a chained dependency the main graph doesn\'t model), a **literal** (a hardcoded default ' +
      'the token would otherwise supply), or an explicit **empty** fallback.'
  );
  L.push('');
  L.push(
    `- **References with a fallback:** ${withFallback} of ${total} ` +
      `(${byKind.token} token, ${byKind.literal} literal, ${byKind.empty} empty)`
  );
  if (samples.length) {
    L.push('- **Examples:**');
    for (const s of samples)
      L.push(`  - ${code(`var(${s.name}, ${s.fallback})`)} (${s.kind}) in ${code(s.scope)}`);
  }
  L.push('');
}

/** Render the near-duplicate axis: clusters of tokens whose raw values are
 *  nearly identical — the juiciest consolidation leads. */
function renderNearDuplicates(L, nd) {
  L.push('## Near-duplicates');
  L.push('');
  L.push(
    'Tokens whose raw values are *nearly* (not exactly) the same, clustered per value type — ' +
      'colour distance, numeric proximity, or a fuzzy match. Each cluster is a consolidation ' +
      'lead: collapsing the near-duplicates to one token removes a distinction the design ' +
      'system probably doesn\'t intend.'
  );
  L.push('');
  if (!nd.clusters.length) {
    L.push('_No near-duplicate clusters._');
    L.push('');
    return;
  }
  for (const c of nd.clusters) {
    const closeness = c.closeness === 0 ? 'identical' : `closeness ${c.closeness}`;
    L.push(`- **${c.valueType}** (${closeness}): ${c.tokens.map((t) => `${code(t.name)} (${t.value})`).join(', ')}`);
  }
  L.push('');
}

export function renderReport(audit) {
  assertSchema(audit);
  const { meta, summary, model } = audit;
  const axis = model.axes.fanInOut;
  const L = [];

  L.push(`# CSS token audit — ${meta.project}`);
  L.push('');
  L.push(
    `_${meta.date} · ${meta.cssFiles} CSS file(s) · ${meta.declarations} custom-property ` +
      `declaration(s) · schema v${audit.schemaVersion} · generated by ${code(meta.generatedBy)}_`
  );
  L.push('');
  L.push(`Root: ${code(meta.root)}`);
  L.push('');

  // ── Parse-coverage caveat — a loud, unmissable warning. Parse errors mean
  //    the parser dropped part of a value to a raw string, so `var()` refs
  //    inside it are invisible: fan-in is undercounted and some "dead" tokens
  //    are false. On a preprocessed codebase this is the signal to point the
  //    audit at the COMPILED CSS, not the authored source (PRD §5.2). ──
  if (meta.parseErrors > 0) {
    L.push('> [!WARNING]');
    L.push(
      `> **${meta.parseErrors} parse error(s).** The parser could not fully read some values, ` +
        'so `var()` references inside them are missed — **fan-in is undercounted and some ' +
        '"dead" tokens below may be false.** This usually means the audited CSS is authored / ' +
        'pre-compilation (e.g. Sass, `@function`, custom syntax). Point the audit at the ' +
        '**compiled** CSS — the only place `var()` actually resolves. See the appendix.');
    L.push('');
  }

  // ── Tree-doubling caveat — distinct from the parse warning. Fires when the
  //    same tokens are defined identically across two top-level trees, i.e. the
  //    audit spanned a source tree AND its compiled build. Unlike the parse
  //    warning this can trip silently on all-valid plain CSS, so it names the
  //    specific problem and (when detectable) which tree is the build. ──
  if (audit.doubling) {
    const d = audit.doubling;
    const which = d.compiledDir ? ` (\`${d.compiledDir}/\` looks like the compiled build)` : '';
    L.push('> [!WARNING]');
    L.push(
      `> **Possible tree doubling.** ${d.sharedTokens} tokens ` +
        `(${Math.round(d.share * 100)}% of the set) are defined identically in **both** ` +
        `\`${d.dirA}/\` and \`${d.dirB}/\`${which} — you are probably auditing a source tree ` +
        '**and** its compiled build together. That double-counts every token and inflates the ' +
        'exact-duplicate findings below (they are this artifact, not real redundancy). ' +
        'Re-run against **one** tree — the compiled one.');
    L.push('');
  }

  // ── Overview ──
  L.push('## Overview');
  L.push('');
  L.push(`- **Tokens defined:** ${summary.tokenCount}`);
  L.push(`- **References (\`var()\` uses):** ${summary.referenceCount}`);
  L.push(`- **Dead** (defined, never referenced): ${summary.deadCount}`);
  L.push(`- **One-off** (referenced exactly once): ${summary.oneOffCount}`);
  L.push(`- **Dangling references** (used but never defined): ${summary.undefinedRefCount}`);
  if (summary.tierCount != null)
    L.push(`- **Tiers** (primitive/semantic/component): ${summary.tierCount} of 3, flow ${summary.flowDirection}`);
  if (summary.overrideCount != null)
    L.push(`- **Overrides** (tokens redefined): ${summary.overrideCount}, theming ${summary.themingStyle}`);
  if (summary.hardcodeRatio != null && model.axes.coverage)
    L.push(
      `- **Coverage** (tokenizable declarations via a token): ` +
        `${Math.round((1 - summary.hardcodeRatio) * 100)}% (${model.axes.coverage.hardcoded} hardcoded literal(s))`
    );
  if (summary.nearDuplicateCount != null)
    L.push(`- **Near-duplicate clusters** (consolidation leads): ${summary.nearDuplicateCount}`);
  L.push(`- **Findings:** ${summary.findingCount}`);
  if (summary.suppressedCount)
    L.push(`- **Accepted exceptions** (suppressed via conventions): ${summary.suppressedCount}`);
  L.push('');

  // ── Axis: fan-in / fan-out ──
  L.push('## Fan-in / fan-out');
  L.push('');
  L.push(
    'Fan-in is how many places reference a token (`var(--x)`); fan-out is how many other ' +
      'tokens a token references in its own value. High fan-in tokens are load-bearing — ' +
      'changing them ripples widely; zero fan-in is dead weight.'
  );
  L.push('');

  if (axis.loadBearing.length) {
    L.push(`### Load-bearing tokens (top ${axis.loadBearing.length} by fan-in)`);
    L.push('');
    L.push('Each shows fan-in / fan-out and a sample of the selectors that consume it ' +
      '(`var --token` means it feeds another token). Selectors survive minification where ' +
      'line numbers don\'t.');
    L.push('');
    for (const t of axis.loadBearing) {
      const used = fmtUsedIn(t.usedIn, t.usedInCount);
      L.push(`- ${code(t.name)} — fan-in ${t.fanIn}, fan-out ${t.fanOut}${used ? ` — used in ${used}` : ''}`);
    }
    L.push('');
  }

  if (axis.dead.length) {
    L.push(`### Dead tokens (${axis.dead.length})`);
    L.push('');
    L.push(axis.dead.map(code).join(', '));
    L.push('');
  }

  if (axis.oneOff.length) {
    L.push(`### One-off tokens (${axis.oneOff.length})`);
    L.push('');
    L.push('Referenced exactly once — candidates to inline, or leads for consolidation.');
    L.push('');
    L.push(axis.oneOff.map(code).join(', '));
    L.push('');
  }

  if (axis.undefinedReferences && axis.undefinedReferences.length) {
    L.push(`### Dangling references (${axis.undefinedReferences.length})`);
    L.push('');
    L.push('Referenced via `var()` but never defined in the audited CSS (a typo, a token ' +
      'defined elsewhere, or a runtime/JS-set property).');
    L.push('');
    L.push(axis.undefinedReferences.map((t) => `${code(t.name)} (×${t.fanIn})`).join(', '));
    L.push('');
  }

  // ── Layering / tiers ──
  if (model.axes.layering) renderLayering(L, model.axes.layering);

  // ── Scope & cascade ──
  if (model.axes.scopeCascade) renderScopeCascade(L, model.axes.scopeCascade);

  // ── Coverage / hardcode ──
  if (model.axes.coverage) renderCoverage(L, model.axes.coverage);

  // ── Fallback usage ──
  if (model.axes.fallback) renderFallback(L, model.axes.fallback);

  // ── Near-duplicates ──
  if (model.axes.nearDuplicates) renderNearDuplicates(L, model.axes.nearDuplicates);

  // ── Naming taxonomy ──
  if (model.axes.naming) renderNaming(L, model.axes.naming);

  // ── Findings ──
  // Suppressed (accepted) findings are curated exceptions — kept out of the main
  // listing and shown separately below, so the report stays a live to-do list.
  const activeFindings = audit.findings.filter((f) => !f.suppressed);
  const suppressedFindings = audit.findings.filter((f) => f.suppressed);
  L.push('## Findings');
  L.push('');
  if (!activeFindings.length) {
    L.push('_No findings._');
    L.push('');
  } else {
    L.push(
      'Each finding cites a **basis** (the authority behind it) and a **confidence**. This ' +
        'tool never asserts "wrong" — it reports a deviation, its authority, and how sure it is.'
    );
    L.push('');
    const byType = new Map();
    for (const f of activeFindings) {
      if (!byType.has(f.type)) byType.set(f.type, []);
      byType.get(f.type).push(f);
    }
    for (const [type, group] of byType) {
      L.push(`### ${type} (${group.length})`);
      L.push('');
      for (const f of group) {
        L.push(`- **${f.id}** · ${f.title}`);
        L.push(`  - basis: \`${f.basis}\` · confidence: \`${f.confidence}\``);
        L.push(`  - where: ${fmtLocations(f.locations)}`);
        L.push(`  - ${f.evidence}`);
      }
      L.push('');
    }
  }

  // ── Accepted exceptions (curated via the conventions file) ──
  if (suppressedFindings.length) {
    L.push('## Accepted exceptions');
    L.push('');
    L.push(
      'Findings a human has **accepted** in the conventions file (`accept` disposition) — ' +
        'suppressed on this instance and kept quiet across runs. Listed here for transparency; ' +
        'edit the conventions file to re-open one.'
    );
    L.push('');
    for (const f of suppressedFindings) {
      L.push(`- \`${f.fingerprint}\` — ${f.title}`);
      if (f.note) L.push(`  - note: ${f.note}`);
    }
    L.push('');
  }

  // ── Appendix ──
  L.push('## Appendix');
  L.push('');
  L.push('**Basis** — the authority a finding is measured against:');
  for (const [k, v] of Object.entries(BASIS_NOTE)) L.push(`- \`${k}\` — ${v}.`);
  L.push('');
  L.push(
    '**Source of truth.** `audit.json` is generated by `analyze.mjs` from a deterministic ' +
      'css-tree parse — never hand-edited, and never read by eye. This report renders from it. ' +
      'The audit runs on the **compiled** CSS, the only place `var()` resolves; authored / ' +
      'preprocessor source is not a reliable graph (see the parse-coverage warning above).'
  );
  L.push('');

  return L.join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('Usage: node build_report.mjs <audit.json> [--out <report.md>]');
    process.exit(2);
  }
  let audit;
  try {
    audit = JSON.parse(readFileSync(args.input, 'utf8'));
  } catch (err) {
    console.error(`Cannot read ${args.input}: ${err.message}`);
    process.exit(1);
  }
  let md;
  try {
    md = renderReport(audit);
  } catch (err) {
    console.error(`Refusing to build report: ${err.message}`);
    process.exit(1);
  }
  const out = args.out || `${audit.meta.slug || 'css-token'}-audit.md`;
  writeFileSync(out, md);
  console.error(`css-token-audit report → ${out}`);
}

export { parseArgs };

if (import.meta.url === `file://${process.argv[1]}`) main();
