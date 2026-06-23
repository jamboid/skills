# Website Performance Review: wattage.staging.gd

**URL:** https://wattage.staging.gd/ · **Date:** 2026-06-20 · **Scope:** site audit, performance-focused · **Audience:** internal SD/AD

## Summary

`wattage.staging.gd` performance is **optimal on desktop** (Lighthouse **100**, LCP 0.7 s, 0 ms blocking, no layout shift) and **good-but-improvable on mobile** (Lighthouse **91**, LCP **3.4 s** in the pessimistic lab). It's a lean Drupal build: server-rendered HTML, aggregated CSS/JS, only ~2–4 KB of script, all-SVG icons — so **TBT stays 0 even on mobile at 4× CPU throttle**. The mobile problem is not JavaScript; it's LCP.

Two causes drive it: an oversized hero image (a phone is served the **314 KB desktop derivative**, where its sibling banners right-size to 43–87 KB) and an untuned **HTTP/1.1** server (~850 ms of mobile LCP from head-of-line blocking). Both are cheap to fix.

Lab coverage is now complete on both form factors. The remaining gap is **field/CrUX data** to confirm what real mobile users feel.

## Metrics

### Desktop

#### Overall average

_Mean of 2 runs (Lighthouse, WebPageTest)_

| Metric | Value | Rating |
|---|---|---|
| FCP | 0.5 s | Good |
| LCP | 0.7 s | Good |
| Speed Index | 0.6 s | Good |
| TBT | 0 ms | Good |
| CLS | 0.01 | Good |
| INP | lab N/A | N/A |

#### Lighthouse — performance score 100

_Lighthouse 13.2.0 (lab, simulated desktop)_

| Metric | Value | Rating |
|---|---|---|
| FCP | 0.5 s | Good |
| LCP | 0.7 s | Good |
| Speed Index | 0.5 s | Good |
| TBT | 0 ms | Good |
| CLS | 0.00 | Good |
| INP | lab N/A | N/A |

#### WebPageTest

_WebPageTest (Chrome 145, desktop), median of 3 runs_

| Metric | Value | Rating |
|---|---|---|
| FCP | 0.6 s | Good |
| LCP | 0.6 s | Good |
| Speed Index | 0.6 s | Good |
| TBT | 0 ms | Good |
| CLS | 0.01 | Good |

### Mobile

#### Overall average

_Mean of 2 runs (Lighthouse, WebPageTest)_

| Metric | Value | Rating |
|---|---|---|
| FCP | 1.6 s | Good |
| LCP | 2.4 s | Good |
| Speed Index | 1.7 s | Good |
| TBT | 0 ms | Good |
| CLS | 0.02 | Good |
| INP | lab N/A | N/A |

#### Lighthouse — performance score 91

_Lighthouse 13.2.0 (lab, Moto-class, 4× CPU + ~1.6 Mbps)_

| Metric | Value | Rating |
|---|---|---|
| FCP | 1.8 s | Good |
| LCP | 3.4 s | Needs improvement |
| Speed Index | 1.8 s | Good |
| TBT | 0 ms | Good |
| CLS | 0.00 | Good |
| INP | lab N/A | N/A |

#### WebPageTest

_WebPageTest (Chrome 145, mobile, throttled link), median of 3 runs_

| Metric | Value | Rating |
|---|---|---|
| FCP | 1.4 s | Good |
| LCP | 1.4 s | Good |
| Speed Index | 1.5 s | Good |
| TBT | 0 ms | Good |
| CLS | 0.04 | Good |

## Page resources

| Category | Requests | Desktop | Mobile |
|---|---:|---:|---:|
| Images | 16 | 1007 KB | 575 KB |
| Font | 1 | 76 KB | 76 KB |
| Document | 1 | 39 KB | 39 KB |
| Stylesheet | 2 | 8 KB | 27 KB |
| Script | 1 | 2 KB | 4 KB |
| Other | 1 | 6 KB | 6 KB |
| **Total** | 22 | 1.1 MB | 727 KB |

**Images**

- `wattage_sample_banner4.png.webp` — 314 KB / 314 KB
- `wattage_sample_banner2.png.webp` — 297 KB / 87 KB
- `wattage_sample_banner3.png.webp` — 276 KB / 43 KB
- `wattage_sample_headshot.png.webp` — 61 KB / 61 KB
- `sander-weeteling-iGDg_f_mlWo-unsplash.jpg.webp` — 26 KB / 36 KB
- _+11 files under 10 KB — 34 KB / 34 KB_

**Font**

- `PPNeueMontreal-Regular.woff2` — 76 KB / 76 KB

**Document**

- `/` — 39 KB / 39 KB

**Stylesheet**

- `css_73bAv145fk0MBJnf4xeJhRDKz6PhTh4_wVjsfs2nsSE.css` — 7 KB / 25 KB
- `css_FEx1Wcz4WWqzw8R6nnA0juvEB5JGKHsmg4-fgA_8jDw.css` — 1 KB / 2 KB

**Script**

- `js_u2wnIPF3upgFgreJx4ZDYoBgyxayPWIFfUjByIau6Bo.js` — 2 KB / 4 KB

**Other**

- `favicon.ico` — 6 KB / 6 KB

## Site architecture

Drupal, served from a custom theme (`/themes/custom/wattage/`); stack-pack detection and the `/core/` and `/sites/default/files/` paths confirm it. CSS/JS aggregation is on — the whole page ships as 2 hashed CSS aggregates plus a single ~2–4 KB JS file. There is no SPA framework or hydration bundle, which is why the main thread is idle and **TBT is 0 on every run, including mobile at 4× CPU throttle**: this is a server-rendered HTML page, not a JavaScript app.

The icon system is SVG (logo and `icon_*` glyphs), so it costs almost nothing. The page's byte budget is therefore almost entirely raster photography, delivered through Drupal image styles (`width_scale_xl`, `width_scale_m`) — and those derivatives aren't right-sized for mobile (see findings). The staging host runs plain HTTP/1.1 with text compression off; those are staging defaults, not code defects, but they cost real time on mobile. Confirm production fronting (CDN/edge) before acting.

## Performance

### Tests

- Lighthouse 13.2.0 — desktop lab: https://wattage.staging.gd/
- Lighthouse 13.2.0 — mobile lab: https://wattage.staging.gd/
- WebPageTest — desktop (3 runs): https://wattage.staging.gd/
- WebPageTest — mobile (3 runs): https://wattage.staging.gd/

### Findings

**P-1** — The LCP hero is the full desktop image, even on mobile _(~227 KB on mobile · LCP −0.3 s)_

On mobile this audit scores 0 (it was 0.5 on desktop). The per-asset data pins it exactly: the three sample banners all ship as `width_scale_xl` on desktop (~276–314 KB each), and on mobile two of them **correctly drop to `width_scale_m` (297→87 KB and 276→43 KB) — but the LCP hero stays at 314 KB.** The reason is P-2: the hero is a CSS background (`b_media__bg`), and backgrounds get no responsive `srcset`/derivative, so the phone is forced to download the full desktop image.

The images are **already WebP**, so this is a sizing problem, not a format one. Give the hero a responsive treatment (the same image styles its siblings already use, ideally via a real `<img srcset>` per P-2); that alone reclaims ~227 KB and ~0.3 s of LCP on mobile. AVIF would shave a little more, but sizing is the lever.

**P-3** — Server is on HTTP/1.1 — no multiplexing _(est. mobile LCP −0.85 s · FCP −0.6 s)_

All 23 requests are served over HTTP/1.1, so they queue (head-of-line blocking). Negligible on desktop (~0.25 s), but on mobile Lighthouse estimates **LCP −850 ms and FCP −600 ms**. Enabling HTTP/2 (or HTTP/3) is the highest-value config change here. It's a server setting, not code — confirm production isn't already doing it before prioritising.

**P-2** — LCP hero is a CSS background image, so it can't be preloaded _(enables the cheapest LCP fix)_

The largest element is `div.b_media__bg` ("Turbine in the mist"), a background set via a `--bg` custom property rather than an `<img>`. The preload scanner never sees background images, so the most important image is discovered late. Its own measured saving is ~0, but it's the *enabler*: until the hero is a real `<img>`, you can't apply `fetchpriority="high"` or `<link rel="preload">` — the cheapest fix for the 3.4 s mobile LCP. Do it alongside P-1.

**P-5** — Render-blocking CSS/JS in the head _(est. mobile FCP −0.6 s)_

Two aggregated CSS files and one JS file block first paint. Minor on desktop (~0.18 s), but on mobile that's **FCP −600 ms**. Inline critical CSS and defer the JS; the page is light enough that this is straightforward.

**P-4** — Text assets served without compression _(free win)_

Both runs report `usesCompression: false` — the HTML document and CSS ship uncompressed. The absolute cost is small on this light page, but gzip/brotli is standard and free, and its absence signals the staging box isn't tuned. Turn it on at the server. (The server itself is fast: ~80 ms response, no redirects.)

**P-6** — Images lack explicit width and height _(CLS insurance)_

14 images have no explicit `width`/`height`, so the browser reserves no space before they load. CLS is good on all four runs (≤ 0.044), but that's fragile: as content grows, unsized images are the usual cause of layout shift. Add dimensions (or CSS `aspect-ratio`) to lock the good CLS in.

## Conclusions

A lean, competently built Drupal site — server-rendered, aggregated assets, negligible JavaScript, SVG iconography. Desktop is solved. The mobile data, now in hand, turns the earlier desktop-only prediction into a fact: the page is **LCP-bound on mobile (3.4 s in the pessimistic lab), driven by oversized images and an untuned HTTP/1.1 server — not by JavaScript** (TBT is 0 on every run). It's worth ignoring Lighthouse's 820 KB of "unused JavaScript": every byte of it is the auditor's own browser extensions, not site code.

The good news is that every lever is cheap. The single highest-value change does double duty: promote the hero from a CSS background to a responsive `<img>` — that both right-sizes it for mobile (314 KB → ~87 KB, the size its siblings already use) and makes it preloadable. Add HTTP/2 + compression at the server and that's well over a second of mobile LCP reclaimed, with no re-architecture. The images are already WebP, so this is sizing and transport, not format. Note the two tools disagree on mobile LCP (Lighthouse 3.4 s vs WebPageTest 1.4 s): the simulated mobile lab is pessimistic, WebPageTest's throttle gentler, and real-world LCP sits between them. Lab coverage is now complete on both form factors; the one thing still missing is field/CrUX data to confirm what users actually feel.

### Priority actions

1. Convert the LCP hero from a CSS background to a responsive `<img>` (`srcset` + `fetchpriority="high"`). One change, two fixes: it right-sizes the hero on mobile (314 KB → ~87 KB, matching its siblings) and makes it discoverable for preload. Highest-value action.
2. Enable HTTP/2 (and text compression) on the server — Lighthouse estimates ~850 ms of mobile LCP from HTTP/1.1 head-of-line blocking alone.
3. Trim render-blocking CSS/JS in the head (inline critical CSS, defer JS) — ~600 ms of mobile FCP.
4. Confirm the rest of the imagery is right-sized per breakpoint (the other banners already are). Images are already WebP; AVIF would shave a little more if needed.
5. Add explicit `width`/`height` to images to lock in the good CLS, then collect field/CrUX data to confirm the lab mobile-LCP picture before sign-off.

## Glossary

- **Largest Contentful Paint** — Time to render the largest visible content above the fold. Good < 2.5 s, poor > 4 s.
- **Cumulative Layout Shift** — Sum of unexpected layout movement during load. Good < 0.1, poor > 0.25.
- **Interaction to Next Paint** — Time from a user interaction to the next visual response. Good < 200 ms, poor > 500 ms. A field-data metric — not produced by a Lighthouse lab run.
- **Total Blocking Time** — Lab proxy for INP: main-thread time blocked during load. Good < 200 ms.
- **Speed Index** — How quickly content visually populates during load. Good < 3.4 s.
- **First Contentful Paint** — Time to the first text or image painted. Good < 1.8 s.
- **Page weight** — Total bytes downloaded to render the page. More weight means longer load, more parsing, more mobile bandwidth.
- **Request count** — Number of HTTP requests to render the page. High counts (> 100) usually signal concatenation/optimisation gaps.

## Appendix — raw test runs

- Lighthouse 13.2.0 — desktop lab: https://wattage.staging.gd/
- Lighthouse 13.2.0 — mobile lab: https://wattage.staging.gd/
- WebPageTest — desktop (3 runs): https://wattage.staging.gd/
- WebPageTest — mobile (3 runs): https://wattage.staging.gd/
