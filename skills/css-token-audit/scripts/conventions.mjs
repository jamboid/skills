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

/** A fresh, empty conventions object for a project (what `curate` scaffolds). */
export function emptyConventions(project) {
  return { conventionsVersion: CONVENTIONS_VERSION, project: project || null, dispositions: {} };
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
  return L.join('\n') + '\n';
}

// ── CLI: `curate` — record dispositions into the conventions file ───────────
function parseArgs(argv) {
  const args = { audit: null, conventions: null, out: null, md: null, project: null, entries: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audit') args.audit = argv[++i];
    else if (a === '--conventions') args.conventions = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--md') args.md = argv[++i];
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--accept') args.entries.push({ fingerprint: argv[++i], disposition: 'accept' });
    else if (a === '--fix') args.entries.push({ fingerprint: argv[++i], disposition: 'fix' });
    else if (a === '--note') {
      const last = args.entries[args.entries.length - 1];
      if (last) last.note = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const convPath = args.conventions || 'conventions.json';
  if (!args.entries.length) {
    console.error(
      'Usage: node conventions.mjs --conventions <file> [--audit audit.json] ' +
        '(--accept <fingerprint> [--note "…"] | --fix <fingerprint>)... [--md <conventions.md>]'
    );
    process.exit(2);
  }
  // Enrich entries with the finding title from audit.json, when available.
  if (args.audit) {
    try {
      const audit = JSON.parse(readFileSync(args.audit, 'utf8'));
      const byFp = new Map((audit.findings || []).map((f) => [f.fingerprint, f]));
      for (const e of args.entries) {
        const f = byFp.get(e.fingerprint);
        if (f) e.title = f.title;
      }
    } catch {
      // audit is optional context; proceed without titles
    }
  }
  const existing = loadConventions(convPath);
  const merged = recordDispositions(existing, args.entries, { project: args.project });
  const out = args.out || convPath;
  writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
  if (args.md) writeFileSync(args.md, renderConventions(merged));
  console.error(
    `css-token-audit: recorded ${args.entries.length} disposition(s) → ${out}` +
      (args.md ? ` (+ ${args.md})` : '')
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
