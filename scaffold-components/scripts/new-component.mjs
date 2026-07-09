#!/usr/bin/env node
// Forward scaffolder: turn a component spec into a wired component. Generates a
// `.njk` skeleton with convention-correct `b_*` classes + `data-*` hooks, then
// hands it to the reverse engine (applyMarkup) to emit the block CSS, behaviour
// JS, and manifest wiring — one command, one fully-wired component.
//
//   npm run scaffold:component -- accordion --el title,item --part trigger,panel
//   npm run scaffold:component -- card --el media,title,body        # static block
//   npm run scaffold:component -- disclosure --behaviour            # root-only JS
//   npm run scaffold:component -- accordion --el title --dry-run
//
// A component is STATIC (block CSS only) by default; passing --part (or
// --behaviour) makes it interactive (adds the root hook + a behaviour). The
// skeleton is deliberately neutral <div>s — the script owns naming + wiring; you
// (or the skill) own semantics, ARIA, nesting, and the token values.
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  kebabToCamel,
  applyMarkup,
  printReport,
  resolveProjectRoot,
} from './scaffold-from-markup.mjs';

const ROOT = resolveProjectRoot();

// Block classes are `b_camelCase`; behaviour/data-hook names are `kebab-case`.
const camelToKebab = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

// Where the generated component markup lands depends on the project mode:
//  - Static/Eleventy mode (has .eleventy.js or eleventy/) → an `.njk` partial in
//    eleventy/_includes/components/.
//  - Theme-pipeline mode (extracted pipeline in a Drupal theme's assets/, no
//    Eleventy) → a Drupal `.html.twig` in the adjacent ../templates/ dir.
// `--out <dir>` overrides the directory in either mode.
export function resolveMarkupTarget(root, { out } = {}) {
  const eleventy =
    existsSync(join(root, '.eleventy.js')) ||
    existsSync(join(root, 'eleventy'));
  const ext = eleventy ? 'njk' : 'html.twig';
  const dir = out
    ? resolve(process.cwd(), out)
    : eleventy
      ? join(root, 'eleventy/_includes/components')
      : resolve(root, '..', 'templates');
  return { dir, ext, mode: eleventy ? 'eleventy' : 'twig' };
}

// Names arrive as kebab or camel; normalise both parts and validate the result
// is a bare alphanumeric identifier (BEM element tokens have no `-`).
function normalizeName(raw) {
  const camel0 = kebabToCamel(raw.replace(/^b_/, ''));
  const camel = camel0.charAt(0).toLowerCase() + camel0.slice(1);
  if (!/^[a-z][A-Za-z0-9]*$/.test(camel)) {
    throw new Error(
      `invalid name "${raw}" — use letters/digits only (kebab or camelCase), e.g. main-nav or mainNav`,
    );
  }
  return { camel, kebab: camelToKebab(camel) };
}

// --- markup generation ------------------------------------------------------
// Nunjucks and Twig share comment/tag syntax, so the body is identical; only the
// header's porting note differs by mode.
function componentHeader(camel, kebab, interactive, mode) {
  const composes = interactive
    ? `composes the b_${camel} block (CSS) with the \`${kebab}\` behaviour (JS), joined by data-${kebab} hooks`
    : `composes the b_${camel} block (CSS). Static block, no behaviour`;
  const contract = interactive ? 'class names and data hooks' : 'class names';
  const port =
    mode === 'twig'
      ? `A Drupal Twig partial — include it with {% include %}. The ${contract} are the portability contract.`
      : `Copy this markup into a Twig template unchanged when porting to Drupal — the ${contract} are the whole portability contract.`;
  const shape = interactive ? ', and shape the nesting' : '';
  const fill = interactive ? 'CSS/JS stubs' : 'CSS stubs';
  return `{#
  ${camel} component — ${composes}.
  ${port}

  Generated skeleton: swap the placeholder <div>s for semantic elements, add the
  appropriate ARIA${shape}. Then fill the ${fill}.
#}`;
}

export function generateComponentNjk({
  name,
  elements = [],
  parts = [],
  behaviour = false,
  mode = 'eleventy',
}) {
  const { camel, kebab } = normalizeName(name);
  const el = elements.map((e) => normalizeName(e).camel);
  const part = parts.map((p) => normalizeName(p).camel);
  const interactive = behaviour || part.length > 0;

  const child = (n, isPart) =>
    `  <div class="b_${camel}__${n}"${isPart ? ` data-${kebab}="${n}"` : ''}>TODO: ${n}</div>`;
  const children = [
    ...el.map((n) => child(n, false)),
    ...part.map((n) => child(n, true)),
  ];
  const body = children.length
    ? children.join('\n')
    : `  {# TODO: add ${interactive ? 'elements / part hooks' : 'elements'} #}`;

  const rootAttrs = `class="b_${camel}"${interactive ? ` data-${kebab}="root"` : ''}`;
  return `${componentHeader(camel, kebab, interactive, mode)}
<div ${rootAttrs}>
${body}
</div>
`;
}

// --- CLI --------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    name: undefined,
    elements: [],
    parts: [],
    behaviour: false,
    static: false,
    dryRun: false,
    noWire: false,
    help: false,
  };
  const list = (s) =>
    (s ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-wire') opts.noWire = true;
    else if (a === '--behaviour') opts.behaviour = true;
    else if (a === '--static') opts.static = true;
    else if (a === '--el' || a === '--element')
      opts.elements.push(...list(argv[++i]));
    else if (a === '--part') opts.parts.push(...list(argv[++i]));
    else if (a === '--out') opts.out = argv[++i];
    else if (a.startsWith('-')) throw new Error(`unknown option: ${a}`);
    else if (opts.name === undefined) opts.name = a;
    else
      throw new Error(
        `unexpected argument: ${a} (name already set to "${opts.name}")`,
      );
  }
  return opts;
}

const USAGE =
  'Usage: npm run scaffold:component -- <name> [--el a,b] [--part a,b] [--behaviour] [--static] [--out dir] [--dry-run] [--no-wire]';

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.name) {
    console.error(USAGE);
    process.exit(opts.name ? 0 : 1);
  }
  if (opts.static && (opts.behaviour || opts.parts.length)) {
    throw new Error(
      '--static conflicts with --behaviour/--part (a static block has no JS)',
    );
  }

  const { camel } = normalizeName(opts.name);
  const { dir, ext, mode } = resolveMarkupTarget(ROOT, { out: opts.out });
  const markupPath = join(dir, `${camel}.${ext}`);
  const relMarkup = relative(ROOT, markupPath);
  if (existsSync(markupPath)) {
    throw new Error(
      `component already exists: ${relMarkup}\n` +
        `Edit its markup and run \`npm run scaffold:markup -- ${relMarkup}\` to sync new hooks.`,
    );
  }

  const markup = generateComponentNjk({
    name: opts.name,
    elements: opts.elements,
    parts: opts.parts,
    behaviour: opts.behaviour,
    mode,
  });

  const changes = [
    { path: markupPath, action: 'create', note: 'component markup' },
  ];
  if (!opts.dryRun) {
    await mkdir(dir, { recursive: true });
    await writeFile(markupPath, markup);
  }

  // Reuse the reverse engine for everything downstream of the markup.
  const result = await applyMarkup(markup, {
    dryRun: opts.dryRun,
    noWire: opts.noWire,
  });
  printReport(
    `new-component (${mode}): ${relMarkup}`,
    { changes: [...changes, ...result.changes], actions: result.actions },
    { dryRun: opts.dryRun },
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
