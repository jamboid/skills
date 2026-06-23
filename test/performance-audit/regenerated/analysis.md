# Analysis: wattage.staging.gd

My considered take after reading all four data exports: desktop Lighthouse + WPT
(2026-06-18) and **now mobile Lighthouse + WPT (2026-06-20)**. This is the
authoritative voice that ratifies or drops the data-derived candidates.

## Architecture take

It's **Drupal** (stack-pack detection plus the `/core/`, `/sites/default/files/`,
and `/themes/custom/wattage/` paths). Two things stand out as good engineering:

- **CSS/JS aggregation is on.** The page ships as 2 hashed CSS aggregates plus a
  single ~2–4 KB JS file. No SPA framework, no hydration bundle — which is why
  **TBT is 0 on every run, including mobile at 4× CPU throttle**. This is
  server-rendered HTML, not a JS app, and the main thread proves it.
- **The icon system is SVG.** Logo and `icon_*` glyphs cost almost nothing.

So the byte budget is almost entirely raster photography, delivered through Drupal
image styles (`width_scale_xl`, `width_scale_m`). The staging host runs plain
**HTTP/1.1 with text compression off** — staging defaults, not code defects, but
they now matter (see below). Confirm production fronting before acting.

## Performance diagnosis

**The mobile data confirms what the desktop run only hinted at.** On 2026-06-18 I
wrote that the 1 MB of imagery "invisible at 0.7 s desktop LCP is exactly what
bites on a throttled phone." The mobile run bears that out:

| | Desktop | Mobile |
|---|---|---|
| Lighthouse score | 100 | 91 |
| LCP (Lighthouse) | 0.74 s | **3.40 s** (needs-improvement) |
| LCP (WebPageTest) | 0.56 s | 1.38 s |
| TBT | 0 | 0 |
| CLS | 0.00 / 0.015 | 0.00 / 0.044 |

The desktop story is unchanged — effectively solved. The work is all on mobile,
and it's **LCP-shaped, not CPU-shaped** (TBT stays 0, so JavaScript is not the
problem). Ratifying the candidates with the new mobile savings:

- **P-1 (image delivery) — confirmed, now HIGH.** On mobile the audit scores 0
  (was 0.5 on desktop). The concrete cause: the LCP hero is served as the
  **desktop `width_scale_xl` derivative (321 KB) to a phone, with 255 KB wasted** —
  plus two more oversized `width_scale_m` images. The responsive image styles
  aren't actually right-sizing for mobile. Worth ~300 ms of LCP, and images are
  ~80–90% of the page on both devices. This is the single biggest lever.
- **P-3 (HTTP/1.1) — confirmed, now HIGH.** Negligible on desktop (~0.25 s);
  on mobile Lighthouse estimates **LCP −850 ms and FCP −600 ms** from head-of-line
  blocking over 23 HTTP/1.1 requests. Enabling HTTP/2 is the highest-value config
  change available.
- **P-5 (render-blocking) — confirmed, now MEDIUM.** Two CSS + one JS block first
  paint; on mobile that's **FCP −600 ms** (was ~0.18 s on desktop).
- **P-2 (LCP is a CSS background) — confirmed, MEDIUM.** Still
  `div.b_media__bg` ("Turbine in the mist"), a `--bg` background the preload
  scanner can't see. Its own measured saving is ~0, but it's the *enabler*: until
  the hero is a real `<img>`, you can't apply `fetchpriority`/preload — the
  cheapest fix for the 3.4 s mobile LCP. Fix it alongside P-1.
- **P-4 (no text compression) — confirmed, LOW.** `usesCompression: false` on
  both runs. Small absolute cost; free standard win; signals an untuned box.
  (The server itself is fast: ~80 ms response, no redirects.)
- **P-6 (unsized images) — confirmed, LOW.** 14 images without `width`/`height`.
  CLS is good on all four runs (≤ 0.044) but that's fragile — add dimensions.

**Dismissed again (important):** Lighthouse's `unused-javascript` (820 KB!) and
`unminified-javascript` are **measurement noise — every URL is a
`chrome-extension://` script** (the auditor's DevTools, 1Password, ad-blocker,
Web Vitals), on the mobile run exactly as on desktop. The site's real JS is
~2–4 KB. This stays out of the report.

**Tool disagreement, now sharper.** On mobile LCP the tools split 3.40 s
(Lighthouse) vs 1.38 s (WebPageTest). Lighthouse's simulated mobile (4× CPU,
~1.6 Mbps) is the pessimistic lab; WebPageTest throttled the connection (TTFB
~720 ms) but evidently not the CPU as hard, landing far faster. Real-world mobile
LCP is somewhere between — and only **field/CrUX data** (still absent) settles it.
The two tools also still disagree on desktop image bytes (LH 1007 KB vs WPT
573 KB), the same responsive-derivative non-determinism that underlies P-1.

**Remaining gap:** still no real-user field data. Lab is now complete on both
form factors, but CrUX would confirm whether the 3.4 s lab LCP is what users
actually feel.

## Conclusions

A lean, competently built Drupal site — server-rendered, aggregated assets,
negligible JavaScript, SVG iconography. Desktop is solved. The mobile data, now
in hand, turns the earlier prediction into a fact: the page is **LCP-bound on
mobile (3.4 s in the pessimistic lab), driven by oversized images and an untuned
HTTP/1.1 server — not by JavaScript** (TBT is 0 everywhere).

That's good news, because every lever is cheap. Right-size the responsive image
derivatives so phones stop downloading the 321 KB desktop hero, promote that hero
to a preloadable `<img>`, and flip on HTTP/2 + compression at the server — three
changes, no re-architecture, that between them reclaim well over a second of
mobile LCP. The only thing still missing is field/CrUX data to confirm the lab
picture; the lab itself is now complete on both form factors.

## Priorities

1. Right-size the responsive image derivatives — mobile is being served the
   321 KB desktop hero (255 KB wasted) — and convert raster photos to AVIF/WebP.
   Images are ~80–90% of the page and the dominant mobile-LCP cause.
2. Enable HTTP/2 (and text compression) on the server — Lighthouse estimates
   ~850 ms of mobile LCP from HTTP/1.1 head-of-line blocking alone.
3. Make the hero (LCP) a real `<img>` with `fetchpriority="high"` (or preload it)
   instead of a CSS background, so it's discoverable — the cheapest LCP win.
4. Trim render-blocking CSS/JS in the head (inline critical CSS, defer JS) —
   ~600 ms of mobile FCP.
5. Add explicit `width`/`height` to images to lock in the good CLS, then collect
   field/CrUX data to confirm the lab mobile-LCP picture before sign-off.
