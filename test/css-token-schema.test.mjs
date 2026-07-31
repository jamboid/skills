import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The shared schema contract (slice #34). Unit-tested against the css-token-audit
// copy — the de-facto source — while the drift guard proves the css-token-architect
// copy stays byte-identical (policy A: copy + guard, not a build step).
import {
  SCHEMA_VERSION,
  SUPPORTED_MAJOR,
  CONVENTIONS_VERSION,
  DOCUMENT_KINDS,
  schemaMajor,
  assertSchema,
  newTargetDoc,
} from '../skills/css-token-audit/scripts/schema.mjs';
// The architect's bundled copy — imported to prove the refusal is genuinely
// cross-skill, not just the audit side.
import { assertSchema as architectAssertSchema } from '../skills/css-token-architect/scripts/schema.mjs';

const AUDIT_COPY = fileURLToPath(
  new URL('../skills/css-token-audit/scripts/schema.mjs', import.meta.url)
);
const ARCHITECT_COPY = fileURLToPath(
  new URL('../skills/css-token-architect/scripts/schema.mjs', import.meta.url)
);

describe('schema versioning (semver policy)', () => {
  it('SCHEMA_VERSION is a semver string', () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('SUPPORTED_MAJOR is the major of SCHEMA_VERSION', () => {
    expect(SUPPORTED_MAJOR).toBe(schemaMajor(SCHEMA_VERSION));
    expect(SUPPORTED_MAJOR).toBe(Number(SCHEMA_VERSION.split('.')[0]));
  });

  it('CONVENTIONS_VERSION is a semver string', () => {
    expect(CONVENTIONS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('schemaMajor parses the leading integer', () => {
    expect(schemaMajor('2.3.4')).toBe(2);
    expect(schemaMajor('10.0.0')).toBe(10);
  });
});

describe('assertSchema — cross-skill version refusal', () => {
  it('accepts a document whose major matches', () => {
    expect(() => assertSchema({ schemaVersion: SCHEMA_VERSION })).not.toThrow();
  });

  it('accepts a higher minor/patch of the same major (additive, back-compatible)', () => {
    expect(() => assertSchema({ schemaVersion: `${SUPPORTED_MAJOR}.99.99` })).not.toThrow();
  });

  it('refuses an incompatible major', () => {
    expect(() => assertSchema({ schemaVersion: `${SUPPORTED_MAJOR + 1}.0.0` })).toThrow(
      /Unsupported schemaVersion/
    );
  });

  it('refuses a document with no schemaVersion', () => {
    expect(() => assertSchema({})).toThrow(/missing a mandatory/);
    expect(() => assertSchema(null)).toThrow(/missing a mandatory/);
  });

  it('names the document label in the error', () => {
    expect(() => assertSchema({}, 'target.json')).toThrow(/target\.json/);
  });

  it("the architect's bundled copy refuses an incompatible major too (cross-skill)", () => {
    expect(() => architectAssertSchema({ schemaVersion: `${SUPPORTED_MAJOR + 1}.0.0` })).toThrow(
      /Unsupported schemaVersion/
    );
    expect(() => architectAssertSchema({ schemaVersion: SCHEMA_VERSION })).not.toThrow();
  });
});

describe('target-architecture document shape', () => {
  it('newTargetDoc carries the shared schemaVersion and the target kind', () => {
    const doc = newTargetDoc({ project: 'jbdn', slug: 'jbdn', root: '/abs' });
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.kind).toBe(DOCUMENT_KINDS.TARGET);
    expect(doc.meta.project).toBe('jbdn');
    expect(doc.meta.slug).toBe('jbdn');
    expect(doc.meta.root).toBe('/abs');
    expect(doc.meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a fresh target passes the shared version guard', () => {
    expect(() => assertSchema(newTargetDoc(), 'target.json')).not.toThrow();
  });

  it('audit and target are the same schema family (one version governs both)', () => {
    const audit = { schemaVersion: SCHEMA_VERSION, kind: DOCUMENT_KINDS.AUDIT };
    expect(() => assertSchema(audit)).not.toThrow();
    expect(() => assertSchema(newTargetDoc())).not.toThrow();
  });
});

describe('no divergent copies (drift guard, policy A)', () => {
  it('the architect schema.mjs is byte-identical to the audit copy', () => {
    const a = readFileSync(AUDIT_COPY);
    const b = readFileSync(ARCHITECT_COPY);
    expect(b.equals(a)).toBe(true);
  });
});
