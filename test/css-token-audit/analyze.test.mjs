import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyze,
  extractFacts,
  normalizeValue,
  valueType,
  parseColor,
  colorDistance,
  valueDistance,
  SCHEMA_VERSION,
} from '../../skills/css-token-audit/scripts/analyze.mjs';
import { renderReport, assertSchema } from '../../skills/css-token-audit/scripts/build_report.mjs';
import {
  emptyConventions,
  recordDispositions,
  renderConventions,
  CONVENTIONS_VERSION,
} from '../../skills/css-token-audit/scripts/conventions.mjs';

// The analyzer's contract: a DETERMINISTIC css-tree parse of compiled CSS →
// custom-property dependency graph → fan-in/fan-out axis + universal findings.
// The load-bearing correctness guarantee is that a `var()` living INSIDE another
// token's value counts as a reference (the parseCustomProperty trap).

function withFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'css-token-audit-'));
  for (const [name, css] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, css);
  }
  return dir;
}

const dirs = [];
const fixture = (files) => {
  const d = withFixture(files);
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('value normalization', () => {
  // The substrate for exact literal↔token matching (#22) and, later, fuzzy
  // near-duplicate matching (#23). Equal values must canonicalize equal.
  it('canonicalizes colours so equal colours compare equal regardless of spelling', () => {
    expect(normalizeValue('#FFF')).toBe(normalizeValue('#ffffff'));
    expect(normalizeValue('#AABBCC')).toBe('#aabbcc'); // lowercase
    expect(normalizeValue('#F00')).toBe('#ff0000'); // short hex expanded
    expect(normalizeValue('rgb(255, 0, 0)')).toBe(normalizeValue('rgb(255,0,0)')); // comma spacing
  });

  it('classifies a value by type: color / length / number / other', () => {
    expect(valueType('#fff')).toBe('color');
    expect(valueType('rgb(0,0,0)')).toBe('color');
    expect(valueType('white')).toBe('color');
    expect(valueType('1.5rem')).toBe('length');
    expect(valueType('12px')).toBe('length');
    expect(valueType('400')).toBe('number');
    expect(valueType('ease-in-out')).toBe('other');
  });
});

describe('value distance (the near-duplicate substrate, #23)', () => {
  // Per-value-type proximity: colour distance in RGB(A) space, numeric relative
  // proximity for lengths/numbers, fuzzy string distance otherwise. Feeds the
  // near-duplicate clustering — values that are *nearly* the same, not equal.
  it('parses hex, rgb() and a named colour to RGBA channels', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('rgb(0, 128, 255)')).toEqual({ r: 0, g: 128, b: 255, a: 1 });
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('ease-in-out')).toBeNull(); // not a colour
  });

  it('measures colour distance: near-identical shades are close, distinct hues far', () => {
    expect(colorDistance('#333333', '#343434')).toBeLessThan(3); // 1-per-channel nudge
    expect(colorDistance('#ffffff', '#ffffff')).toBe(0); // identical
    expect(colorDistance('#000000', '#ffffff')).toBeGreaterThan(400); // black vs white
  });

  it('dispatches distance by matched value type, gating incomparable pairs', () => {
    // Colour pair → small distance, well under its threshold.
    const c = valueDistance('#333333', '#343434');
    expect(c.type).toBe('color');
    expect(c.distance).toBeLessThan(c.threshold);
    // Length pair, same unit → relative proximity.
    const l = valueDistance('1rem', '1.02rem');
    expect(l.type).toBe('length');
    expect(l.distance).toBeLessThan(l.threshold);
    // Different units are incomparable — no distance.
    expect(valueDistance('16px', '1rem')).toBeNull();
    // Different value types are incomparable.
    expect(valueDistance('#fff', '1rem')).toBeNull();
  });
});

describe('extractFacts', () => {
  it('captures a var() reference nested inside another token’s value', () => {
    // The whole point of parseCustomProperty: without it, --b would look dead.
    const defs = [];
    const refs = [];
    extractFacts(':root{--a:red;--b:var(--a)}', 'x.css', defs, refs, []);
    expect(defs.map((d) => d.name).sort()).toEqual(['--a', '--b']);
    const aRef = refs.find((r) => r.name === '--a');
    expect(aRef).toBeTruthy();
    expect(aRef.owner).toBe('--b'); // referenced from inside --b's value
  });

  it('captures var() in a normal property and records the consuming property', () => {
    const defs = [];
    const refs = [];
    extractFacts(':root{--c:blue} a{color:var(--c)}', 'x.css', defs, refs, []);
    const ref = refs.find((r) => r.name === '--c');
    expect(ref.owner).toBeNull();
    expect(ref.inProperty).toBe('color');
  });
});

describe('analyze', () => {
  it('reconstructs fan-in/fan-out and flags dead + one-off tokens', () => {
    const dir = fixture({
      'tokens.css': ':root{--base:#111;--used:var(--base);--dead:#eee}',
      'ui.css': '.a{color:var(--used)} .b{border-color:var(--used)}',
    });
    const audit = analyze({ root: dir, slug: 'fix', exclude: [], top: 10 });

    expect(audit.schemaVersion).toBe(SCHEMA_VERSION);
    expect(audit.meta.parseErrors).toBe(0);

    const byName = Object.fromEntries(audit.model.tokens.map((t) => [t.name, t]));
    expect(byName['--used'].fanIn).toBe(2); // .a + .b
    expect(byName['--base'].fanIn).toBe(1); // inside --used
    expect(byName['--used'].fanOut).toBe(1); // references --base

    const axis = audit.model.axes.fanInOut;
    expect(axis.dead).toContain('--dead');
    expect(axis.dead).not.toContain('--used');
    expect(axis.oneOff).toContain('--base'); // referenced exactly once
  });

  it('emits a dead-token finding, universal basis, with the defining selector', () => {
    const dir = fixture({ 'a.css': ':root{--gone:#000}' });
    const audit = analyze({ root: dir, slug: 'd', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'dead-token');
    expect(f.basis).toBe('universal');
    expect(f.title).toContain('--gone');
    expect(f.locations[0].file).toBe('a.css');
    expect(f.locations[0].selector).toBe(':root'); // where it's defined
  });

  it('records the selectors that consume a token (survives minification)', () => {
    const dir = fixture({
      'a.css': ':root{--brand:#f0f;--heading:var(--brand)} .btn{color:var(--brand)} .card{border-color:var(--brand)}',
    });
    const audit = analyze({ root: dir, slug: 'u', exclude: [], top: 10 });
    const brand = audit.model.tokens.find((t) => t.name === '--brand');
    const selectors = brand.usedIn.map((u) => u.selector);
    expect(selectors).toContain('.btn');
    expect(selectors).toContain('.card');
    expect(selectors).toContain('var --heading'); // used inside another token's value
    // Load-bearing entry carries the same sample + a total count.
    const lb = audit.model.axes.fanInOut.loadBearing.find((t) => t.name === '--brand');
    expect(lb.usedInCount).toBe(3);
  });

  it('flags exact-duplicate definitions in one scope, not cross-value overrides', () => {
    const dir = fixture({
      'dup.css': ':root{--x:1px} :root{--x:1px}', // identical → duplicate
      'override.css': '.dark{--y:#000} .light{--y:#fff}', // different scope+value → not a dup
    });
    const audit = analyze({ root: dir, slug: 'dup', exclude: [], top: 10 });
    const dups = audit.findings.filter((x) => x.type === 'exact-duplicate');
    expect(dups.map((d) => d.title).some((t) => t.includes('--x'))).toBe(true);
    expect(dups.map((d) => d.title).some((t) => t.includes('--y'))).toBe(false);
    expect(dups[0].confidence).toBe('high');
  });

  it('surfaces dangling references (used but never defined)', () => {
    const dir = fixture({ 'a.css': '.a{color:var(--nowhere)}' });
    const audit = analyze({ root: dir, slug: 'x', exclude: [], top: 10 });
    const dangling = audit.model.axes.fanInOut.undefinedReferences.map((t) => t.name);
    expect(dangling).toContain('--nowhere');
    expect(audit.summary.tokenCount).toBe(0); // undefined refs are not "defined tokens"
  });
});

describe('tree-doubling guard', () => {
  it('flags source+build doubling and names the minified tree as compiled', () => {
    // Same tokens, identical values, in two top-level trees — one minified
    // (many defs on a single line, as a real compiled build looks).
    const minified =
      ':root{--a:#111;--b:#222;--c:#333;--d:#444;--e:#555;--f:#666} .x{color:var(--a)}';
    const dir = fixture({
      'src/tokens.css': ':root{\n--a:#111;\n--b:#222;\n--c:#333;\n--d:#444;\n--e:#555;\n--f:#666\n} .x{color:var(--a)}',
      'dist/app.css': minified,
    });
    const audit = analyze({ root: dir, slug: 'dbl', exclude: [], top: 10 });
    expect(audit.doubling).toBeTruthy();
    expect([audit.doubling.dirA, audit.doubling.dirB].sort()).toEqual(['dist', 'src']);
    expect(audit.doubling.sharedTokens).toBeGreaterThanOrEqual(3);
    expect(audit.doubling.compiledDir).toBe('dist'); // the one-line file
  });

  it('does not flag a single clean tree', () => {
    const dir = fixture({
      'tokens.css': ':root{--a:#111;--b:#222}',
      'ui.css': '.x{color:var(--a)} .y{background:var(--b)}',
    });
    const audit = analyze({ root: dir, slug: 'clean', exclude: [], top: 10 });
    expect(audit.doubling).toBeNull();
  });
});

describe('coverage / hardcode axis', () => {
  // The proportion of tokenizable declarations (color, spacing, …) that consume
  // a token via `var()` vs a raw literal. Custom-property definitions themselves
  // are not coverage subjects — only ordinary declarations are.
  it('computes the hardcode ratio over tokenizable declarations', () => {
    const dir = fixture({
      'a.css':
        ':root{--clr-ink:#111}' +
        ' .a{color:var(--clr-ink); background:#fff; margin:1rem}' +
        ' .b{padding:var(--space)}',
    });
    const audit = analyze({ root: dir, slug: 'cov', exclude: [], top: 10 });
    const cov = audit.model.axes.coverage;
    // color + padding consume a token (covered); background + margin are literals.
    expect(cov.covered).toBe(2);
    expect(cov.hardcoded).toBe(2);
    expect(cov.tokenizableDeclarations).toBe(4);
    expect(cov.ratio).toBeCloseTo(0.5, 2);
  });

  it('ignores non-tokenizable properties (display, position) in the ratio', () => {
    const dir = fixture({
      'a.css': '.a{display:flex; position:absolute; color:#000}',
    });
    const audit = analyze({ root: dir, slug: 'ntk', exclude: [], top: 10 });
    const cov = audit.model.axes.coverage;
    expect(cov.tokenizableDeclarations).toBe(1); // only `color`
    expect(cov.hardcoded).toBe(1);
  });
});

describe('fallback usage axis', () => {
  // Catalogue `var(--x, fallback)` patterns: a fallback is a token (a chained
  // dependency the graph should see) or a literal (a hardcoded default the token
  // would otherwise supply).
  it('catalogues var() fallbacks by kind: token / literal / none', () => {
    const dir = fixture({
      'a.css':
        ':root{--a:#111;--b:#222}' +
        ' .x{color:var(--a)}' + // no fallback
        ' .y{color:var(--missing, #f00)}' + // literal fallback
        ' .z{color:var(--missing, var(--b))}', // token (chained) fallback
    });
    const audit = analyze({ root: dir, slug: 'fb', exclude: [], top: 10 });
    const fb = audit.model.axes.fallback;
    // 4 var() references: --a, --missing×2 (as first arg), --b (nested).
    expect(fb.total).toBe(4);
    expect(fb.withFallback).toBe(2); // the two --missing refs carry a fallback
    expect(fb.byKind.literal).toBe(1); // #f00
    expect(fb.byKind.token).toBe(1); // var(--b)
  });

  it('records the fallback expression text on the reference', () => {
    const defs = [];
    const refs = [];
    extractFacts('.a{color:var(--x, #f00)}', 'x.css', defs, refs, []);
    const ref = refs.find((r) => r.name === '--x');
    expect(ref.fallback).toBe('#f00');
  });
});

describe('literal-matches-token finding', () => {
  // A hardcoded literal whose NORMALIZED value equals an existing token's value
  // — a missed tokenization. Universal: defensible anywhere. Matching keys off
  // the normalized value, so `#f00` matches a token holding `#ff0000`.
  it('flags a hardcoded literal that equals an existing token, citing the token', () => {
    const dir = fixture({
      'a.css': ':root{--clr-brand:#ff0000} .a{color:#f00}',
    });
    const audit = analyze({ root: dir, slug: 'lm', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'literal-hardcode');
    expect(f.basis).toBe('universal');
    expect(f.confidence).toBe('medium');
    expect(f.title).toContain('--clr-brand'); // cites the matched token
    expect(f.locations.some((l) => l.selector === '.a')).toBe(true);
    expect(f.evidence).toMatch(/#ff0000|#f00/);
  });

  // Guard: a trivial `0` is too generic to be a missed token — no finding, even
  // if a token happens to hold `0`.
  it('does not flag a trivial zero literal', () => {
    const dir = fixture({
      'a.css': ':root{--space-none:0} .a{margin:0}',
    });
    const audit = analyze({ root: dir, slug: 'z', exclude: [], top: 10 });
    expect(audit.findings.some((f) => f.type === 'literal-hardcode')).toBe(false);
  });
});

describe('finding fingerprints (the feedback-loop identity, #24)', () => {
  // Each finding carries a STABLE, content-derived fingerprint (`type:subject`)
  // independent of the render-order `Fn` id — the key the conventions file keys
  // dispositions on, so an accepted finding stays matched across runs even as
  // other findings come and go.
  it('gives every finding a stable fingerprint + open disposition by default', () => {
    const dir = fixture({ 'a.css': ':root{--gone:#000}' });
    const audit = analyze({ root: dir, slug: 'fp', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'dead-token');
    expect(f.fingerprint).toBe('dead-token:--gone');
    expect(f.disposition).toBe('open'); // untouched until curated
    expect(f.suppressed).toBe(false);
  });

  it('suppresses an accepted finding on the next run, leaving the rest active', () => {
    const dir = fixture({ 'a.css': ':root{--gone:#000;--also-gone:#111}' }); // two dead tokens
    const first = analyze({ root: dir, slug: 'c1', exclude: [], top: 10 });
    const target = first.findings.find((f) => f.fingerprint === 'dead-token:--gone');
    // The conventions file (the audit's 4th input) — human-editable, versioned.
    const convPath = join(dir, 'conventions.json');
    writeFileSync(
      convPath,
      JSON.stringify({
        conventionsVersion: '1.0.0',
        dispositions: { [target.fingerprint]: { disposition: 'accept', note: 'intentional public token' } },
      })
    );
    const second = analyze({ root: dir, slug: 'c2', exclude: [], top: 10, conventions: convPath });
    const acc = second.findings.find((f) => f.fingerprint === target.fingerprint);
    expect(acc.suppressed).toBe(true);
    expect(acc.disposition).toBe('accept');
    expect(acc.note).toMatch(/public token/);
    // The other dead token re-surfaces, untouched.
    const other = second.findings.find((f) => f.fingerprint === 'dead-token:--also-gone');
    expect(other.suppressed).toBe(false);
    expect(other.disposition).toBe('open');
    // Counts reflect only the active (surfaced) findings.
    expect(second.summary.findingCount).toBe(second.findings.filter((f) => !f.suppressed).length);
    expect(second.summary.suppressedCount).toBe(1);
  });

  it('keeps a finding’s fingerprint stable when unrelated findings shift the Fn ids', () => {
    const one = analyze({ root: fixture({ 'a.css': ':root{--gone:#000}' }), slug: 'a', exclude: [], top: 10 });
    // Add another dead token BEFORE it — shifts Fn numbering, not the fingerprint.
    const two = analyze({ root: fixture({ 'a.css': ':root{--aaa-first:#111;--gone:#000}' }), slug: 'b', exclude: [], top: 10 });
    const fp1 = one.findings.find((x) => x.title.includes('--gone')).fingerprint;
    const fp2 = two.findings.find((x) => x.title.includes('--gone')).fingerprint;
    expect(fp1).toBe(fp2);
    // Fingerprints are unique per distinct finding.
    const all = two.findings.map((x) => x.fingerprint);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('conventions curation (#24)', () => {
  // Dispositions persist to the versioned conventions file. Recording merges —
  // it never clobbers a human's prior decisions on other findings.
  it('records dispositions without clobbering prior ones', () => {
    let conv = emptyConventions('proj');
    conv = recordDispositions(conv, [{ fingerprint: 'dead-token:--a', disposition: 'accept', note: 'public api' }], { date: '2026-07-10' });
    conv = recordDispositions(conv, [{ fingerprint: 'near-duplicate:--x,--y', disposition: 'fix' }], { date: '2026-07-10' });
    expect(Object.keys(conv.dispositions).sort()).toEqual(['dead-token:--a', 'near-duplicate:--x,--y']);
    expect(conv.dispositions['dead-token:--a'].note).toBe('public api');
    expect(conv.dispositions['dead-token:--a'].recordedAt).toBe('2026-07-10');
    expect(conv.conventionsVersion).toBe(CONVENTIONS_VERSION);
  });

  it('replaces an earlier record for the same fingerprint', () => {
    let conv = recordDispositions(null, [{ fingerprint: 'dead-token:--a', disposition: 'accept' }]);
    conv = recordDispositions(conv, [{ fingerprint: 'dead-token:--a', disposition: 'fix' }]);
    expect(conv.dispositions['dead-token:--a'].disposition).toBe('fix');
  });

  it('does not mutate the input conventions object', () => {
    const before = emptyConventions('p');
    const snapshot = JSON.stringify(before);
    recordDispositions(before, [{ fingerprint: 'dead-token:--z', disposition: 'accept' }]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('rejects an entry with no fingerprint or an unknown disposition', () => {
    expect(() => recordDispositions(null, [{ disposition: 'accept' }])).toThrow();
    expect(() => recordDispositions(null, [{ fingerprint: 'x:y', disposition: 'maybe' }])).toThrow();
  });
});

describe('near-duplicate axis', () => {
  // Tokens whose VALUES are nearly (not exactly) the same — the juiciest
  // consolidation leads. Clustered per value type by proximity: colour distance,
  // numeric relative proximity, fuzzy fallback. Alias tokens (value is a var())
  // are not raw values and never cluster.
  it('clusters tokens with near-identical colour values, leaving distinct hues apart', () => {
    const dir = fixture({
      'a.css':
        ':root{--ink:#333333;--charcoal:#343434;--brand:#0055ff}' +
        ' .a{color:var(--ink)} .b{color:var(--charcoal)} .c{color:var(--brand)}',
    });
    const audit = analyze({ root: dir, slug: 'nd', exclude: [], top: 10 });
    const clusters = audit.model.axes.nearDuplicates.clusters;
    const near = clusters.find((c) => c.tokens.some((t) => t.name === '--ink'));
    expect(near).toBeTruthy();
    expect(near.tokens.map((t) => t.name).sort()).toEqual(['--charcoal', '--ink']);
    expect(near.valueType).toBe('color');
    // --brand is a distinct hue — never joins the cluster.
    expect(clusters.some((c) => c.tokens.some((t) => t.name === '--brand'))).toBe(false);
  });

  it('emits a near-duplicate finding, universal, confidence reflecting closeness', () => {
    const dir = fixture({
      'a.css':
        ':root{--ink:#333333;--charcoal:#343434} .a{color:var(--ink)} .b{color:var(--charcoal)}',
    });
    const audit = analyze({ root: dir, slug: 'nf', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'near-duplicate');
    expect(f.basis).toBe('universal');
    expect(f.confidence).toBe('high'); // 1-per-channel nudge — very close
    expect(f.title).toContain('--ink');
    expect(f.title).toContain('--charcoal');
    expect(f.evidence).toMatch(/consolidat/i); // frames it as a consolidation lead
    expect(f.locations.length).toBe(2); // both token definition sites
  });

  it('does not cluster alias tokens (a value that is a var())', () => {
    const dir = fixture({
      'a.css': ':root{--c-blue:#0055ff;--brand:var(--c-blue);--accent:var(--c-blue)}',
    });
    const audit = analyze({ root: dir, slug: 'al', exclude: [], top: 10 });
    const clusters = audit.model.axes.nearDuplicates.clusters;
    // --brand and --accent share the SAME alias text but are references, not raw
    // values — no cluster.
    expect(clusters.some((c) => c.tokens.some((t) => t.name === '--brand'))).toBe(false);
  });
});

describe('build_report schema contract', () => {
  it('renders the axis, findings and a parse-coverage warning when errors exist', () => {
    const dir = fixture({ 'a.css': ':root{--k:1;--d:2} .a{width:var(--k)}' });
    const audit = analyze({ root: dir, slug: 'r', exclude: [], top: 10 });
    audit.meta.parseErrors = 3; // force the warning path
    const md = renderReport(audit);
    expect(md).toContain('# CSS token audit');
    expect(md).toContain('Fan-in / fan-out');
    expect(md).toContain('[!WARNING]');
    expect(md).toContain('compiled');
  });

  it('refuses an incompatible major schema version', () => {
    expect(() => assertSchema({ schemaVersion: '2.0.0' })).toThrow(/Unsupported schemaVersion/);
    expect(() => assertSchema({})).toThrow(/missing a mandatory/);
    expect(() => assertSchema({ schemaVersion: SCHEMA_VERSION })).not.toThrow();
  });

  it('renders the layering / tiers section with the reconstructed flow', () => {
    const dir = fixture({
      'a.css':
        ':root{--c-blue:#00f;--color-primary:var(--c-blue)} .btn{--btn-bg:var(--color-primary);color:var(--btn-bg)}',
    });
    const audit = analyze({ root: dir, slug: 'lay', exclude: [], top: 10 });
    const md = renderReport(audit);
    expect(md).toContain('## Layering / tiers');
    expect(md).toContain('primitive'); // names the tiers
    expect(md).toContain('semantic');
    expect(md).toContain('component');
    expect(md).toMatch(/primitive.*semantic.*component/); // shows the flow direction
  });

  it('renders the scope & cascade section with scopes, overrides and theming', () => {
    const dir = fixture({
      'a.css':
        ':root{--clr-ink:#111;--theme-bg:#fff}' +
        '[data-theme=dark]{--theme-bg:#000}' +
        '@media (prefers-color-scheme:dark){:root{--theme-bg:#000}}' +
        ' .b_card{--card-gap:1rem;color:var(--theme-bg)}',
    });
    const audit = analyze({ root: dir, slug: 'sc', exclude: [], top: 10 });
    const md = renderReport(audit);
    expect(md).toContain('## Scope & cascade');
    expect(md).toMatch(/root/); // names the scopes
    expect(md).toMatch(/[Oo]verride/); // reports override sites
    expect(md).toMatch(/[Tt]heming/); // the theming approximation
    expect(md).toMatch(/data-theme|prefers-color-scheme/); // a concrete mechanism
  });

  it('renders the coverage and fallback sections', () => {
    const dir = fixture({
      'a.css':
        ':root{--clr:#111} .a{color:var(--clr); background:#fff} .b{color:var(--x, #f00)}',
    });
    const audit = analyze({ root: dir, slug: 'cf', exclude: [], top: 10 });
    const md = renderReport(audit);
    expect(md).toContain('## Coverage / hardcode');
    expect(md).toMatch(/hardcod/i); // reports the hardcode ratio
    expect(md).toContain('## Fallback usage');
    expect(md).toMatch(/literal|token/); // names a fallback kind
  });

  it('renders active findings and lists accepted findings as suppressed exceptions', () => {
    const dir = fixture({ 'a.css': ':root{--gone:#000;--also-gone:#111}' });
    const first = analyze({ root: dir, slug: 'e1', exclude: [], top: 10 });
    void first;
    const convPath = join(dir, 'conventions.json');
    writeFileSync(
      convPath,
      JSON.stringify({
        conventionsVersion: '1.0.0',
        dispositions: { 'dead-token:--gone': { disposition: 'accept', note: 'intentional public token', title: 'Dead token `--gone`' } },
      })
    );
    const audit = analyze({ root: dir, slug: 'e2', exclude: [], top: 10, conventions: convPath });
    const md = renderReport(audit);
    expect(md).toContain('Accepted exceptions');
    expect(md).toContain('intentional public token'); // the note surfaces
    expect(md).toContain('dead-token:--gone'); // the accepted fingerprint
    // The still-active dead token is in the main findings listing.
    expect(md).toContain('--also-gone');
  });

  it('renders a readable conventions view grouping accepted and fix dispositions', () => {
    const conv = recordDispositions(
      emptyConventions('proj'),
      [
        { fingerprint: 'dead-token:--a', disposition: 'accept', note: 'api', title: 'Dead token --a' },
        { fingerprint: 'tier-leak:backward:--x->--y', disposition: 'fix' },
      ],
      { date: '2026-07-10' }
    );
    const md = renderConventions(conv);
    expect(md).toContain('# CSS token audit — conventions');
    expect(md).toMatch(/Accepted/);
    expect(md).toMatch(/Fix/);
    expect(md).toContain('dead-token:--a');
    expect(md).toContain('api');
  });

  it('renders the near-duplicates section with the consolidation clusters', () => {
    const dir = fixture({
      'a.css':
        ':root{--ink:#333333;--charcoal:#343434} .a{color:var(--ink)} .b{color:var(--charcoal)}',
    });
    const audit = analyze({ root: dir, slug: 'nr', exclude: [], top: 10 });
    const md = renderReport(audit);
    expect(md).toContain('## Near-duplicates');
    expect(md).toMatch(/consolidat/i); // frames clusters as consolidation leads
    expect(md).toContain('--ink');
    expect(md).toContain('--charcoal');
  });

  it('renders the naming taxonomy section with per-tier grammar + consistency', () => {
    const dir = fixture({
      'a.css': ':root{--clr-a:#1;--clr-b:#2;--fs-a:1rem} .b_card{--card-x:1;--card-y:2}',
    });
    const audit = analyze({ root: dir, slug: 'n', exclude: [], top: 10 });
    const md = renderReport(audit);
    expect(md).toContain('## Naming taxonomy');
    expect(md).toContain('global tier');
    expect(md).toContain('block tier');
    expect(md).toMatch(/Consistency/);
  });
});

describe('naming taxonomy axis', () => {
  it('classifies each token into a tier: global (:root) vs block (component-scoped)', () => {
    const dir = fixture({
      'a.css': ':root{--clr-ink:#111} .b_card{--card-gap:1rem} .b_card__body{gap:var(--card-gap)}',
    });
    const audit = analyze({ root: dir, slug: 't', exclude: [], top: 10 });
    const byName = Object.fromEntries(audit.model.tokens.map((t) => [t.name, t]));
    expect(byName['--clr-ink'].tier).toBe('global'); // defined at :root
    expect(byName['--card-gap'].tier).toBe('block'); // defined under a component selector
  });

  it('splits each token name into grammar segments', () => {
    const dir = fixture({ 'a.css': ':root{--nav-link-bg:#111;--fw:400}' });
    const audit = analyze({ root: dir, slug: 's', exclude: [], top: 10 });
    const byName = Object.fromEntries(audit.model.tokens.map((t) => [t.name, t]));
    expect(byName['--nav-link-bg'].segments).toEqual(['nav', 'link', 'bg']);
    expect(byName['--fw'].segments).toEqual(['fw']);
  });

  it('infers a per-tier grammar: recurring prefixes and a consistency measure', () => {
    // 7 global tokens: 3 prefixes used twice (clr, space, fs) + 1 singleton (weird).
    const dir = fixture({
      'a.css': ':root{--clr-a:#1;--clr-b:#2;--space-a:1px;--space-b:2px;--fs-a:1rem;--fs-b:2rem;--weird-x:9}',
    });
    const audit = analyze({ root: dir, slug: 'g', exclude: [], top: 10 });
    const g = audit.model.axes.naming.tiers.global;
    expect(g.recurringPrefixes).toEqual(expect.arrayContaining(['clr', 'space', 'fs']));
    expect(g.singletonPrefixes).toContain('weird');
    expect(g.consistency).toBeCloseTo(6 / 7, 2); // 6 of 7 conform
    expect(g.dominantSegmentCount).toBe(2);
  });

  it('flags an off-grammar global prefix as a convention outlier that cites the norm', () => {
    const dir = fixture({
      'a.css': ':root{--clr-a:#1;--clr-b:#2;--space-a:1px;--space-b:2px;--fs-a:1rem;--fs-b:2rem;--weird-x:9}',
    });
    const audit = analyze({ root: dir, slug: 'g', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'naming-outlier');
    expect(f.basis).toBe('convention'); // earned from the codebase's own pattern
    expect(f.confidence).toBe('low'); // a singleton may be a legit category
    expect(f.title).toContain('--weird-x');
    expect(f.evidence).toMatch(/recurring category prefix/); // must cite the norm
  });

  // Guard (green on arrival): locks the #18 tier refinement — block-local
  // brevity / per-block namespaces must NOT be flagged as outliers.
  it('does not flag block-local brevity as an outlier', () => {
    const dir = fixture({
      'a.css': '.b_card{--card-a:1;--card-b:2} .b_nav{--nav-a:1;--nav-b:2} .b_x{--solo-q:9}',
    });
    const audit = analyze({ root: dir, slug: 'b', exclude: [], top: 10 });
    expect(audit.findings.some((f) => f.type === 'naming-outlier')).toBe(false);
  });

  it('detects an abbreviation conflict within a tier and flags it (convention, high)', () => {
    // One concept ("hover") spelled two ways in the global tier.
    const dir = fixture({ 'a.css': ':root{--btn-bg-hover:#1;--link-bg-hov:#2}' });
    const audit = analyze({ root: dir, slug: 'c', exclude: [], top: 10 });
    const g = audit.model.axes.naming.tiers.global;
    const hover = g.abbreviationConflicts.find((c) => c.concept === 'hover');
    expect(hover.forms.map((f) => f.form).sort()).toEqual(['hov', 'hover']);
    const f = audit.findings.find((x) => x.type === 'naming-inconsistency');
    expect(f.basis).toBe('convention');
    expect(f.confidence).toBe('high');
    expect(f.title).toContain('hover');
  });
});

describe('layering / tiers axis', () => {
  // A three-tier system reconstructed from the graph, not from names:
  //   primitive  — global, holds a raw value (references no other token)
  //   semantic   — global, aliases another token (fan-out ≥ 1)
  //   component  — defined under a component selector (block-local)
  // Value flows primitive → semantic → component; the reverse leaks.
  const threeTier = {
    'a.css':
      ':root{--c-blue:#00f;--color-primary:var(--c-blue)} .btn{--btn-bg:var(--color-primary);color:var(--btn-bg)}',
  };

  it('classifies each token into a primitive / semantic / component layer from the graph', () => {
    const dir = fixture(threeTier);
    const audit = analyze({ root: dir, slug: 'l', exclude: [], top: 10 });
    const byName = Object.fromEntries(audit.model.tokens.map((t) => [t.name, t]));
    expect(byName['--c-blue'].layer).toBe('primitive'); // raw value, references nothing
    expect(byName['--color-primary'].layer).toBe('semantic'); // aliases a primitive
    expect(byName['--btn-bg'].layer).toBe('component'); // component-scoped local
    // The coarse naming tier (global/block) is untouched by the deeper layer.
    expect(byName['--c-blue'].tier).toBe('global');
    expect(byName['--btn-bg'].tier).toBe('block');
  });

  it('reports the layering axis: per-tier counts, tier count, and a healthy downward flow', () => {
    const dir = fixture(threeTier);
    const audit = analyze({ root: dir, slug: 'l', exclude: [], top: 10 });
    const lay = audit.model.axes.layering;
    expect(lay.tiers.primitive.tokenCount).toBe(1); // --c-blue
    expect(lay.tiers.semantic.tokenCount).toBe(1); // --color-primary
    expect(lay.tiers.component.tokenCount).toBe(1); // --btn-bg
    expect(lay.tierCount).toBe(3); // all three tiers populated
    // Every token→token edge flows down-tier: no leaks.
    expect(lay.flow.direction).toBe('downward');
    expect(lay.flow.backward).toBe(0);
    expect(lay.flow.healthy).toBeGreaterThan(0);
  });

  it('emits a tier-leak when value flows up-tier — a component token consumed as a base value', () => {
    // --leaky (global semantic) reads a component-scoped token: value flows
    // component → semantic, the wrong way. Judged against the codebase's own
    // tiering → basis convention.
    const dir = fixture({ 'a.css': ':root{--leaky:var(--btn-bg)} .btn{--btn-bg:red}' });
    const audit = analyze({ root: dir, slug: 'bk', exclude: [], top: 10 });
    expect(audit.model.axes.layering.flow.backward).toBe(1);
    expect(audit.model.axes.layering.flow.direction).toBe('mixed');
    const f = audit.findings.find((x) => x.type === 'tier-leak');
    expect(f.basis).toBe('convention');
    expect(f.confidence).toBe('medium');
    expect(f.title).toContain('--leaky');
    expect(f.title).toContain('--btn-bg');
    expect(f.evidence).toMatch(/primitive.*semantic.*component/); // cites the tiering norm
  });

  it('emits a universal tier-leak for a circular var() chain', () => {
    const dir = fixture({ 'a.css': ':root{--a:var(--b);--b:var(--a)}' });
    const audit = analyze({ root: dir, slug: 'cyc', exclude: [], top: 10 });
    expect(audit.model.axes.layering.flow.direction).toBe('circular');
    const f = audit.findings.find((x) => x.type === 'tier-leak' && x.basis === 'universal');
    expect(f.confidence).toBe('high'); // a value that can never resolve — provable
    expect(f.title.toLowerCase()).toContain('circular');
    expect(f.evidence).toContain('--a');
    expect(f.evidence).toContain('--b');
  });

  it('flags a tier-skip only when routing through a semantic is the codebase norm', () => {
    // Two components route through a semantic; one reaches a primitive directly.
    // Semantic-routing is the majority → the direct one is the outlier.
    const dir = fixture({
      'a.css':
        ':root{--c-a:#1;--c-b:#2;--s-a:var(--c-a);--s-b:var(--c-b)}' +
        ' .w1{--w1:var(--s-a)} .w2{--w2:var(--s-b)} .w3{--w3:var(--c-a)}',
    });
    const audit = analyze({ root: dir, slug: 'sk', exclude: [], top: 10 });
    expect(audit.model.axes.layering.flow.norm).toBe('semantic');
    const f = audit.findings.find((x) => x.type === 'tier-leak' && x.title.includes('--w3'));
    expect(f.basis).toBe('convention');
    expect(f.confidence).toBe('low'); // routing-through-semantic may be intentional
    expect(f.title).toContain('--c-a');
    expect(f.evidence).toMatch(/semantic/); // cites the routing norm
  });

  // Guard (green-critical): both test beds route components DIRECTLY to
  // primitives, so a direct reference is the house style — never a leak.
  it('does not flag a tier-skip when direct-to-primitive is the norm', () => {
    const dir = fixture({
      'a.css':
        ':root{--c-a:#1;--c-b:#2;--c-c:#3;--s-a:var(--c-a)}' +
        ' .w1{--w1:var(--c-a)} .w2{--w2:var(--c-b)} .w3{--w3:var(--c-c)} .w4{--w4:var(--s-a)}',
    });
    const audit = analyze({ root: dir, slug: 'dir', exclude: [], top: 10 });
    expect(audit.model.axes.layering.flow.norm).toBe('direct');
    expect(audit.findings.some((f) => f.type === 'tier-leak')).toBe(false);
  });
});

describe('scope & cascade axis', () => {
  // Each DEFINITION is classified by the cascade scope it lives in — statically,
  // from the selector + any enclosing @-rule:
  //   root      — unconditional :root / html (the base value)
  //   theme     — root-level but CONDITIONAL: a variant selector ([data-theme=…])
  //               or an @-rule (@media prefers-color-scheme / breakpoint)
  //   component — under a component (class / [class*=…]) selector
  // Orthogonal to the coarse `tier` (global/block) — a token can hold defs in
  // several cascade scopes (that is exactly what an override is).
  const themed = {
    'a.css':
      ':root{--clr-ink:#111;--theme-bg:#fff}' +
      '[data-theme=dark]{--theme-bg:#000}' +
      '@media (prefers-color-scheme:dark){:root{--theme-bg:#000}}' +
      ' .b_card{--card-gap:1rem;color:var(--theme-bg)}',
  };

  it('classifies each definition by cascade scope: root / theme / component', () => {
    const dir = fixture(themed);
    const audit = analyze({ root: dir, slug: 'sc', exclude: [], top: 10 });
    const byName = Object.fromEntries(audit.model.tokens.map((t) => [t.name, t]));
    // Unconditional :root base.
    expect(byName['--clr-ink'].definitions[0].cascadeScope).toBe('root');
    // --theme-bg has a root base + two conditional variants (attr + media).
    const bgScopes = byName['--theme-bg'].definitions.map((d) => d.cascadeScope).sort();
    expect(bgScopes).toEqual(['root', 'theme', 'theme']);
    // Component-scoped local.
    expect(byName['--card-gap'].definitions[0].cascadeScope).toBe('component');
  });

  it('reports scope counts and override sites', () => {
    const dir = fixture(themed);
    const audit = analyze({ root: dir, slug: 'sc', exclude: [], top: 10 });
    const sc = audit.model.axes.scopeCascade;
    // Per-token home scope (root if it has any unconditional :root base).
    expect(sc.scopes.root).toBe(2); // --clr-ink, --theme-bg
    expect(sc.scopes.component).toBe(1); // --card-gap
    // --theme-bg is the one overridden token: a root base + 2 theme variants.
    expect(sc.overrides.tokenCount).toBe(1);
    expect(sc.overrides.themeVariants).toBe(1);
    const site = sc.overrides.sites.find((s) => s.name === '--theme-bg');
    expect(site.kind).toBe('theme');
    expect(site.overrides.length).toBe(2); // the two conditional variants
    // The dominant override kind on this codebase.
    expect(sc.overrides.norm).toBe('theme');
  });

  it('approximates the theming wiring: mechanisms + a style', () => {
    const dir = fixture(themed);
    const audit = analyze({ root: dir, slug: 'sc', exclude: [], top: 10 });
    const th = audit.model.axes.scopeCascade.theming;
    expect(th.themedTokens).toBe(1); // --theme-bg
    const conditions = th.mechanisms.map((m) => m.condition);
    expect(conditions).toContain('[data-theme=dark]');
    expect(conditions.some((c) => /prefers-color-scheme/.test(c))).toBe(true);
    // Two mechanism families (a color-scheme media query + a data-attr toggle).
    expect(th.style).toBe('mixed');
  });

  // Guard: a variant family that isn't colour theming (reduced-motion token
  // swaps, wattage's shape) is still theming — style must name it, never read
  // 'none' while tokens vary conditionally.
  it('names a non-colour variant family rather than reporting no theming', () => {
    const dir = fixture({
      'a.css':
        ':root{--motion:0.3s}@media (prefers-reduced-motion:no-preference){:root{--motion:0.3s}}' +
        ':root{--dur:1s}@media (prefers-reduced-motion:no-preference){:root{--dur:0s}}',
    });
    const audit = analyze({ root: dir, slug: 'mo', exclude: [], top: 10 });
    const th = audit.model.axes.scopeCascade.theming;
    expect(th.themedTokens).toBeGreaterThan(0);
    expect(th.style).not.toBe('none'); // a themed codebase is never 'none'
    expect(th.style).toBe('motion');
  });

  it('emits a universal cascade-smell for a shadowed definition (same scope, different value)', () => {
    // Two values for --x under the identical scope: source order decides, so the
    // first can NEVER win — dead code, provable from the AST. Distinct from an
    // exact-duplicate (identical value) and from a legitimate cross-scope override.
    const dir = fixture({ 'a.css': ':root{--x:red;--x:blue}' });
    const audit = analyze({ root: dir, slug: 'sh', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'cascade-smell' && x.basis === 'universal');
    expect(f.confidence).toBe('high');
    expect(f.title.toLowerCase()).toMatch(/shadow|never win|unreachable/);
    expect(f.evidence).toContain('--x');
    // Not misreported as an exact-duplicate (values differ).
    expect(audit.findings.some((x) => x.type === 'exact-duplicate')).toBe(false);
  });

  it('flags a component overriding a global token only when theming is the override norm', () => {
    // Two globals are re-themed via a variant (theme is the override norm); one
    // global is instead redefined inside a component — a deviation from the norm.
    const dir = fixture({
      'a.css':
        ':root{--theme-bg:#fff;--theme-text:#111;--brand:#f00}' +
        '[data-theme=dark]{--theme-bg:#000;--theme-text:#eee}' +
        ' .b_card{--brand:#00f}',
    });
    const audit = analyze({ root: dir, slug: 'st', exclude: [], top: 10 });
    expect(audit.model.axes.scopeCascade.overrides.norm).toBe('theme');
    const f = audit.findings.find(
      (x) => x.type === 'cascade-smell' && x.title.includes('--brand')
    );
    expect(f.basis).toBe('convention'); // judged against the codebase's own norm
    expect(f.confidence).toBe('low'); // a local override may be intentional
    expect(f.title).toContain('.b_card');
    expect(f.evidence).toMatch(/theme/); // cites the theming norm
  });

  // Guard (green-critical): a codebase whose overrides are mostly component /
  // local (wattage's shape) must NOT flag component overrides — there, a local
  // redefinition IS the house style, not a smell.
  it('does not flag a component override when local/component overriding is the norm', () => {
    const dir = fixture({
      'a.css':
        ':root{--brand:#f00}' +
        ' .b_a{--x:1} .b_a{--x:2px}' + // treated as local multi-scope shapes
        ' .b_b{--y:1} .b_c{--y:2}' +
        ' .b_card{--brand:#00f}', // a component override, but norm is not theme
    });
    const audit = analyze({ root: dir, slug: 'nt', exclude: [], top: 10 });
    expect(audit.model.axes.scopeCascade.overrides.norm).not.toBe('theme');
    expect(audit.findings.some((f) => f.type === 'cascade-smell' && f.title.includes('--brand'))).toBe(
      false
    );
  });
});
