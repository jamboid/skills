import { describe, it, expect } from 'vitest';

import { renderTargetReport } from '../../skills/css-token-architect/scripts/build_target_report.mjs';
import { formalize } from '../../skills/css-token-architect/scripts/formalize.mjs';
import { SCHEMA_VERSION } from '../../skills/css-token-architect/scripts/schema.mjs';

const audit = {
  schemaVersion: SCHEMA_VERSION,
  meta: { project: 'jbdn', slug: 'jbdn', root: '/abs/jbdn/site', date: '2026-07-11' },
  findings: [
    {
      id: 'F1',
      type: 'dead-token',
      subject: '--clr-blue',
      fingerprint: 'dead-token:--clr-blue',
      basis: 'universal',
      confidence: 'medium',
      title: 'Dead token `--clr-blue` — defined but never referenced',
      locations: [{ selector: ':root', file: 'css/tokens.css', line: 12 }],
    },
  ],
};

const conventions = {
  conventionsVersion: '1.0.0',
  project: 'jbdn',
  dispositions: {
    'dead-token:--clr-blue': { disposition: 'fix', note: 'genuinely unused' },
    'near-duplicate:--space-xs': { disposition: 'accept', note: 'deliberate pair' },
  },
  houseRules: {
    'naming-prefix:global': {
      kind: 'naming-prefix',
      tier: 'global',
      allowed: ['clr', 'fw', 'space'],
      title: 'Global tokens use a known category prefix',
    },
  },
};

const target = () => formalize({ audit, conventions });

describe('renderTargetReport', () => {
  it('refuses a target whose schema major it cannot render', () => {
    expect(() => renderTargetReport({ ...target(), schemaVersion: '2.0.0' })).toThrow(/target\.json/);
  });

  it('heads the report with the project and the generated-not-edited discipline', () => {
    const md = renderTargetReport(target());

    expect(md).toMatch(/# .*jbdn/);
    expect(md).toMatch(/generated/i);
  });

  it('reports the decision counts', () => {
    const md = renderTargetReport(target());

    expect(md).toMatch(/2 decision/i);
    expect(md).toMatch(/1 constraint/i);
  });

  it('separates what changes from what is deliberately kept', () => {
    const md = renderTargetReport(target());
    const changeAt = md.indexOf('--clr-blue');
    const keepAt = md.indexOf('--space-xs');

    expect(md).toMatch(/## Changes/);
    expect(md).toMatch(/## Deliberately kept/);
    expect(changeAt).toBeGreaterThan(-1);
    expect(keepAt).toBeGreaterThan(changeAt);
  });

  it('carries each decision’s note — the human’s reasoning, not the tool’s', () => {
    const md = renderTargetReport(target());

    expect(md).toContain('genuinely unused');
    expect(md).toContain('deliberate pair');
  });

  it('marks a stale decision so a vanished finding is visible, not silent', () => {
    const md = renderTargetReport(target());

    expect(md).toMatch(/stale/i);
  });

  it('lists the standing constraints with their allowed vocabulary', () => {
    const md = renderTargetReport(target());

    expect(md).toMatch(/## Constraints/);
    expect(md).toContain('naming-prefix:global');
    expect(md).toContain('clr');
  });

  it('says plainly that nothing has been decided yet on an empty target', () => {
    const md = renderTargetReport(formalize({ audit }));

    expect(md).toMatch(/no decisions/i);
  });
});
