import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateComponentNjk,
  resolveMarkupTarget,
} from '../../skills/scaffold-components/scripts/new-component.mjs';
import { parseMarkup } from '../../skills/scaffold-components/scripts/scaffold-from-markup.mjs';

// The forward scaffolder's contract: turn a spec into convention-correct markup
// whose `b_*` classes + `data-*` hooks the reverse engine can consume unchanged.
// The strongest guarantee is the round-trip — forward output feeds parseMarkup.

describe('generateComponentNjk', () => {
  it('interactive component: root hook + BEM elements + part hooks', () => {
    const njk = generateComponentNjk({
      name: 'accordion',
      elements: ['title', 'item'],
      parts: ['trigger', 'panel'],
    });
    expect(njk).toContain('<div class="b_accordion" data-accordion="root">');
    expect(njk).toContain('<div class="b_accordion__title">'); // element, no hook
    expect(njk).toContain(
      '<div class="b_accordion__trigger" data-accordion="trigger">',
    ); // part, hooked
    expect(njk).toContain('behaviour (JS)'); // header names the behaviour
  });

  it('static component (default): no root hook, no data-* hooks, no behaviour', () => {
    const njk = generateComponentNjk({
      name: 'card',
      elements: ['media', 'title'],
    });
    expect(njk).toContain('<div class="b_card">');
    expect(njk).not.toMatch(/data-/);
    expect(njk).toContain('Static block, no');
  });

  it('--behaviour forces an interactive root even with no parts', () => {
    const njk = generateComponentNjk({ name: 'disclosure', behaviour: true });
    expect(njk).toContain('data-disclosure="root"');
  });

  it('normalizes kebab and multi-word names consistently', () => {
    const njk = generateComponentNjk({
      name: 'main-nav',
      parts: ['close-btn'],
    });
    // block class is camel, data hook is kebab, part is camel in both.
    expect(njk).toContain('class="b_mainNav" data-main-nav="root"');
    expect(njk).toContain(
      '<div class="b_mainNav__closeBtn" data-main-nav="closeBtn">',
    );
  });

  it('rejects a name that is not a bare identifier', () => {
    expect(() => generateComponentNjk({ name: '1bad!' })).toThrow(
      /invalid name/,
    );
  });
});

describe('round-trip: forward output is valid engine input', () => {
  it('parseMarkup recovers the block selectors and behaviour parts', () => {
    const njk = generateComponentNjk({
      name: 'accordion',
      elements: ['title', 'item'],
      parts: ['trigger', 'panel'],
    });
    const { blocks, behaviours } = parseMarkup(njk);

    expect([...blocks.get('b_accordion').selectors]).toEqual([
      'b_accordion',
      'b_accordion__title',
      'b_accordion__item',
      'b_accordion__trigger',
      'b_accordion__panel',
    ]);
    expect([...behaviours.get('accordion')]).toEqual(['trigger', 'panel']);
  });

  it('a static component yields a block and no behaviour', () => {
    const njk = generateComponentNjk({ name: 'card', elements: ['media'] });
    const { blocks, behaviours } = parseMarkup(njk);
    expect([...blocks.get('b_card').selectors]).toEqual([
      'b_card',
      'b_card__media',
    ]);
    expect(behaviours.size).toBe(0);
  });

  it('twig mode reshapes the header porting note (body is identical)', () => {
    const njk = generateComponentNjk({ name: 'accordion', mode: 'twig' });
    expect(njk).toContain('A Drupal Twig partial');
    expect(njk).not.toContain('when porting to Drupal');
    expect(njk).toContain('<div class="b_accordion"'); // same block markup
  });
});

describe('resolveMarkupTarget (project mode)', () => {
  const dirs = [];
  const mkRoot = (files) => {
    const root = mkdtempSync(join(tmpdir(), 'nc-'));
    dirs.push(root);
    for (const f of files) writeFileSync(join(root, f), '');
    return root;
  };
  afterAll(() =>
    dirs.forEach((d) => rmSync(d, { recursive: true, force: true })),
  );

  it('Eleventy present -> .njk under eleventy/_includes/components', () => {
    const root = mkRoot(['.eleventy.js']);
    const t = resolveMarkupTarget(root);
    expect(t.mode).toBe('eleventy');
    expect(t.ext).toBe('njk');
    expect(t.dir).toBe(join(root, 'eleventy/_includes/components'));
  });

  it('an eleventy/ dir also counts as Eleventy mode', () => {
    const root = mkRoot([]);
    mkdirSync(join(root, 'eleventy'));
    expect(resolveMarkupTarget(root).mode).toBe('eleventy');
  });

  it('no Eleventy -> Drupal .html.twig in the adjacent ../templates', () => {
    const root = mkRoot([]);
    const t = resolveMarkupTarget(root);
    expect(t.mode).toBe('twig');
    expect(t.ext).toBe('html.twig');
    expect(t.dir).toBe(join(root, '..', 'templates'));
  });

  it('--out overrides the directory (extension still follows mode)', () => {
    const root = mkRoot(['.eleventy.js']);
    const t = resolveMarkupTarget(root, { out: 'src/partials' });
    expect(t.dir).toBe(join(process.cwd(), 'src/partials'));
    expect(t.ext).toBe('njk');
  });
});
