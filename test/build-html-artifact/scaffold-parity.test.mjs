import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The three scaffolds are the design system's single source of truth, and each
// one has to stand alone on disk — so the shared CSS is copied into all of them
// rather than linked. Same policy as the css-token schema (see
// test/css-token-schema.test.mjs): copy + guard, not a build step. These tests
// are the guard.

const asset = (name) =>
  fileURLToPath(new URL(`../../skills/build-html-artifact/assets/${name}`, import.meta.url));

const PAGE = asset('page-template.html');
const PAGE_NAV = asset('page-nav-template.html');
const INDEX = asset('index-template.html');

const ALL = { 'page-template.html': PAGE, 'page-nav-template.html': PAGE_NAV, 'index-template.html': INDEX };
const PROSE = { 'page-template.html': PAGE, 'page-nav-template.html': PAGE_NAV };

const read = (path) => readFileSync(path, 'utf8');

/** Pull a marked block (`/* == name:start == *​/` … `:end`) out of a scaffold. */
function block(path, name) {
  const src = read(path);
  const start = src.indexOf(`/* == ${name}:start == */`);
  const end = src.indexOf(`/* == ${name}:end == */`);
  if (start === -1 || end === -1) throw new Error(`${path} is missing the ${name} block`);
  return src.slice(start, end);
}

describe('scaffold parity', () => {
  it('every scaffold carries the same :root token block', () => {
    const tokens = Object.entries(ALL).map(([name, path]) => [name, block(path, 'tokens')]);
    const [, reference] = tokens[0];
    for (const [name, text] of tokens.slice(1)) {
      expect(text, `${name} token block has drifted from page-template.html`).toBe(reference);
    }
  });

  it('both prose scaffolds carry the same base + pattern block', () => {
    expect(block(PAGE_NAV, 'base'), 'page-nav-template.html base block has drifted').toBe(
      block(PAGE, 'base')
    );
  });

  it('the landing scaffold shares tokens but has no prose base block', () => {
    // A link list has no prose to style; sharing the base block would be dead weight.
    expect(read(INDEX)).not.toContain('== base:start ==');
  });
});

describe('token discipline', () => {
  it('every --c-* token a scaffold uses is one it also defines', () => {
    for (const [name, path] of Object.entries(ALL)) {
      const src = read(path);
      // Not line-anchored: the status tokens are declared two to a line.
      const defined = new Set([...src.matchAll(/(--c-[a-z0-9-]+)\s*:\s*[^;)]/g)].map((m) => m[1]));
      const used = new Set([...src.matchAll(/var\((--c-[a-z0-9-]+)\)/g)].map((m) => m[1]));
      const missing = [...used].filter((t) => !defined.has(t));
      expect(missing, `${name} uses undefined token(s)`).toEqual([]);
    }
  });

  it('the accent tints derive from --c-accent rather than being hardcoded', () => {
    // --c-accent is the single brand knob; the tints must follow it, or changing
    // the brand colour silently leaves the old one behind in the tints.
    for (const [name, path] of Object.entries(ALL)) {
      const src = read(path);
      for (const token of ['--c-accent-ink', '--c-accent-soft', '--c-accent-pale']) {
        const decl = src.match(new RegExp(`${token}\\s*:([^;]+);`));
        expect(decl, `${name} does not define ${token}`).not.toBeNull();
        expect(decl[1], `${name} hardcodes ${token} instead of deriving it`).toMatch(
          /color-mix\([^)]*var\(--c-accent\)/
        );
      }
      // Exactly one raw accent colour to change.
      const accents = src.match(/--c-accent\s*:\s*#[0-9a-fA-F]{3,8}/g) || [];
      expect(accents.length, `${name} should declare --c-accent exactly once`).toBe(1);
    }
  });

  it('no scaffold hardcodes a hex colour outside its token block', () => {
    for (const [name, path] of Object.entries(ALL)) {
      const src = read(path);
      const outside = src.slice(src.indexOf('/* == tokens:end == */'));
      // #fff in the print rule is the one allowed literal: paper is not a token.
      const hexes = [...outside.matchAll(/#[0-9a-fA-F]{3,8}\b/g)]
        .map((m) => m[0])
        .filter((h) => h.toLowerCase() !== '#fff');
      expect(hexes, `${name} hardcodes a colour outside :root`).toEqual([]);
    }
  });
});

describe('self-containment', () => {
  it('no scaffold reaches the network', () => {
    for (const [name, path] of Object.entries(ALL)) {
      const src = read(path);
      expect(src, `${name} has an external reference`).not.toMatch(/https?:\/\//);
      expect(src, `${name} has an @import`).not.toMatch(/@import/);
    }
  });

  it('every scaffold keeps its CSS in a single head block', () => {
    for (const [name, path] of Object.entries(ALL)) {
      const src = read(path);
      expect((src.match(/<style>/g) || []).length, `${name} has more than one <style>`).toBe(1);
      expect(src.indexOf('<style>'), `${name} has <style> outside <head>`).toBeLessThan(
        src.indexOf('</head>')
      );
    }
  });
});

describe('placeholders', () => {
  it('the prose scaffolds expose the masthead slots', () => {
    for (const [name, path] of Object.entries(PROSE)) {
      const src = read(path);
      for (const slot of ['{{TITLE}}', '{{PROJECT}}', '{{EYEBROW}}', '{{LEDE}}', '{{AUTHOR}}', '{{DATE}}', '{{STATUS}}', '{{CONTENT}}']) {
        expect(src, `${name} is missing ${slot}`).toContain(slot);
      }
    }
  });

  it('only the nav scaffold has a sidebar', () => {
    expect(read(PAGE_NAV)).toContain('{{SIDEBAR_NAV}}');
    expect(read(PAGE), 'page-template.html should be the plain single-column scaffold').not.toContain(
      '{{SIDEBAR_NAV}}'
    );
    expect(read(PAGE)).not.toContain('<aside');
  });
});
