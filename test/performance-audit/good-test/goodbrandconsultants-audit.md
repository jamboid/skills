# Website Performance Review: goodbrandconsultants.com

**URL:** https://goodbrandconsultants.com/ · **Date:** 2026-06-22 · **Scope:** site audit, performance-focused · **Audience:** internal SD/AD

## Summary

`goodbrandconsultants.com` is **strong on desktop** (Lighthouse **95**, LCP 1.3 s) but **drops into the poor band on mobile** (Lighthouse **81**, LCP **4.4 s**). It's a Drupal site fronted by Cloudflare, and the mobile problem is not the site's own code — that's tiny (~7 KB of theme CSS, ~7 KB of JS). It's what's bolted on around it.

Two things drive the 4.4 s mobile LCP. First, **render-blocking CSS and fonts**: a dozen un-aggregated Drupal component stylesheets plus Adobe Typekit block first paint, costing roughly **1.4 s** of FCP/LCP on mobile. Second, **third-party JavaScript dominates the page** — 830 KB of the 1.33 MB total is script, almost none of it first-party: ~550 KB of injected bot-management scripts on randomised paths, 157 KB of Google Tag Manager, a 67 KB chat widget, and visitor-tracking. The largest feature image (121 KB) is also shipped at full size to phones.

Desktop absorbs all of this; a throttled phone does not. Every fix here is configuration or tag governance, not re-architecture.

## Metrics

### Desktop

#### Lighthouse — performance score 95

_Lighthouse 13.2.0 (lab, simulated desktop)_ · [full report](https://goodbrandconsultants.com/)

| Metric | Value | Rating |
|---|---|---|
| FCP | 0.9 s | Good |
| LCP | 1.3 s | Good |
| Speed Index | 0.9 s | Good |
| TBT | 3 ms | Good |
| CLS | 0.00 | Good |
| INP | lab N/A | N/A |

### Mobile

#### Lighthouse — performance score 81

_Lighthouse 13.2.0 (lab, Moto-class, 4× CPU + throttled link)_ · [full report](https://goodbrandconsultants.com/)

| Metric | Value | Rating |
|---|---|---|
| FCP | 2.4 s | Needs improvement |
| LCP | 4.4 s | Poor |
| Speed Index | 2.4 s | Good |
| TBT | 133 ms | Good |
| CLS | 0.03 | Good |
| INP | lab N/A | N/A |

## Page resources

| Category | Requests | Desktop | Mobile |
|---|---:|---:|---:|
| Images | 14 | 378 KB | 378 KB |
| Font | 1 | 81 KB | 81 KB |
| Document | 1 | 7 KB | 7 KB |
| Stylesheet | 11 | 22 KB | 22 KB |
| Script | 12 | 810 KB | 810 KB |
| Other | 10 | 4 KB | 4 KB |
| **Total** | 49 | 1.3 MB | 1.3 MB |

**Images**

- `jfais_web_cover.png.webp` — 118 KB / 118 KB
- `homepage_buttons_strategic-framework.jpg.webp` — 114 KB / 114 KB
- `homepage_buttons_journal-1.jpg.webp` — 83 KB / 83 KB
- `results-chris.jpg.webp` — 20 KB / 20 KB
- `devro1_0_0.png.webp` — 18 KB / 18 KB
- _+8 files under 10 KB — 24 KB / 24 KB_

**Font**

- `l` — 81 KB / 81 KB

**Document**

- `goodbrandconsultants.com` — 7 KB / 7 KB

**Stylesheet**

- `screen.css` — 14 KB / 14 KB
- _+10 files under 10 KB — 8 KB / 8 KB_

**Script**

- `lhp3vTZiNH4QuI1DeMnkajxgWAYmE_BYWeqRghcX2zATLO0G` — 189 KB / 189 KB
- `lhp3vTZiMgRl2YI2Hc2SG0AaWAYmE_BYWeqRghcX2zATLO0G` — 189 KB / 189 KB
- `35z3` — 163 KB / 163 KB
- `gtm.js` — 153 KB / 153 KB
- `widget.js` — 66 KB / 66 KB
- `radar.min.js` — 21 KB / 21 KB
- `v833ccba57c9e4d2798f2e76cebdd09a11778172276447` — 11 KB / 11 KB
- _+5 files under 10 KB — 18 KB / 18 KB_

**Other**

- _+7 files under 10 KB — 4 KB / 4 KB_

## Site architecture

Drupal, custom theme `good` (`/themes/custom/good/`), with the Paragraphs module and Drupal image styles (`feature_promo_large`, `feature_promo_medium`) producing image derivatives. The site is fronted by **Cloudflare** — `/cdn-cgi/scripts/.../rocket-loader.min.js` and the `/cdn-cgi/rum` beacon confirm it, with Rocket Loader enabled.

The page is server-rendered and the first-party footprint is small: the theme ships ~14 KB of CSS (`screen.css`) and ~7 KB of JS (`good.js`). The weight is almost entirely third-party. Adobe **Typekit** serves the fonts (render-blocking). **Google Tag Manager** (157 KB) is present, **Snitcher** (`radar.min.js`, B2B visitor de-anonymisation) tracks visitors, and a **chat widget** (`chat.goodai.works`, 67 KB) loads on every page. A further ~550 KB of script is served from randomised first-party paths (`/35z3/…`) — the signature of an injected bot-management or anti-fraud layer; confirm the vendor (likely Cloudflare) before acting. That the CSS arrives as a dozen separate `core/modules/system/…` files means Drupal's CSS **aggregation is off or partial** — a config switch, not a code change.

## Performance

### Tests

- Lighthouse 13.2.0 — desktop lab: https://goodbrandconsultants.com/
- Lighthouse 13.2.0 — mobile lab: https://goodbrandconsultants.com/

### Findings

**P-1** — Render-blocking CSS and fonts delay first paint on mobile _(est. mobile FCP/LCP −1.4 s)_

Lighthouse counts a dozen render-blocking stylesheets in the head — the theme's `screen.css`, the cookie-banner and Paragraphs CSS, **Adobe Typekit** (`use.typekit.net`), and six separate Drupal `core/modules/system` component files (`clearfix`, `align`, `hidden`, …). That last group is the tell: those core files should be concatenated, so **CSS aggregation is off or incomplete**. On desktop the cost is minor; on mobile Lighthouse estimates **FCP and LCP −1.4 s** — the single biggest lever on the 4.4 s mobile LCP.

Turn on Drupal CSS aggregation, inline the critical CSS, and load Typekit without blocking render (async or `preload`). The web fonts also lack `font-display: swap`, holding first paint a further ~50 ms.

**P-2** — Third-party scripts are 62% of the page; the site's own code is ~7 KB _(830 KB of 1.33 MB is script)_

Script is **830 KB of the 1.33 MB page**, and almost none of it is the site's — the first-party JS is ~7 KB (`good.js`). The rest is bolted on: roughly **550 KB of injected scripts on randomised first-party paths** (`/35z3/…`, the signature of a Cloudflare-style bot-management / anti-fraud layer — confirm the vendor), **157 KB of Google Tag Manager**, a **67 KB chat widget**, and Snitcher visitor-tracking. Ignore Lighthouse's headline '755 KB unused JavaScript' — that figure is the auditor's own browser extensions, not site code. But the *real* third-party scripts still ship ~250 KB of unused code (GTM alone wastes 112 KB) and push mobile blocking time to 133 ms.

This is tag governance, not engineering. Audit what GTM loads, question whether the chat widget and Snitcher must load before first paint (defer or load on interaction), and confirm the bot-management layer needs to run site-wide. Rocket Loader is also on — verify it's helping rather than reordering this load badly.

**P-3** — The LCP feature image ships at full size to phones _(est. mobile LCP −0.6 s)_

The largest above-the-fold image — a `feature_promo` cover (`jfais_web_cover`, ~121 KB) — reaches mobile at essentially its desktop size, and Lighthouse's image-delivery insight estimates **LCP −0.6 s** from right-sizing it and its sibling feature images. They're **already WebP**, so this is sizing, not format. The Drupal image styles exist (`feature_promo_large` vs `_medium`); the fix is making the mobile breakpoint actually request the smaller derivative — a `srcset`/`sizes` or image-style mapping gap.

**P-4** — Some images lack explicit width and height _(CLS insurance)_

CLS is good on both runs (0.00 desktop, 0.03 mobile), but several images carry no intrinsic `width`/`height`, so the browser reserves no space before they load — fragile as content grows. Add dimensions (or CSS `aspect-ratio`) to lock the good score in.

## Conclusions

A well-built Drupal site let down by what's layered on top of it. Desktop is genuinely good (95, LCP 1.3 s). The mobile score of 81 — and its **4.4 s LCP, in Google's 'poor' band** — comes almost entirely from configuration and third-party choices, not the site's own code, which is lean (~7 KB CSS, ~7 KB JS).

The order of work is clear. Fixing render-blocking (CSS aggregation + non-blocking Typekit) is the biggest single win at ~1.4 s and is a Drupal config switch. Right-sizing the LCP feature image adds ~0.6 s. The harder, more political fix is the third-party load — 830 KB of GTM, chat, tracking and bot-management — which needs a tag audit and an owner's sign-off rather than an engineering change. None of it is re-architecture. As with any single lab run, confirm against field/CrUX data before treating 4.4 s as what every mobile user feels — but it's a real risk worth acting on now.

### Priority actions

1. Turn on Drupal CSS aggregation so the dozen core/theme stylesheets stop shipping separately; inline critical CSS and load Adobe Typekit without blocking render. ~1.4 s of mobile FCP/LCP — the highest-value change, and a config switch.
2. Right-size the LCP feature image for mobile (the `feature_promo` derivatives already exist; fix the breakpoint mapping). ~0.6 s of mobile LCP. Already WebP, so sizing not format.
3. Audit the third-party script load — 830 KB of GTM, a chat widget, Snitcher tracking and ~550 KB of injected bot-management JS. Defer or load-on-interaction whatever isn't needed for first paint; confirm the bot-management vendor and whether it must run site-wide.
4. Add explicit width/height (or `aspect-ratio`) to images to lock in the currently-good CLS.
5. Collect field/CrUX data to confirm the lab mobile-LCP picture before sign-off, and verify Cloudflare Rocket Loader is helping rather than hurting the third-party ordering.

## Glossary

- **Largest Contentful Paint** — Time to render the largest visible content above the fold. Good < 2.5 s, poor > 4 s.
- **Cumulative Layout Shift** — Sum of unexpected layout movement during load. Good < 0.1, poor > 0.25.
- **Interaction to Next Paint** — Time from a user interaction to the next visual response. Good < 200 ms, poor > 500 ms. A field-data metric — not produced by a Lighthouse lab run.
- **Total Blocking Time** — Lab proxy for INP: main-thread time blocked during load. Good < 200 ms.
- **Speed Index** — How quickly content visually populates during load. Good < 3.4 s.
- **First Contentful Paint** — Time to the first text or image painted. Good < 1.8 s.

## Appendix — raw test runs

- Lighthouse 13.2.0 — desktop lab: https://goodbrandconsultants.com/
- Lighthouse 13.2.0 — mobile lab: https://goodbrandconsultants.com/
