#!/usr/bin/env node
/**
 * css-token-audit — conventions file (the propose/dispose feedback loop, #24).
 *
 * The audit *proposes* findings; a human *disposes* of each one. Dispositions
 * persist to a versioned, human-readable **conventions file** — the audit's 4th
 * input, alongside the CSS tree, the CLI flags, and `notes.md`. Re-running the
 * audit reads it: an `accept`ed finding stays suppressed on that instance; the
 * rest re-surface.
 *
 * Source-of-truth discipline: this file is **human-editable**. `audit.json` and
 * the Markdown report stay **generated** — never hand-edited.
 *
 * Two dispositions in this slice:
 *   accept — a local exception; suppress THIS instance of the finding. Narrow.
 *   fix    — a real problem; leave it flagged (a refactor lead).
 *
 * Dispositions key on a finding's stable `fingerprint` (`type:subject`), not its
 * render-order `Fn` id, so a disposition survives other findings coming and going.
 */

import { readFileSync, writeFileSync } from 'node:fs';

export const CONVENTIONS_VERSION = '1.0.0';

const VALID = new Set(['accept', 'fix']);

// House-rule kinds `promote` knows how to enforce (#25). A candidate of an
// unknown kind is rejected — the audit must know how to raise its violations.
const VALID_KINDS = new Set(['naming-prefix']);

/** A fresh, empty conventions object for a project (what `curate` scaffolds). */
export function emptyConventions(project) {
  return { conventionsVersion: CONVENTIONS_VERSION, project: project || null, dispositions: {}, houseRules: {} };
}

/** Load a conventions file, or null if it's absent/unreadable. A malformed file
 *  throws — a curation record should never be silently ignored. */
export function loadConventions(path) {
  if (!path) return null;
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null; // no file yet — first run
  }
  const conv = JSON.parse(raw);
  if (!conv || typeof conv !== 'object' || typeof conv.dispositions !== 'object') {
    throw new Error(`Malformed conventions file ${path}: expected a { dispositions } object.`);
  }
  return conv;
}

/**
 * Annotate findings (in place) from a conventions object: stamp each curated
 * finding's `disposition` (and `note`), and mark an `accept`ed one `suppressed`.
 * Findings with no recorded disposition keep their `open`/un-suppressed defaults.
 * Returns the same array (all findings, curated or not — the audit stays complete).
 */
export function applyConventions(findings, conventions) {
  const dispositions = (conventions && conventions.dispositions) || {};
  for (const f of findings) {
    const entry = dispositions[f.fingerprint];
    if (!entry || !VALID.has(entry.disposition)) continue;
    f.disposition = entry.disposition;
    if (entry.note) f.note = entry.note;
    f.suppressed = entry.disposition === 'accept';
  }
  return findings;
}

/**
 * Merge disposition entries into a conventions object, returning a NEW object
 * (never mutating the input). Each entry is `{ fingerprint, disposition, note? }`;
 * a later entry for the same fingerprint replaces the earlier record. Existing
 * dispositions for untouched fingerprints are preserved — a curation pass never
 * clobbers the human's prior decisions.
 */
export function recordDispositions(conventions, entries, meta = {}) {
  const base = conventions || emptyConventions(meta.project);
  const dispositions = { ...base.dispositions };
  for (const e of entries) {
    if (!e || !e.fingerprint || !VALID.has(e.disposition)) {
      throw new Error(`Invalid disposition entry: ${JSON.stringify(e)} (need fingerprint + accept|fix).`);
    }
    dispositions[e.fingerprint] = {
      disposition: e.disposition,
      ...(e.note ? { note: e.note } : {}),
      ...(e.title ? { title: e.title } : {}),
      recordedAt: meta.date || new Date().toISOString().slice(0, 10),
    };
  }
  return {
    conventionsVersion: base.conventionsVersion || CONVENTIONS_VERSION,
    project: meta.project || base.project || null,
    dispositions,
    houseRules: { ...(base.houseRules || {}) },
  };
}

/**
 * Promote a house-rule candidate (from `model.axes.houseRuleCandidates`) into the
 * conventions file — the third, broadest disposition (#25). Returns a NEW object
 * (never mutates the input); the candidate's `allowed` set is FROZEN into the rule
 * at promote time, so the enshrined vocabulary doesn't drift as the codebase
 * changes. Existing dispositions and other house rules are preserved.
 */
export function promoteRule(conventions, candidate, meta = {}) {
  if (!candidate || !candidate.rule || !VALID_KINDS.has(candidate.kind) || !Array.isArray(candidate.allowed)) {
    throw new Error(
      `Invalid house-rule candidate: ${JSON.stringify(candidate)} (need rule + known kind + allowed[]).`
    );
  }
  const base = conventions || emptyConventions(meta.project);
  const houseRules = { ...(base.houseRules || {}) };
  houseRules[candidate.rule] = {
    kind: candidate.kind,
    tier: candidate.tier,
    allowed: [...candidate.allowed],
    ...(candidate.title ? { title: candidate.title } : {}),
    ...(meta.note ? { note: meta.note } : {}),
    recordedAt: meta.date || new Date().toISOString().slice(0, 10),
  };
  return {
    conventionsVersion: base.conventionsVersion || CONVENTIONS_VERSION,
    project: meta.project || base.project || null,
    dispositions: { ...(base.dispositions || {}) },
    houseRules,
  };
}

/** Render a conventions object to a human-readable Markdown view. The JSON stays
 *  the source of truth; this is the readable companion (PRD open question). */
export function renderConventions(conventions) {
  const c = conventions || emptyConventions(null);
  const entries = Object.entries(c.dispositions || {});
  const L = [];
  L.push(`# CSS token audit — conventions${c.project ? ` (${c.project})` : ''}`);
  L.push('');
  L.push(
    `_Conventions v${c.conventionsVersion || CONVENTIONS_VERSION} · ${entries.length} disposition(s)._ ` +
      'This file is **human-editable** — the audit reads it as a 4th input. `audit.json` ' +
      'and the report stay generated.'
  );
  L.push('');
  const accepted = entries.filter(([, e]) => e.disposition === 'accept');
  const fixed = entries.filter(([, e]) => e.disposition === 'fix');
  const section = (heading, blurb, rows) => {
    L.push(`## ${heading} (${rows.length})`);
    L.push('');
    L.push(blurb);
    L.push('');
    if (!rows.length) {
      L.push('_None._');
      L.push('');
      return;
    }
    for (const [fp, e] of rows) {
      L.push(`- \`${fp}\``);
      if (e.title) L.push(`  - ${e.title}`);
      if (e.note) L.push(`  - note: ${e.note}`);
      if (e.recordedAt) L.push(`  - recorded: ${e.recordedAt}`);
    }
    L.push('');
  };
  section('Accepted (suppressed)', 'Local exceptions — suppressed on this instance, kept quiet across runs.', accepted);
  section('Fix (left flagged)', 'Triaged as real problems — they stay flagged as refactor leads.', fixed);
  const rules = Object.entries(c.houseRules || {});
  L.push(`## House rules (promoted) (${rules.length})`);
  L.push('');
  L.push(
    'Broad, enforced preferences — the audit raises a `basis: house-rule` finding for every ' +
      'violation on each run. Delete a rule here to stop enforcing it.'
  );
  L.push('');
  if (!rules.length) {
    L.push('_None._');
    L.push('');
  } else {
    for (const [rule, r] of rules) {
      L.push(`- \`${rule}\` — ${r.title || r.kind}`);
      if (Array.isArray(r.allowed)) L.push(`  - allowed: ${r.allowed.map((p) => `\`${p}-\``).join(', ')}`);
      if (r.note) L.push(`  - note: ${r.note}`);
      if (r.recordedAt) L.push(`  - recorded: ${r.recordedAt}`);
    }
    L.push('');
  }
  return L.join('\n') + '\n';
}

/** Render the preview of NEW violations that promoting a candidate would raise —
 *  the confirmation gate's payload (#25). Promotion is broad; the human sees the
 *  blast radius before it persists. */
export function previewHouseRule(candidate) {
  const L = [];
  L.push(`Promote \`${candidate.rule}\` — ${candidate.title}`);
  L.push(`  Allowed vocabulary: ${(candidate.allowed || []).map((p) => `${p}-`).join(', ')}`);
  L.push(`  ⚠ Enforcing this house rule would raise ${candidate.violationCount} new violation(s):`);
  for (const v of candidate.violations || []) L.push(`    - ${v.name} (prefix \`${v.prefix}-\`)`);
  return L.join('\n');
}

// ── CLI: `curate` — record dispositions into the conventions file ───────────
function parseArgs(argv) {
  const args = { audit: null, conventions: null, out: null, md: null, project: null, confirm: false, entries: [], promotions: [] };
  let last = null; // the entry/promotion a trailing --note attaches to
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audit') args.audit = argv[++i];
    else if (a === '--conventions') args.conventions = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--md') args.md = argv[++i];
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--confirm') args.confirm = true;
    else if (a === '--accept') args.entries.push((last = { fingerprint: argv[++i], disposition: 'accept' }));
    else if (a === '--fix') args.entries.push((last = { fingerprint: argv[++i], disposition: 'fix' }));
    else if (a === '--promote') args.promotions.push((last = { rule: argv[++i] }));
    else if (a === '--note' && last) last.note = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const convPath = args.conventions || 'conventions.json';
  if (!args.entries.length && !args.promotions.length) {
    console.error(
      'Usage: node conventions.mjs --conventions <file> [--audit audit.json] (\n' +
        '  --accept <fingerprint> [--note "…"] | --fix <fingerprint> |\n' +
        '  --promote <ruleId> [--note "…"] [--confirm]\n' +
        ')... [--md <conventions.md>]\n' +
        '`--promote` without `--confirm` previews the new violations; nothing is written.'
    );
    process.exit(2);
  }
  let audit = null;
  if (args.audit) {
    try {
      audit = JSON.parse(readFileSync(args.audit, 'utf8'));
    } catch {
      // audit is optional context; proceed without it
    }
  }
  let conv = loadConventions(convPath);

  // Promotions (#25) — preview the blast radius always; persist only with --confirm.
  if (args.promotions.length) {
    const candidates = new Map(((audit && audit.model?.axes?.houseRuleCandidates) || []).map((c) => [c.rule, c]));
    for (const p of args.promotions) {
      const cand = candidates.get(p.rule);
      if (!cand) {
        console.error(
          `css-token-audit: no promotable candidate \`${p.rule}\` in ${args.audit || '(no --audit)'} — run \`draft\` first.`
        );
        process.exit(2);
      }
      console.log(previewHouseRule(cand));
      if (args.confirm) conv = promoteRule(conv, cand, { project: args.project, note: p.note });
    }
    if (!args.confirm) {
      console.error('css-token-audit: preview only — re-run with --confirm to persist the house rule(s).');
    }
  }

  // Dispositions (accept/fix, #24) — enrich with titles from audit.json when present.
  if (args.entries.length) {
    if (audit) {
      const byFp = new Map((audit.findings || []).map((f) => [f.fingerprint, f]));
      for (const e of args.entries) {
        const f = byFp.get(e.fingerprint);
        if (f) e.title = f.title;
      }
    }
    conv = recordDispositions(conv, args.entries, { project: args.project });
  }

  // Write only when something is actually persisted: any disposition, or a
  // CONFIRMED promotion. A bare promote preview leaves the file untouched.
  const persisting = args.entries.length > 0 || (args.promotions.length > 0 && args.confirm);
  if (persisting) {
    const merged = conv || emptyConventions(args.project);
    const out = args.out || convPath;
    writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
    if (args.md) writeFileSync(args.md, renderConventions(merged));
    console.error(
      `css-token-audit: recorded ${args.entries.length} disposition(s)` +
        (args.confirm && args.promotions.length ? `, ${args.promotions.length} house rule(s)` : '') +
        ` → ${out}` +
        (args.md ? ` (+ ${args.md})` : '')
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
