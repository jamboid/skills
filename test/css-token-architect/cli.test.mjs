import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseArgs } from '../../skills/css-token-architect/scripts/formalize.mjs';
import { SCHEMA_VERSION } from '../../skills/css-token-architect/scripts/schema.mjs';

const SCRIPTS = new URL('../../skills/css-token-architect/scripts/', import.meta.url).pathname;

describe('formalize CLI — argument seam', () => {
  it('reads the audit, the conventions file and the output path', () => {
    const args = parseArgs(['--audit', 'audit.json', '--conventions', 'conventions.json', '--out', 'target.json']);

    expect(args).toMatchObject({ audit: 'audit.json', conventions: 'conventions.json', out: 'target.json' });
  });

  it('treats the conventions file as optional (first run, nothing curated)', () => {
    const args = parseArgs(['--audit', 'audit.json', '--out', 'target.json']);

    expect(args.conventions).toBeNull();
  });
});

describe('formalize CLI — end to end, proposes only', () => {
  let dir;
  const CSS = 'body { color: var(--clr-blue); }\n';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'css-token-architect-'));
    mkdirSync(join(dir, 'css'));
    writeFileSync(join(dir, 'css', 'tokens.css'), CSS);
    writeFileSync(
      join(dir, 'audit.json'),
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        meta: { project: 'jbdn', slug: 'jbdn', root: join(dir, 'css'), date: '2026-07-11' },
        findings: [
          {
            id: 'F1',
            type: 'dead-token',
            subject: '--clr-blue',
            fingerprint: 'dead-token:--clr-blue',
            basis: 'universal',
            confidence: 'medium',
            title: 'Dead token `--clr-blue`',
            locations: [{ selector: ':root', file: 'css/tokens.css', line: 1 }],
          },
        ],
      })
    );
    writeFileSync(
      join(dir, 'conventions.json'),
      JSON.stringify({
        conventionsVersion: '1.0.0',
        project: 'jbdn',
        dispositions: { 'dead-token:--clr-blue': { disposition: 'fix', note: 'unused' } },
        houseRules: {},
      })
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const run = (script, args) => execFileSync('node', [join(SCRIPTS, script), ...args], { encoding: 'utf8' });

  it('writes a target.json a downstream skill can read', () => {
    run('formalize.mjs', [
      '--audit',
      join(dir, 'audit.json'),
      '--conventions',
      join(dir, 'conventions.json'),
      '--out',
      join(dir, 'target.json'),
    ]);

    const target = JSON.parse(readFileSync(join(dir, 'target.json'), 'utf8'));
    expect(target.schemaVersion).toBe(SCHEMA_VERSION);
    expect(target.kind).toBe('target-architecture');
    expect(target.decisions[0]).toMatchObject({ fingerprint: 'dead-token:--clr-blue', intent: 'change' });
  });

  it('never touches the source CSS — the architect proposes, it does not mutate', () => {
    run('formalize.mjs', [
      '--audit',
      join(dir, 'audit.json'),
      '--conventions',
      join(dir, 'conventions.json'),
      '--out',
      join(dir, 'target.json'),
    ]);
    run('build_target_report.mjs', [join(dir, 'target.json'), '--out', join(dir, 'jbdn-token-target.md')]);

    expect(readFileSync(join(dir, 'css', 'tokens.css'), 'utf8')).toBe(CSS);
    expect(readdirSync(join(dir, 'css'))).toEqual(['tokens.css']);
    expect(readdirSync(dir).sort()).toEqual([
      'audit.json',
      'conventions.json',
      'css',
      'jbdn-token-target.md',
      'target.json',
    ]);
  });

  it('refuses an audit from an incompatible schema major, loudly', () => {
    writeFileSync(join(dir, 'audit.json'), JSON.stringify({ schemaVersion: '99.0.0', meta: {}, findings: [] }));

    expect(() =>
      run('formalize.mjs', ['--audit', join(dir, 'audit.json'), '--out', join(dir, 'target.json')])
    ).toThrow(/audit\.json/);
  });
});
