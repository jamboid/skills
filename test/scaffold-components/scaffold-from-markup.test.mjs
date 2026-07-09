import { describe, it, expect } from 'vitest';
import {
  parseMarkup,
  generateBlockCss,
  mergeBlockCss,
  generateBehaviour,
  wireBlocksManifest,
  wireAppJs,
} from '../../skills/scaffold-components/scripts/scaffold-from-markup.mjs';

// The reverse scaffolder's contract: derive convention-correct CSS/JS stubs from
// a component's `b_*` classes + `data-*` hooks (the portability surface), and
// stay idempotent + additive so re-running never clobbers hand edits.

const MARKUP = `
<section class="b_accordion u_flow" data-accordion="root">
  <h2 class="b_accordion__title">FAQ</h2>
  <div class="b_accordion__item">
    <button class="b_accordion__trigger" data-accordion="trigger" aria-expanded="false">Q</button>
    <div class="b_accordion__panel b_accordion__panel--collapsed" data-accordion="panel" hidden>A</div>
  </div>
  <button data-action="scroll-top">Top</button>
</section>
`;

describe('parseMarkup', () => {
  const { blocks, behaviours, actions } = parseMarkup(MARKUP);

  it('collects b_* classes grouped by block, ignoring u_* utilities', () => {
    expect([...blocks.keys()]).toEqual(['b_accordion']);
    expect([...blocks.get('b_accordion').selectors]).toEqual([
      'b_accordion',
      'b_accordion__title',
      'b_accordion__item',
      'b_accordion__trigger',
      'b_accordion__panel',
      'b_accordion__panel--collapsed',
    ]);
  });

  it('treats a data-<name>="root"-bearing group as a behaviour, parts minus root', () => {
    expect([...behaviours.keys()]).toEqual(['accordion']);
    expect([...behaviours.get('accordion')]).toEqual(['trigger', 'panel']);
  });

  it('notes data-action hooks separately (not a behaviour)', () => {
    expect([...actions]).toEqual(['scroll-top']);
    expect(behaviours.has('action')).toBe(false);
  });

  it('ignores classes/hooks that contain template expressions', () => {
    const { blocks: b } = parseMarkup(
      '<div class="b_x {{ mod }}" data-y="{{ v }}">',
    );
    expect([...b.get('b_x').selectors]).toEqual(['b_x']);
  });

  it('drops a data-* group with no "root" anchor', () => {
    const { behaviours: b } = parseMarkup('<div data-thing="part">');
    expect(b.size).toBe(0);
  });
});

describe('generateBlockCss', () => {
  const { blocks } = parseMarkup(MARKUP);
  const css = generateBlockCss(
    'b_accordion',
    blocks.get('b_accordion').selectors,
  );
  // The header comment names the anti-patterns as guidance, so assert against
  // the code only (comments stripped) — the rules are about rule bodies.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('emits FULL-class BEM selectors, never &__el', () => {
    expect(css).toContain('.b_accordion__title {');
    expect(code).not.toMatch(/&__/);
  });

  it('orders base -> elements -> modifiers', () => {
    const at = (s) => css.indexOf(s);
    expect(at('.b_accordion {')).toBeLessThan(at('.b_accordion__title {'));
    expect(at('.b_accordion__panel {')).toBeLessThan(
      at('.b_accordion__panel--collapsed {'),
    );
  });

  it('carries no build-coupled token syntax inline (blocks are var()-only)', () => {
    expect(code).not.toMatch(/utopia\.clamp\(|\$size/);
  });
});

describe('mergeBlockCss (idempotent + additive)', () => {
  const { blocks } = parseMarkup(MARKUP);
  const selectors = blocks.get('b_accordion').selectors;
  const full = generateBlockCss('b_accordion', selectors);

  it('returns null when every selector already exists', () => {
    expect(mergeBlockCss(full, 'b_accordion', selectors)).toBeNull();
  });

  it('appends only the missing selectors, base-vs-element boundary aware', () => {
    const partial = generateBlockCss(
      'b_accordion',
      new Set(['b_accordion', 'b_accordion__title']),
    );
    const merged = mergeBlockCss(partial, 'b_accordion', selectors);
    expect(merged.missing).toEqual([
      'b_accordion__item',
      'b_accordion__trigger',
      'b_accordion__panel',
      'b_accordion__panel--collapsed',
    ]);
    // `.b_accordion` present must NOT swallow `.b_accordion__item` as existing.
    expect(merged.text).toContain('.b_accordion__item {');
  });
});

describe('generateBehaviour', () => {
  const js = generateBehaviour('accordion', new Set(['trigger', 'panel']));

  it('uses behaviour() with kebab name and camelCased part queries', () => {
    expect(js).toContain("behaviour('accordion'");
    expect(js).toContain(`root.querySelector('[data-accordion="trigger"]')`);
    expect(js).toContain('if (!trigger || !panel) return;');
  });

  it('kebab part -> camel local', () => {
    const j = generateBehaviour('x', new Set(['close-btn']));
    expect(j).toContain(
      `const closeBtn = root.querySelector('[data-x="close-btn"]')`,
    );
  });
});

describe('wireBlocksManifest', () => {
  it('appends a missing @import and is idempotent', () => {
    const base = "@import './b_mainNav.css';\n";
    const once = wireBlocksManifest(base, 'b_accordion');
    expect(once).toContain("@import './b_accordion.css';");
    expect(wireBlocksManifest(once, 'b_accordion')).toBeNull();
  });
});

describe('wireAppJs', () => {
  const APP = `/* Import each behaviour and hand it to run(). */
import '../css/app.css';
import { run } from './core/index.js';
import mainNav from './behaviours/mainNav.js';

const dispose = run(mainNav);
`;

  it('adds import after the last behaviour import and extends run()', () => {
    const out = wireAppJs(APP, 'accordion');
    expect(out).toContain("import accordion from './behaviours/accordion.js';");
    expect(out).toContain('run(mainNav, accordion)');
  });

  it('never edits a run() mention inside a comment', () => {
    const out = wireAppJs(APP, 'accordion');
    expect(out).toContain('hand it to run().'); // comment untouched
  });

  it('is idempotent for an already-wired behaviour', () => {
    expect(wireAppJs(APP, 'main-nav')).toBeNull();
  });

  it('inserts after the core import when no behaviour imports exist yet', () => {
    const bare = `import { run } from './core/index.js';\n\nconst dispose = run();\n`;
    const out = wireAppJs(bare, 'accordion');
    expect(out).toContain(
      "import { run } from './core/index.js';\nimport accordion from './behaviours/accordion.js';",
    );
    expect(out).toContain('run(accordion)');
  });
});
