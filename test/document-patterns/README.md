---
title: Template Test Gallery
eyebrow: Test Fixture
heading: Pattern HTML template gallery
lede: Fixture docs that exercise every component the build script renders. Regenerate after editing the templates in `document-patterns/assets/`, then eyeball the output.
section_heading: Fixtures
---

These markdown files are not real pattern docs — they exist to test and preview
the HTML template styles. Run `./test/build.sh document-patterns` from the repo
root to regenerate the gallery into `out/` and open it.

- [Kitchen-Sink Pattern](kitchen-sink.md) — every component on one page, incl. the compare-grid overflow regression guard.
- [Client Layer Placeholder](client-layer.md) — `client` category card.
- [Shared Utils Placeholder](shared-utils.md) — `shared` category card.
- [Combo Flow Placeholder](combo-flow.md) — `combo` category card.
- [State Machine Placeholder](state-machine.md) — `state` category card, default-icon fallback.
