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

  it('emits a dead-token finding, universal basis', () => {
    const dir = fixture({ 'a.css': ':root{--gone:#000}' });
    const audit = analyze({ root: dir, slug: 'd', exclude: [], top: 10 });
    const f = audit.findings.find((x) => x.type === 'dead-token');
    expect(f.basis).toBe('universal');
    expect(f.title).toContain('--gone');
    expect(f.locations[0].file).toBe('a.css');
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
});
