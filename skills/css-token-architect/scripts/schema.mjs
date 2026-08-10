#!/usr/bin/env node
/**
 * css-tokens — the shared, versioned schema contract (slice #34).
 *
 * The single source of truth for the structured-data contract the whole
 * `css-tokens` arc is built on: `css-token-audit` emits `audit.json`,
 * `css-token-architect` emits `target.json`, and (eventually)
 * `css-token-refactor` consumes both. Because the three skills are authored and
 * installed independently (`npx skills add <one-skill>`), they can't share a
 * file above a skill dir — so this module is BUNDLED VERBATIM into each skill's
 * `scripts/`, and a repo drift-guard test asserts the copies stay byte-identical
 * (policy A; see docs/adr/0001-css-tokens-schema-versioning.md). Edit the
 * css-token-audit copy, then re-sync the others — never let them diverge.
 *
 * Versioning policy (semver + migration note, resolving PRD §9-Q1):
 *   - `schemaVersion` is a mandatory semver string on every structured document.
 *   - A skill refuses input whose MAJOR it doesn't support, rather than silently
 *     mis-reading it. Additive, backward-compatible fields bump minor/patch and
 *     are tolerated across a major. A breaking change bumps major and ships with
 *     a migration note in the ADR.
 *   - `audit.json` and `target.json` are ONE schema family under one
 *     `SCHEMA_VERSION`; the conventions file versions separately
 *     (`CONVENTIONS_VERSION`) because a human hand-edits it.
 */

// ── Versions (the single home for every contract version in the arc) ──────────

/** Structured-model schema — governs both `audit.json` and `target.json`.
 *  1.1.0 — additive (slice #35): the target grows `constraints` + `summary`
 *  alongside `decisions`. Minor bump per the ADR: an older reader ignores the
 *  new sections, a newer reader tolerates their absence. */
export const SCHEMA_VERSION = '1.1.0';

/** Human-editable conventions file — versions on its own cadence. */
export const CONVENTIONS_VERSION = '1.0.0';

/** The one major this build of the arc reads. Derived — never hand-set. */
export const SUPPORTED_MAJOR = schemaMajor(SCHEMA_VERSION);

/** The `kind` discriminator on a structured document (audit vs target). */
export const DOCUMENT_KINDS = Object.freeze({
  AUDIT: 'audit',
  TARGET: 'target-architecture',
});

// ── Version guard (the cross-skill refusal) ───────────────────────────────────

/** The leading integer of a semver string (the compatibility axis). */
export function schemaMajor(version) {
  return Number(String(version).split('.')[0]);
}

/**
 * Refuse a structured document whose schema MAJOR this build can't handle,
 * rather than silently mis-reading it. `label` names the offending document in
 * the error (e.g. `audit.json`, `target.json`) so a mismatch is self-explaining.
 */
export function assertSchema(doc, label = 'document') {
  const v = doc && doc.schemaVersion;
  if (!v || typeof v !== 'string') {
    throw new Error(`${label} is missing a mandatory \`schemaVersion\`.`);
  }
  const major = schemaMajor(v);
  if (!Number.isInteger(major) || major !== SUPPORTED_MAJOR) {
    throw new Error(
      `Unsupported schemaVersion ${v} in ${label}: this build handles major ${SUPPORTED_MAJOR}.x only. ` +
        'Re-run with a matching version of the css-tokens skills.'
    );
  }
}

// ── Target-architecture document (the architect's output envelope) ────────────

/**
 * A fresh `target.json` envelope — the shape `css-token-architect` emits, in the
 * same schema family as `audit.json`. Every section spine is present so an empty
 * target is still a well-shaped document: `decisions` (per-finding, from the
 * human's dispositions), `constraints` (standing rules, from promoted house
 * rules, #35), and the `summary` counts. Later slices (#36–#41) add the
 * consolidation, naming, tier, and tokenization sections. Full shape: REFERENCE.md.
 */
export function newTargetDoc({ project, slug, root, date } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: DOCUMENT_KINDS.TARGET,
    meta: {
      project: project || null,
      slug: slug || null,
      root: root || null,
      date: date || new Date().toISOString().slice(0, 10),
      generatedBy: 'css-token-architect',
    },
    // Confirmed dispositions carried forward as structured target decisions
    // (#35); the formalization passes extend this.
    decisions: [],
    // Promoted house rules as standing rules the whole target must satisfy (#35).
    constraints: [],
    summary: { decisionCount: 0, constraintCount: 0, changeCount: 0, keepCount: 0, staleCount: 0 },
  };
}
