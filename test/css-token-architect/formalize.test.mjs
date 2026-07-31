import { describe, it, expect } from 'vitest';

import { formalize } from '../../skills/css-token-architect/scripts/formalize.mjs';
import { SCHEMA_VERSION, DOCUMENT_KINDS, assertSchema } from '../../skills/css-token-architect/scripts/schema.mjs';

/** A minimal well-formed audit doc — the architect's first input. */
function auditDoc({ findings = [], version = SCHEMA_VERSION } = {}) {
  return {
    schemaVersion: version,
    meta: { project: 'jbdn', slug: 'jbdn', root: '/abs/jbdn/site', date: '2026-07-11' },
    summary: { tokenCount: 3 },
    model: { axes: {} },
    findings,
  };
}

describe('formalize — the target envelope', () => {
  it('emits a target document in the shared schema family', () => {
    const target = formalize({ audit: auditDoc() });

    expect(target.schemaVersion).toBe(SCHEMA_VERSION);
    expect(target.kind).toBe(DOCUMENT_KINDS.TARGET);
    expect(() => assertSchema(target, 'target.json')).not.toThrow();
  });

  it('refuses an audit whose schema major it does not support', () => {
    expect(() => formalize({ audit: auditDoc({ version: '2.0.0' }) })).toThrow(/audit\.json/);
  });

  it('carries the audited project through to the target meta', () => {
    const target = formalize({ audit: auditDoc() });

    expect(target.meta.project).toBe('jbdn');
    expect(target.meta.root).toBe('/abs/jbdn/site');
    expect(target.meta.generatedBy).toBe('css-token-architect');
  });
});

/** One audit finding, as `analyze.mjs` stamps it. */
function finding(over = {}) {
  return {
    id: 'F1',
    type: 'dead-token',
    subject: '--clr-blue',
    fingerprint: 'dead-token:--clr-blue',
    basis: 'universal',
    confidence: 'medium',
    title: 'Dead token `--clr-blue` — defined but never referenced',
    locations: [{ selector: ':root', file: 'css/tokens.css', line: 12 }],
    evidence: '--clr-blue is defined 1× but has zero `var()` references.',
    ...over,
  };
}

/** A conventions file after a curation pass. */
function conventionsDoc({ dispositions = {}, houseRules = {} } = {}) {
  return { conventionsVersion: '1.0.0', project: 'jbdn', dispositions, houseRules };
}

describe('formalize — confirmed dispositions become target decisions', () => {
  it('turns a `fix` into a decision to change', () => {
    const target = formalize({
      audit: auditDoc({ findings: [finding()] }),
      conventions: conventionsDoc({
        dispositions: {
          'dead-token:--clr-blue': { disposition: 'fix', note: 'genuinely unused', recordedAt: '2026-07-11' },
        },
      }),
    });

    expect(target.decisions).toHaveLength(1);
    expect(target.decisions[0]).toMatchObject({
      fingerprint: 'dead-token:--clr-blue',
      disposition: 'fix',
      intent: 'change',
      note: 'genuinely unused',
    });
  });

  it('turns an `accept` into a decision to keep — an exception later passes must not "fix"', () => {
    const target = formalize({
      audit: auditDoc({ findings: [finding()] }),
      conventions: conventionsDoc({
        dispositions: {
          'dead-token:--clr-blue': { disposition: 'accept', note: 'public API token', recordedAt: '2026-07-11' },
        },
      }),
    });

    expect(target.decisions[0]).toMatchObject({ disposition: 'accept', intent: 'keep' });
  });

  it('joins each decision to the audit finding it disposes of', () => {
    const target = formalize({
      audit: auditDoc({ findings: [finding()] }),
      conventions: conventionsDoc({
        dispositions: { 'dead-token:--clr-blue': { disposition: 'fix' } },
      }),
    });

    expect(target.decisions[0]).toMatchObject({
      type: 'dead-token',
      subject: '--clr-blue',
      basis: 'universal',
      confidence: 'medium',
      locations: [{ selector: ':root', file: 'css/tokens.css', line: 12 }],
    });
  });

  it('leaves decisions empty when nothing has been disposed of yet', () => {
    const target = formalize({ audit: auditDoc({ findings: [finding()] }), conventions: conventionsDoc() });

    expect(target.decisions).toEqual([]);
  });

  it('works with no conventions file at all (first run, nothing curated)', () => {
    const target = formalize({ audit: auditDoc({ findings: [finding()] }) });

    expect(target.decisions).toEqual([]);
  });
});

describe('formalize — stale dispositions are carried, never silently dropped', () => {
  it('carries a disposition whose finding the audit no longer raises, flagged stale', () => {
    const target = formalize({
      audit: auditDoc({ findings: [finding()] }),
      conventions: conventionsDoc({
        dispositions: {
          'dead-token:--clr-blue': { disposition: 'fix' },
          'near-duplicate:--space-xs': { disposition: 'accept', note: 'deliberate' },
        },
      }),
    });

    const stale = target.decisions.find((d) => d.fingerprint === 'near-duplicate:--space-xs');
    expect(stale).toBeDefined();
    expect(stale.stale).toBe(true);
    expect(stale.intent).toBe('keep');
  });

  it('does not flag a decision whose finding is still raised', () => {
    const target = formalize({
      audit: auditDoc({ findings: [finding()] }),
      conventions: conventionsDoc({ dispositions: { 'dead-token:--clr-blue': { disposition: 'fix' } } }),
    });

    expect(target.decisions[0].stale).toBe(false);
  });

  it('counts stale decisions in the summary', () => {
    const target = formalize({
      audit: auditDoc({ findings: [finding()] }),
      conventions: conventionsDoc({
        dispositions: {
          'dead-token:--clr-blue': { disposition: 'fix' },
          'near-duplicate:--space-xs': { disposition: 'accept' },
        },
      }),
    });

    expect(target.summary).toMatchObject({ decisionCount: 2, changeCount: 1, keepCount: 1, staleCount: 1 });
  });
});

describe('formalize — promoted house rules become target constraints', () => {
  const houseRules = {
    'naming-prefix:global': {
      kind: 'naming-prefix',
      tier: 'global',
      allowed: ['clr', 'fw', 'space'],
      title: 'Global tokens use a known category prefix',
      note: 'the house style',
      recordedAt: '2026-07-11',
    },
  };

  it('carries each promoted rule through as a standing constraint', () => {
    const target = formalize({ audit: auditDoc(), conventions: conventionsDoc({ houseRules }) });

    expect(target.constraints).toHaveLength(1);
    expect(target.constraints[0]).toMatchObject({
      id: 'C1',
      rule: 'naming-prefix:global',
      kind: 'naming-prefix',
      tier: 'global',
      allowed: ['clr', 'fw', 'space'],
      note: 'the house style',
    });
  });

  it('copies the allowed vocabulary rather than aliasing the conventions file', () => {
    const conventions = conventionsDoc({ houseRules });
    const target = formalize({ audit: auditDoc(), conventions });

    target.constraints[0].allowed.push('mutated');
    expect(conventions.houseRules['naming-prefix:global'].allowed).toEqual(['clr', 'fw', 'space']);
  });

  it('leaves constraints empty when nothing has been promoted', () => {
    const target = formalize({ audit: auditDoc(), conventions: conventionsDoc() });

    expect(target.constraints).toEqual([]);
  });

  it('counts constraints in the summary', () => {
    const target = formalize({ audit: auditDoc(), conventions: conventionsDoc({ houseRules }) });

    expect(target.summary.constraintCount).toBe(1);
  });
});
