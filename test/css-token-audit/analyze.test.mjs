import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, extractFacts, SCHEMA_VERSION } from '../../skills/css-token-audit/scripts/analyze.mjs';
import { renderReport, assertSchema } from '../../skills/css-token-audit/scripts/build_report.mjs';

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
