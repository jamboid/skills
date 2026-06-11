# Accessibility Audit — Test Fixture

`findings.json` here is **not** a real audit. It is a synthetic kitchen-sink
fixture that exercises every component the build script renders, so the styles
in `accessibility-audit/assets/report-template.html` (and the Markdown output)
can be eyeballed after editing.

Run from the repo root:

```
./test/build.sh accessibility-audit
```

This renders into `out/` (gitignored): `out/report-kitchen-sink-audit.md` and
`out/html/report-kitchen-sink.html`, then opens the HTML.

## What the fixture covers

- All four severity tiers (critical / high / medium / low) with descriptions.
- Both `filesDisplay` modes — `list` (C-1, 4 files) and `chips` (single + multi).
- A single-file issue with a `location` (C-2) and a location-only issue (H-2).
- Multiple labelled code blocks (C-1), and a code block with no label (C-2).
- Single- and multi-paragraph `impact`.
- `fix` as a bullet list with a `fixIntro` (C-1, H-1) and as a plain string.
- A custom `fixLabel` ("Recommended fix", H-1).
- All four recommendation phases (immediate / short / medium / backlog), with
  ref'd and un-ref'd items.
- A testing checklist.
- Inline `` `code` `` and **bold** spans throughout.
