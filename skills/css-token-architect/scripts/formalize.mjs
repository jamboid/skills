#!/usr/bin/env node
/**
 * css-token-architect — formalize a target architecture (slice #35).
 *
 * Reads the audit's `audit.json` (the model + findings) and the human's
 * `conventions.json` (the disposed decisions + promoted house rules) and emits
 * a `target.json` in the shared schema family, plus a rendered target report.
 *
 * Risk posture is **proposes** (PRD §3): the architect writes only its own
 * `target.json` and report. It never touches source CSS.
 *
 * `target.json` is GENERATED — never hand-edited. Re-run this script. The
 * conventions file is the human-editable input.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { assertSchema, newTargetDoc } from './schema.mjs';

// ── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { audit: null, conventions: null, out: 'target.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audit') args.audit = argv[++i];
    else if (a === '--conventions') args.conventions = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

/**
 * What a disposition means for the target. `fix` is a real problem the refactor
 * must change; `accept` is an intentional exception the later formalization
 * passes must NOT "helpfully" fix. Both are confirmed human decisions — the
 * target carries them forward, it doesn't re-litigate them.
 */
const INTENT = { fix: 'change', accept: 'keep' };

/** A stale disposition has no finding to join, so recover what the fingerprint
 *  itself encodes (`type:subject`) rather than emitting a decision about nothing. */
function splitFingerprint(fingerprint) {
  const i = String(fingerprint).indexOf(':');
  if (i < 0) return {};
  return { type: fingerprint.slice(0, i), subject: fingerprint.slice(i + 1) };
}

/** Confirmed dispositions → structured target decisions, joined to their finding. */
export function buildDecisions(audit, conventions) {
  const dispositions = (conventions && conventions.dispositions) || {};
  const byFingerprint = new Map((audit.findings || []).map((f) => [f.fingerprint, f]));
  const decisions = [];
  let n = 0;

  for (const [fingerprint, entry] of Object.entries(dispositions)) {
    const intent = INTENT[entry && entry.disposition];
    if (!intent) continue; // an unknown disposition is not a decision we can act on
    const f = byFingerprint.get(fingerprint);
    decisions.push({
      id: `D${++n}`,
      fingerprint,
      disposition: entry.disposition,
      intent,
      // A disposition the current audit no longer raises — the token was removed,
      // or the finding stopped firing. Carried, never silently dropped: a human
      // decided it, and the target says so plainly.
      stale: !f,
      ...(entry.note ? { note: entry.note } : {}),
      ...(f
        ? { type: f.type, subject: f.subject, basis: f.basis, confidence: f.confidence }
        : splitFingerprint(fingerprint)),
      ...(f && f.title ? { title: f.title } : {}),
      ...(f && f.locations ? { locations: f.locations } : {}),
    });
  }
  return decisions;
}

/**
 * Promoted house rules → standing target constraints. A disposition settles one
 * finding; a house rule is a rule the whole target must satisfy, so it lives in
 * its own section rather than among the per-token decisions.
 */
export function buildConstraints(conventions) {
  const houseRules = (conventions && conventions.houseRules) || {};
  let n = 0;
  return Object.entries(houseRules).map(([rule, r]) => ({
    id: `C${++n}`,
    rule,
    kind: r.kind,
    ...(r.tier ? { tier: r.tier } : {}),
    // Copied, not aliased: the target is a generated document and must not hand
    // out a reference into the human's conventions file.
    ...(Array.isArray(r.allowed) ? { allowed: [...r.allowed] } : {}),
    ...(r.title ? { title: r.title } : {}),
    ...(r.note ? { note: r.note } : {}),
  }));
}

export function formalize({ audit, conventions = null }) {
  // The cross-skill refusal (#34): a major we can't read fails loud and early,
  // rather than being silently mis-read into a wrong target.
  assertSchema(audit, 'audit.json');

  const target = newTargetDoc({
    project: audit.meta && audit.meta.project,
    slug: audit.meta && audit.meta.slug,
    root: audit.meta && audit.meta.root,
  });
  target.decisions = buildDecisions(audit, conventions);
  target.constraints = buildConstraints(conventions);
  target.summary = {
    decisionCount: target.decisions.length,
    constraintCount: target.constraints.length,
    changeCount: target.decisions.filter((d) => d.intent === 'change').length,
    keepCount: target.decisions.filter((d) => d.intent === 'keep').length,
    staleCount: target.decisions.filter((d) => d.stale).length,
  };
  return target;
}

/** Read a conventions file if there is one. Absent is the normal first run —
 *  nothing curated yet — so it's not an error; malformed JSON still throws. */
function readConventions(path) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.audit) {
    console.error('usage: formalize.mjs --audit audit.json [--conventions conventions.json] [--out target.json]');
    process.exit(1);
  }
  const audit = JSON.parse(readFileSync(args.audit, 'utf8'));
  const target = formalize({ audit, conventions: readConventions(args.conventions) });
  // The only write this skill ever performs, besides the report. Proposes-only:
  // source CSS is read by the audit and never touched here.
  writeFileSync(args.out, JSON.stringify(target, null, 2));
  console.error(
    `css-token-architect: ${target.summary.decisionCount} decision(s), ` +
      `${target.summary.constraintCount} constraint(s) → ${args.out}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();

export { parseArgs };
