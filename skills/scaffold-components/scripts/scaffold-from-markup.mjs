#!/usr/bin/env node
// Reverse scaffolder: read an existing component's markup (.njk/.twig) and
// derive the CSS block(s) and JS behaviour(s) it references, joined only by
// `b_*` classes and `data-*` hooks — the starter's portability contract
// (CONTEXT.md). Emits convention-correct stubs for you to fill in.
//
//   npm run scaffold:markup -- eleventy/_includes/components/foo.njk
//   npm run scaffold:markup -- path/to/foo.njk --dry-run
//   npm run scaffold:markup -- path/to/foo.njk --no-wire
//
// Idempotent + additive by design: it NEVER clobbers hand-edited rules. New
// files are generated whole; existing block CSS gets only its *missing*
// selectors appended; existing behaviours and manifest entries are left alone.
// So the loop is: add classes/hooks to markup, re-run, fill in the new stubs.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the target project's root from the working directory (nearest
// ancestor with a package.json), NOT this script's own location — so the same
// script works whether it lives in the project's bin/ or is bundled in a skill
// and run against another project. Both the full starter and an extracted
// theme-pipeline (assets/) carry a package.json at their root.
export function resolveProjectRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start); // no package.json — fall back
    dir = parent;
  }
}

const ROOT = resolveProjectRoot();
const BLOCKS_DIR = join(ROOT, 'src/css/blocks');
const BEHAVIOURS_DIR = join(ROOT, 'src/js/behaviours');
const BLOCKS_MANIFEST = join(BLOCKS_DIR, 'blocks.css');
const APP_JS = join(ROOT, 'src/js/app.js');

// --- naming helpers ---------------------------------------------------------
// Block classes are `b_camelCase`; behaviour/data-hook names are `kebab-case`.
// The two are independent in markup, so we extract each on its own terms.
export const kebabToCamel = (s) =>
  s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// --- parsing ----------------------------------------------------------------
// Regex, not a DOM parser: njk/twig markup carries `{% %}`/`{{ }}` tags that a
// strict HTML parser would trip on. We only need class tokens and data-* hooks.

const CLASS_ATTR = /class\s*=\s*("([^"]*)"|'([^']*)')/g;
const DATA_ATTR = /data-([a-z][a-z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
// A block token: base `b_name`, element `b_name__el`, or modifier `b_name--mod`
// (or element+modifier). Anything with a template brace is skipped by the loop.
const BLOCK_TOKEN =
  /^b_([A-Za-z0-9]+)(?:__([A-Za-z0-9]+))?(?:--([A-Za-z0-9-]+))?$/;

/**
 * Extract the block + behaviour surface from a markup string.
 * @returns {{
 *   blocks: Map<string, { base: string, selectors: Set<string> }>,
 *   behaviours: Map<string, Set<string>>,   // name -> non-root part values
 *   actions: Set<string>,                   // data-action values (noted, not generated)
 * }}
 */
export function parseMarkup(src) {
  const blocks = new Map();
  const behaviours = new Map();
  const actions = new Set();

  for (const m of src.matchAll(CLASS_ATTR)) {
    const value = m[2] ?? m[3] ?? '';
    for (const token of value.split(/\s+/)) {
      if (!token || token.includes('{')) continue; // skip template expressions
      const parsed = BLOCK_TOKEN.exec(token);
      if (!parsed) continue; // ignore u_* utilities, plain classes, etc.
      const blockName = `b_${parsed[1]}`;
      if (!blocks.has(blockName)) {
        blocks.set(blockName, { base: blockName, selectors: new Set() });
      }
      // Store the full literal class as a selector so element/modifier order
      // follows first-seen order in the markup (Set preserves insertion order).
      blocks.get(blockName).selectors.add(token);
    }
  }

  for (const m of src.matchAll(DATA_ATTR)) {
    const name = m[1];
    // DATA_ATTR has a leading name group, so the quoted value's inner content
    // is groups 3 (dq) / 4 (sq) — not 2/3 as in CLASS_ATTR.
    const value = m[3] ?? m[4] ?? '';
    if (value.includes('{')) continue;
    if (name === 'action') {
      actions.add(value);
      continue; // event-delegation actions are a different pattern
    }
    if (!behaviours.has(name)) behaviours.set(name, new Set());
    if (value !== 'root') behaviours.get(name).add(value);
  }
  // A behaviour is only real if the markup declares its `data-<name>="root"`
  // anchor — that's the selector `behaviour()` scans for. Drop stray data-*.
  const rootBearing = new Set();
  for (const m of src.matchAll(DATA_ATTR)) {
    if ((m[3] ?? m[4]) === 'root') rootBearing.add(m[1]);
  }
  for (const name of [...behaviours.keys()]) {
    if (!rootBearing.has(name)) behaviours.delete(name);
  }

  return { blocks, behaviours, actions };
}

// --- CSS generation ---------------------------------------------------------
// Order selectors block-base first, then elements, then modifiers, each group
// in first-seen order.
function orderedSelectors(base, selectors) {
  const all = [...selectors];
  const rank = (c) => (c === base ? 0 : c.includes('__') ? 1 : 2);
  return all.sort((a, b) => rank(a) - rank(b));
}

const ruleStub = (cls) => `.${cls} {\n  /* TODO */\n}`;

function blockHeader(base) {
  return `/* ${base} block — visual unit only (generated stub from markup).
 * Fill each selector with var(--token) values ONLY — no utopia.clamp()/$size
 * inline (blocks stay plain/portable; see docs/adr/0001). BEM elements are
 * FULL class selectors, not \`&__el\` (native nesting has no concatenation).
 * Reserve \`&\` for states/attrs/media (\`&:hover\`, \`&[aria-*]\`, \`@media\`). */`;
}

export function generateBlockCss(base, selectors) {
  const rules = orderedSelectors(base, selectors).map(ruleStub);
  return `${blockHeader(base)}\n${rules.join('\n\n')}\n`;
}

// True if `existing` already defines `.cls` as a selector (word-boundaried so
// `.b_x` does not match inside `.b_x__el`).
function hasSelector(existing, cls) {
  return new RegExp(`\\.${cls.replace(/[-]/g, '\\-')}(?![A-Za-z0-9_-])`).test(
    existing,
  );
}

/**
 * Return the additions to append to an existing block file for any selectors it
 * doesn't already define, or null if it's already complete. Never rewrites what
 * is there — purely additive.
 */
export function mergeBlockCss(existing, base, selectors) {
  const missing = orderedSelectors(base, selectors).filter(
    (cls) => !hasSelector(existing, cls),
  );
  if (missing.length === 0) return null;
  const banner =
    '/* --- appended by scaffold-from-markup: new markup hooks --- */';
  const body = missing.map(ruleStub).join('\n\n');
  const sep = existing.endsWith('\n') ? '\n' : '\n\n';
  return { text: `${sep}${banner}\n${body}\n`, missing };
}

// --- JS behaviour generation ------------------------------------------------
export function generateBehaviour(name, parts) {
  const partList = [...parts];
  const queries = partList
    .map(
      (p) =>
        `  const ${kebabToCamel(p)} = root.querySelector('[data-${name}="${p}"]');`,
    )
    .join('\n');
  const guard = partList.length
    ? `  if (${partList.map((p) => `!${kebabToCamel(p)}`).join(' || ')}) return;\n\n`
    : '';
  const queryBlock = queries ? `${queries}\n${guard}` : '';
  return `import { behaviour } from '../core/index.js';

/**
 * ${name} behaviour (generated stub). Driven entirely by data-${name} hooks, so
 * it ports to Twig unchanged and can drive any block exposing the same hooks.
 * Return a teardown fn only for listeners on document/window (see docs/adr/0002).
 */
export default behaviour('${name}', (root) => {
${queryBlock}  // TODO: implement behaviour.
});
`;
}

// --- manifest wiring --------------------------------------------------------
export function wireBlocksManifest(manifest, base) {
  const line = `@import './${base}.css';`;
  if (manifest.includes(line)) return null;
  const sep = manifest.endsWith('\n') ? '' : '\n';
  return `${manifest}${sep}${line}\n`;
}

// Blank out /* */ and // comments (preserving length + newlines) so we locate
// the real `run(...)` call and behaviour imports, never a mention in a comment.
// The manifest's own doc comment literally says "hand it to run()".
function maskComments(s) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
}

/**
 * Add `import <camel> from './behaviours/<camel>.js';` and extend the `run(...)`
 * call in app.js. Returns the new source, or null if already wired / the
 * expected shape isn't found (caller warns rather than corrupting the file).
 * Locates against a comment-masked copy but edits the original by index,
 * applying edits right-to-left so earlier offsets stay valid.
 */
export function wireAppJs(appJs, name) {
  const camel = kebabToCamel(name);
  const importLine = `import ${camel} from './behaviours/${camel}.js';`;
  const masked = maskComments(appJs);
  const edits = [];

  if (!masked.includes(importLine)) {
    const behaviourImports = [
      ...masked.matchAll(/^import .+ from '\.\/behaviours\/.+';$/gm),
    ];
    if (behaviourImports.length) {
      const last = behaviourImports[behaviourImports.length - 1];
      const at = last.index + last[0].length;
      edits.push({ start: at, end: at, text: `\n${importLine}` });
    } else {
      const core = masked.match(
        /import \{ run \} from '\.\/core\/index\.js';\n/,
      );
      if (!core) return null; // unexpected shape — bail rather than guess
      const at = core.index + core[0].length;
      edits.push({ start: at, end: at, text: `${importLine}\n` });
    }
  }

  const runMatch = masked.match(/run\(([^)]*)\)/);
  if (!runMatch) return null; // unexpected shape — don't touch args
  const args = runMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!args.includes(camel)) {
    edits.push({
      start: runMatch.index,
      end: runMatch.index + runMatch[0].length,
      text: `run(${[...args, camel].join(', ')})`,
    });
  }

  if (edits.length === 0) return null;
  edits.sort((a, b) => b.start - a.start);
  let out = appJs;
  for (const e of edits)
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

// --- engine -----------------------------------------------------------------
// The shared orchestration behind BOTH directions: given a markup string, emit
// (or merge) the block CSS + behaviour JS it implies and wire the manifests.
// The reverse tool reads existing markup; the forward tool (bin/new-component)
// generates markup then hands it here. Returns a change log; writes nothing on
// dryRun. Idempotent + additive — see mergeBlockCss / wireAppJs.

const rel = (p) => relative(ROOT, p) || '.';

/**
 * @returns {Promise<{ changes: Array<{path:string, action:'create'|'append'|'skip', note?:string}>, actions: Set<string> }>}
 */
export async function applyMarkup(
  src,
  { dryRun = false, noWire = false } = {},
) {
  const { blocks, behaviours, actions } = parseMarkup(src);
  const changes = [];
  const write = async (path, text) => {
    if (!dryRun) await writeFile(path, text);
  };

  // Blocks -> CSS (+ blocks.css manifest)
  for (const { base, selectors } of blocks.values()) {
    const path = join(BLOCKS_DIR, `${base}.css`);
    if (!existsSync(path)) {
      changes.push({
        path,
        action: 'create',
        note: `${selectors.size} selector(s)`,
      });
      await write(path, generateBlockCss(base, selectors));
    } else {
      const existing = await readFile(path, 'utf8');
      const merged = mergeBlockCss(existing, base, selectors);
      if (merged) {
        changes.push({
          path,
          action: 'append',
          note: merged.missing.map((c) => `.${c}`).join(', '),
        });
        await write(path, existing + merged.text);
      } else {
        changes.push({ path, action: 'skip', note: 'all selectors present' });
      }
    }

    if (!noWire) {
      const manifest = await readFile(BLOCKS_MANIFEST, 'utf8');
      const wired = wireBlocksManifest(manifest, base);
      if (wired) {
        changes.push({
          path: BLOCKS_MANIFEST,
          action: 'append',
          note: `@import ${base}.css`,
        });
        await write(BLOCKS_MANIFEST, wired);
      }
    }
  }

  // Behaviours -> JS (+ app.js manifest)
  for (const [name, parts] of behaviours) {
    const camel = kebabToCamel(name);
    const path = join(BEHAVIOURS_DIR, `${camel}.js`);
    if (!existsSync(path)) {
      changes.push({
        path,
        action: 'create',
        note: `parts: ${[...parts].join(', ') || 'none'}`,
      });
      await write(path, generateBehaviour(name, parts));
    } else {
      changes.push({ path, action: 'skip', note: 'behaviour exists' });
    }

    if (!noWire) {
      const appJs = await readFile(APP_JS, 'utf8');
      const wired = wireAppJs(appJs, name);
      if (wired) {
        changes.push({
          path: APP_JS,
          action: 'append',
          note: `import + run(${camel})`,
        });
        await write(APP_JS, wired);
      } else if (!appJs.includes(`behaviours/${camel}.js`)) {
        changes.push({
          path: APP_JS,
          action: 'skip',
          note: 'could not wire (unexpected app.js shape)',
        });
      }
    }
  }

  return { changes, actions };
}

/** Print a change log in the shared format. Returns the count of real changes. */
export function printReport(
  label,
  { changes, actions },
  { dryRun = false } = {},
) {
  const glyph = { create: '+', append: '~', skip: '·' };
  console.log(`${dryRun ? '[dry-run] ' : ''}${label}\n`);
  for (const c of changes) {
    console.log(
      `  ${glyph[c.action]} ${c.action.padEnd(6)} ${rel(c.path)}${c.note ? `  (${c.note})` : ''}`,
    );
  }
  if (actions.size) {
    console.log(
      `\n  note: data-action hooks found (${[...actions].join(', ')}) — see docs/patterns/event-delegation-actions.md`,
    );
  }
  const created = changes.filter((c) => c.action !== 'skip').length;
  console.log(
    `\n${created ? `${created} change(s).` : 'Nothing to change — already in sync.'}` +
      (dryRun && created ? ' Re-run without --dry-run to apply.' : ''),
  );
  if (created && !dryRun)
    console.log('Next: fill the TODO stubs with var(--token) values.');
  return created;
}

// --- driver -----------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noWire = args.includes('--no-wire');
  const file = args.find((a) => !a.startsWith('-'));

  if (!file || args.includes('-h') || args.includes('--help')) {
    console.error(
      'Usage: npm run scaffold:markup -- <markup-file> [--dry-run] [--no-wire]',
    );
    process.exit(file ? 0 : 1);
  }

  const src = await readFile(resolve(process.cwd(), file), 'utf8');
  const result = await applyMarkup(src, { dryRun, noWire });

  if (result.changes.length === 0) {
    console.log(
      'No b_* classes or data-* behaviour hooks found. Nothing to do.',
    );
    return;
  }

  printReport(
    `scaffold-from-markup: ${rel(resolve(process.cwd(), file))}`,
    result,
    { dryRun },
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
