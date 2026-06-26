# Website Performance Review: goodbrandconsultants.com

**URL:** https://goodbrandconsultants.com/ · **Date:** 2026-06-22 · **Scope:** site audit, performance-focused · **Audience:** internal SD/AD

## Summary

`goodbrandconsultants.com` is a live Drupal site (fronted by Cloudflare), and this is a performance-focused review of its homepage — how quickly it loads and becomes usable for a visitor. We measured it in the lab with Google's **Lighthouse** tool, on both a desktop and a throttled mid-range phone, so the figures below are a controlled snapshot rather than live field data.

As it stands, **desktop performance is good but mobile is poor**. Lighthouse scores the page **95 out of 100 on desktop**, where the main content appears in **1.3 seconds**, but only **81 on mobile**, where that same content takes **4.4 seconds** — well into Google's 'poor' range. (That figure is the LCP, or Largest Contentful Paint: the moment the biggest thing on screen finishes loading.)

The site's own code isn't the problem — it's tiny, roughly 7 KB of styling and 7 KB of JavaScript. Almost all of the page's weight is third-party code bolted on around it:

- **~550 KB** of bot-management scripts, loaded from randomised paths
- **157 KB** of Google Tag Manager
- a **67 KB** chat widget
- visitor-tracking scripts

That third-party weight, together with a dozen un-combined stylesheets and fonts that hold up the first paint, is what a throttled phone struggles with — a fast desktop shrugs it all off. The findings and conclusions below break down each cause and what to do about it.

## Metrics

The numbers below come from **Google Lighthouse** (v13.2.0), run in the lab — a controlled local test, not readings from real visitors. Two runs were captured: a simulated **desktop** on a fast connection, and a throttled mid-range **mobile** (Moto-class, processor 4× slower, network capped). Each run's full JSON export was parsed for the performance score and the **Core Web Vitals** — Google's standard loading and responsiveness measures — shown per device below.

### Desktop

#### Lighthouse — performance score 95

_Lighthouse 13.2.0 (lab, simulated desktop)_

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

_Lighthouse 13.2.0 (lab, Moto-class, 4× CPU + throttled link)_

| Metric | Value | Rating |
|---|---|---|
| FCP | 2.4 s | Needs improvement |
| LCP | 4.4 s | Poor |
| Speed Index | 2.4 s | Good |
| TBT | 133 ms | Good |
| CLS | 0.03 | Good |
| INP | lab N/A | N/A |

## Page resources

The homepage pulls in **49 files totalling 1.33 MB** (desktop; mobile is near-identical), broken down by type as:

- **Script: ~810 KB (62%)**
- **Images: ~378 KB (29%)**
- **Fonts: ~81 KB (6%)**
- **Everything else: ~33 KB (3%)** — the HTML document, eleven stylesheets, and tracking beacons

The full per-file breakdown is below, grouped by type and sortable by device.

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

- `jfais_web_cover.png.webp` ([goodbrandconsultants.com](https://goodbrandconsultants.com/sites/default/files/styles/feature_promo_large/public/images/2026-05/jfais_web_cover.png.webp?itok=F-tV4pM8)) — 118 KB / 118 KB
- `homepage_buttons_strategic-framework.jpg.webp` ([goodbrandconsultants.com](https://goodbrandconsultants.com/sites/default/files/styles/feature_promo_medium/public/images/2024-12/homepage_buttons_strategic-framework.jpg.webp?itok=X9dLVR1J)) — 114 KB / 114 KB
- `homepage_buttons_journal-1.jpg.webp` ([goodbrandconsultants.com](https://goodbrandconsultants.com/sites/default/files/styles/feature_promo_medium/public/images/2024-12/homepage_buttons_journal-1.jpg.webp?itok=aNHLWDbF)) — 83 KB / 83 KB
- `results-chris.jpg.webp` ([goodbrandconsultants.com](https://goodbrandconsultants.com/sites/default/files/styles/feature_promo_medium/public/images/2025-08/results-chris.jpg.webp?itok=HiWyYQpQ)) — 20 KB / 20 KB
- `devro1_0_0.png.webp` ([goodbrandconsultants.com](https://goodbrandconsultants.com/sites/default/files/styles/feature_promo_medium/public/images/2024-09/devro1_0_0.png.webp?itok=M26Mpfpw)) — 18 KB / 18 KB
- _+8 files under 10 KB — 24 KB / 24 KB_

**Font**

- `l` ([use.typekit.net](https://use.typekit.net/af/c71bce/00000000000000007754210b/30/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n4&v=3)) — 81 KB / 81 KB

**Document**

- `goodbrandconsultants.com` ([goodbrandconsultants.com](https://goodbrandconsultants.com/)) — 7 KB / 7 KB

**Stylesheet**

- `screen.css` ([goodbrandconsultants.com](https://goodbrandconsultants.com/themes/custom/good/assets/build/screen.css?tgxqsh)) — 14 KB / 14 KB
- _+10 files under 10 KB — 8 KB / 8 KB_

**Script**

- `lhp3vTZiNH4QuI1DeMnkajxgWAYmE_BYWeqRghcX2zATLO0G` ([goodbrandconsultants.com](https://goodbrandconsultants.com/35z3/lhp3vTZiNH4QuI1DeMnkajxgWAYmE_BYWeqRghcX2zATLO0G)) — 189 KB / 189 KB
- `lhp3vTZiMgRl2YI2Hc2SG0AaWAYmE_BYWeqRghcX2zATLO0G` ([goodbrandconsultants.com](https://goodbrandconsultants.com/35z3/lhp3vTZiMgRl2YI2Hc2SG0AaWAYmE_BYWeqRghcX2zATLO0G)) — 189 KB / 189 KB
- `35z3` ([goodbrandconsultants.com](https://goodbrandconsultants.com/35z3/)) — 163 KB / 163 KB
- `gtm.js` ([www.googletagmanager.com](https://www.googletagmanager.com/gtm.js?id=GTM-5HZNGGB)) — 153 KB / 153 KB
- `widget.js` ([chat.goodai.works](https://chat.goodai.works/widget.js)) — 66 KB / 66 KB
- `radar.min.js` ([cdn.snitcher.com](https://cdn.snitcher.com/releases/latest/radar.min.js)) — 21 KB / 21 KB
- `v833ccba57c9e4d2798f2e76cebdd09a11778172276447` ([static.cloudflareinsights.com](https://static.cloudflareinsights.com/beacon.min.js/v833ccba57c9e4d2798f2e76cebdd09a11778172276447)) — 11 KB / 11 KB
- _+5 files under 10 KB — 18 KB / 18 KB_

**Other**

- _+7 files under 10 KB — 4 KB / 4 KB_

## Site architecture

The site runs on **Drupal**, an open-source content management system. It uses a custom theme called `good` (`/themes/custom/good/`) for its look, the Paragraphs module to build flexible page layouts, and Drupal's image styles (`feature_promo_large`, `feature_promo_medium`) to generate resized copies of images automatically.

Sitting in front of the site is **Cloudflare**, a service that caches pages and delivers them from servers close to each visitor. Its `rocket-loader.min.js` script and `/cdn-cgi/rum` tracking beacon confirm it's in use, with the Rocket Loader feature switched on.

The page is **server-rendered** (the HTML arrives ready to display rather than being assembled in the browser), and the site's own code is light: the theme ships only ~14 KB of CSS (`screen.css`, the styling) and ~7 KB of JavaScript (`good.js`, the behaviour). Almost all of the page's weight comes from **third-party scripts**: code loaded from other companies' services rather than the site itself.

The main third-party scripts are:

- **Adobe Typekit** — serves the web fonts. These are *render-blocking*, meaning the browser holds off showing text until the fonts have downloaded, which delays the first thing the visitor sees.
- **Google Tag Manager** (157 KB) — a container that loads marketing and analytics tags.
- **Snitcher** (`radar.min.js`) — identifies which companies are visiting the site (B2B visitor de-anonymisation).
- **Chat widget** (`chat.goodai.works`, 67 KB) — loads on every page, whether or not anyone uses it.
- **~550 KB of unlabelled script** from randomised paths that look first-party (`/35z3/…`) — the fingerprint of an injected bot-management or anti-fraud layer. Confirm the vendor (most likely Cloudflare) before changing anything here.

One quick win stands out. The site's CSS arrives as a dozen separate files (`core/modules/system/…`), which means Drupal's **CSS aggregation** — the setting that bundles those files into one download — is turned off or only partly on. Switching it on is a configuration change, not a code change.

## Performance

### Findings

**F1** — Render-blocking CSS and fonts delay first paint on mobile _(est. mobile FCP/LCP −1.4 s)_

Lighthouse counts a dozen render-blocking stylesheets in the head — the theme's `screen.css`, the cookie-banner and Paragraphs CSS, **Adobe Typekit** (`use.typekit.net`), and six separate Drupal `core/modules/system` component files (`clearfix`, `align`, `hidden`, …). That last group is the tell: those core files should be concatenated, so **CSS aggregation is off or incomplete**. On desktop the cost is minor; on mobile Lighthouse estimates **FCP and LCP −1.4 s** — the single biggest lever on the 4.4 s mobile LCP.

Turn on Drupal CSS aggregation, inline the critical CSS, and load Typekit without blocking render (async or `preload`). The web fonts also lack `font-display: swap`, holding first paint a further ~50 ms.

**F2** — Third-party scripts are 62% of the page; the site's own code is ~7 KB _(830 KB of 1.33 MB is script)_

Script is **830 KB of the 1.33 MB page**, and almost none of it is the site's — the first-party JS is ~7 KB (`good.js`). The rest is bolted on: roughly **550 KB of injected scripts on randomised first-party paths** (`/35z3/…`, the signature of a Cloudflare-style bot-management / anti-fraud layer — confirm the vendor), **157 KB of Google Tag Manager**, a **67 KB chat widget**, and Snitcher visitor-tracking. Ignore Lighthouse's headline '755 KB unused JavaScript' — that figure is the auditor's own browser extensions, not site code. But the *real* third-party scripts still ship ~250 KB of unused code (GTM alone wastes 112 KB) and push mobile blocking time to 133 ms.

This is tag governance, not engineering. Audit what GTM loads, question whether the chat widget and Snitcher must load before first paint (defer or load on interaction), and confirm the bot-management layer needs to run site-wide. Rocket Loader is also on — verify it's helping rather than reordering this load badly.

**F3** — The LCP feature image ships at full size to phones _(est. mobile LCP −0.6 s)_

The largest above-the-fold image — a `feature_promo` cover (`jfais_web_cover`, ~121 KB) — reaches mobile at essentially its desktop size, and Lighthouse's image-delivery insight estimates **LCP −0.6 s** from right-sizing it and its sibling feature images. They're **already WebP**, so this is sizing, not format. The Drupal image styles exist (`feature_promo_large` vs `_medium`); the fix is making the mobile breakpoint actually request the smaller derivative — a `srcset`/`sizes` or image-style mapping gap.

**F4** — Some images lack explicit width and height _(CLS insurance)_

CLS is good on both runs (0.00 desktop, 0.03 mobile), but several images carry no intrinsic `width`/`height`, so the browser reserves no space before they load — fragile as content grows. Add dimensions (or CSS `aspect-ratio`) to lock the good score in.

## Conclusions

This is a well-built Drupal site let down by what's been layered on top of it. On desktop it's genuinely good — 95 out of 100, with the main content showing in 1.3 seconds. The mobile score of 81, and its **4.4-second load that lands in Google's 'poor' range**, comes almost entirely from configuration and third-party choices, not the site's own code, which is lean (~7 KB of styling, ~7 KB of JavaScript).

The order of work is clear:

- **Fix the render-blocking styles and fonts first.** Turn on Drupal's CSS aggregation (the setting that combines those stylesheets into one) and load the Typekit fonts so they don't block the page. This is the single biggest win at around **1.4 seconds**, and it's a configuration switch rather than a code change.
- **Right-size the main feature image** so phones aren't downloading the full desktop-sized version. Worth about **0.6 seconds**.
- **Trim the third-party load** — the 830 KB of Google Tag Manager, chat, tracking and bot-management scripts. This is the harder, more political fix: it needs a review of which tags still earn their place and a sign-off from whoever owns them, not an engineering change.

None of this is a re-architecture. One caveat: these figures come from a single lab test, so before treating 4.4 seconds as what every mobile visitor actually feels, confirm it against real-world field data (Google's CrUX report). But it's a genuine risk, and worth acting on now.

### Priority actions

1. **Aggregate and unblock the page's CSS and fonts**  _(Impact: High · Effort: Low)_

   A dozen Drupal core and theme stylesheets ship as separate files that block the first paint, and Adobe Typekit loads the same blocking way. Turning on aggregation, inlining the critical CSS and loading the fonts asynchronously is a configuration switch — no redesign — worth about 1.4 s of mobile load time. It's the single highest-value change here.

   Related findings: F1

2. **Right-size the hero image for phones**  _(Impact: High · Effort: Medium)_

   The main feature image is sent to phones at its full desktop size. The correctly-sized feature_promo derivatives already exist; the breakpoint mapping just isn't pointing mobile at them. It's already WebP, so this is about dimensions, not format — roughly 0.6 s of mobile LCP.

   Related findings: F3

3. **Reconsider the third-party script load**  _(Impact: High · Effort: High)_

   Third-party tags account for 62% of the page — 830 KB of Google Tag Manager, a chat widget, Snitcher tracking and ~550 KB of injected bot-management JavaScript — against roughly 7 KB of the site's own code. Deferring or loading-on-interaction whatever isn't needed for first paint, and confirming whether the bot-management vendor must run site-wide, is part judgement call and part engineering.

   Related findings: F2

4. **Lock in layout stability with image dimensions**  _(Impact: Low · Effort: Low)_

   Layout shift is currently good, but it isn't guaranteed — several images load without reserved space. Adding explicit width/height (or aspect-ratio) keeps the page from jumping around as it loads, even as content changes.

   Related findings: F4

5. **Confirm the mobile picture with field data before sign-off**  _(Impact: Low · Effort: Low)_

   The mobile-LCP story here comes from lab tests. Collecting real-world field/CrUX data confirms it against actual visitors, and it's worth checking that Cloudflare Rocket Loader is helping rather than reshuffling the third-party script order unhelpfully.

   _Strategic priority_

## Glossary

- **Largest Contentful Paint** — Time to render the largest visible content above the fold. Good < 2.5 s, poor > 4 s.
- **Cumulative Layout Shift** — Sum of unexpected layout movement during load. Good < 0.1, poor > 0.25.
- **Interaction to Next Paint** — Time from a user interaction to the next visual response. Good < 200 ms, poor > 500 ms. A field-data metric — not produced by a Lighthouse lab run.
- **Total Blocking Time** — Lab proxy for INP: main-thread time blocked during load. Good < 200 ms.
- **Speed Index** — How quickly content visually populates during load. Good < 3.4 s.
- **First Contentful Paint** — Time to the first text or image painted. Good < 1.8 s.
