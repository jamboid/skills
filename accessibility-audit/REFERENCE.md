# Accessibility Audit — Reference

WCAG 2.1 success-criterion catalogue, issue-pattern detection checklist, severity
rubric, and the `findings.json` schema. Read this before scanning files.

---

## Severity rubric

Classify every finding into exactly one tier.

| Tier | Meaning |
|---|---|
| **Critical** | Broken markup, or a hard WCAG failure at level A with no mitigation. Blocks the affected content for whole user groups (e.g. invalid parsing that corrupts the DOM, autoplaying motion with no pause, a control with no accessible name and no fallback). Fix before release. |
| **High** | Missing a required ARIA pattern, or a clear failure of a level A/AA criterion with real user impact. The feature is usable by some but excludes assistive-technology or keyboard users. |
| **Medium** | Inconsistent practice that degrades the assistive-technology experience but does not fully block it. The criterion is borderline or technically met with poor quality. |
| **Low** | Minor improvement, redundancy, or documentation gap. No user is blocked; the fix hardens or clarifies existing correct behaviour. |

When unsure between two tiers, pick the higher one if a user group is *blocked*,
the lower one if they are merely *inconvenienced*.

---

## Issue-pattern detection checklist

Work through every category for each in-scope file. Patterns are framework-agnostic
— in Twig/Blade/JSX/Vue/ERB the offending markup is often built from variables, so
also inspect the values and preprocess/data layer where the template is thin.

### Images & non-text content
- `<img>` with no `alt` attribute at all — fails SC 1.1.1 (A).
- Decorative images that have descriptive `alt` text (should be `alt=""`).
- Informative images with empty or filename `alt` (`alt="image123.jpg"`).
- `<svg>` icons with no `aria-hidden="true"` and no label — pollutes the a11y tree.
- Icon-only links/buttons with no accessible name (no text, no `aria-label`).
- CSS background images carrying meaning with no text equivalent.

### Headings & document structure
- Debug/leftover headings (e.g. `<h1>filename</h1>`) shipped in templates.
- Skipped heading levels (`<h2>` followed by `<h4>`).
- Hardcoded heading levels in reusable components that may nest unpredictably.
- Multiple `<h1>`s injected by repeating components.
- Heading elements used purely for visual size, or styled text used as a heading.

### Links & buttons
- `<a href="#">` or `<a>` with no `href` used as a button — should be `<button>`.
- `<div>`/`<span>` with a click handler and no role, `tabindex`, or key handler.
- Links opening a new tab (`target="_blank"`) with no warning to the user.
- `target="_blank"` without `rel="noopener"` (also a security issue).
- Block links wrapping large content areas — the whole text becomes the name.
- Ambiguous link text ("click here", "read more") with no context or `aria-label`.

### Forms
- `<input>`/`<select>`/`<textarea>` with no associated `<label>` (no `for`/`id`,
  not wrapped, no `aria-label`/`aria-labelledby`).
- Placeholder text used as the only label.
- Required fields with no programmatic `required`/`aria-required`.
- Error messages not linked to their field via `aria-describedby`.
- Fieldsets of radios/checkboxes with no `<legend>`.

### ARIA widgets & interactive patterns
- Tabs, accordions, carousels, menus, dialogs, comboboxes with missing or partial
  ARIA roles/states (`role`, `aria-selected`, `aria-expanded`, `aria-controls`,
  `aria-labelledby`, `tabindex` management).
- `role="list"` on a non-`<ul>` whose children are not `role="listitem"`.
- Redundant roles (`role="button"` on `<button>`) — usually Low, but flag.
- Invalid `aria-*` attributes or `aria-labelledby`/`aria-controls` pointing at ids
  that do not exist in the template.
- Content injected entirely by JS with no server-rendered accessible baseline.

### Keyboard & focus
- Positive `tabindex` values (`tabindex="1"`+) that distort tab order.
- Interactive elements made unreachable (`tabindex="-1"` on a primary control).
- Focus traps, or modals/overlays with no focus management.
- `outline: none` / removed focus styles with no visible replacement.

### Media & motion
- `autoplay` video/animation running >5s with no pause/stop control — SC 2.2.2 (A).
- Audio that plays automatically — SC 1.4.2 (A).
- `<video>` with no captions track / `<audio>` with no transcript.
- No `prefers-reduced-motion` handling for animation or autoplaying media.

### Language, landmarks & names
- `<html>` with no `lang` attribute, or wrong/empty `lang`.
- Content in a different language with no inline `lang`.
- Missing landmark structure (`<main>`, `<nav>`, `<header>`, `<footer>`).
- Multiple same-type landmarks (`<nav>`, `<section>`) with no distinguishing
  accessible name (`aria-label` / `aria-labelledby`).
- `<section>`/`<article>`/`<region>` used as a landmark with no accessible name.

### Tables & data
- Data tables with no `<th>`, no `scope`, or used purely for layout.
- Layout tables that should be CSS grid/flex.

### Parsing & robustness
- Mismatched or stray tags (`</div>` closing nothing) — SC 4.1.1 considerations.
- Duplicate `id` values within a template's render scope.
- Malformed nesting (block elements inside `<p>`, `<li>` outside a list).

### Colour & contrast (runtime caveat)
- You can flag *likely* contrast failures from hardcoded colour pairs in templates
  or inline styles, but state that contrast must be confirmed at runtime against
  computed styles. Never assert a contrast ratio you have not measured.

---

## WCAG 2.1 success-criterion catalogue

Cite the criterion that best matches each finding. Format used in reports:
`SC 1.3.1 Info and Relationships (A)`.

### Level A (most common in markup audits)
- **1.1.1 Non-text Content** — text alternatives for images, icons, controls.
- **1.2.1 Audio-only / Video-only (Prerecorded)** — alternatives for media.
- **1.2.2 Captions (Prerecorded)** — captions for video with audio.
- **1.3.1 Info and Relationships** — structure conveyed in markup, not just visually.
- **1.3.2 Meaningful Sequence** — correct reading/DOM order.
- **1.4.1 Use of Colour** — colour is not the only means of conveying information.
- **1.4.2 Audio Control** — pause/stop for audio that plays automatically.
- **2.1.1 Keyboard** — all functionality available from the keyboard.
- **2.1.2 No Keyboard Trap** — focus can move away from any component.
- **2.2.2 Pause, Stop, Hide** — control for moving/auto-updating content.
- **2.4.1 Bypass Blocks** — skip link / landmarks to bypass repeated content.
- **2.4.2 Page Titled** — descriptive `<title>`.
- **2.4.3 Focus Order** — focus order preserves meaning and operability.
- **2.4.4 Link Purpose (In Context)** — link purpose clear from text or context.
- **3.1.1 Language of Page** — `lang` on `<html>`.
- **3.2.1 On Focus** — no context change on focus.
- **3.2.2 On Input** — no unexpected context change on input.
- **3.3.1 Error Identification** — input errors identified in text.
- **3.3.2 Labels or Instructions** — labels/instructions for user input.
- **4.1.1 Parsing** — (deprecated in 2.2; still cite for 2.1 parsing defects).
- **4.1.2 Name, Role, Value** — name/role/state exposed for all UI components.

### Level AA
- **1.3.4 Orientation** — content not locked to one orientation.
- **1.3.5 Identify Input Purpose** — `autocomplete` on common input fields.
- **1.4.3 Contrast (Minimum)** — 4.5:1 text, 3:1 large text.
- **1.4.4 Resize Text** — usable at 200% zoom.
- **1.4.5 Images of Text** — use real text, not images of text.
- **1.4.10 Reflow** — no loss at 320px width / 400% zoom.
- **1.4.11 Non-text Contrast** — 3:1 for UI components and graphics.
- **1.4.12 Text Spacing** — no loss when text spacing is increased.
- **1.4.13 Content on Hover or Focus** — dismissible, hoverable, persistent.
- **2.4.5 Multiple Ways** — more than one way to locate a page.
- **2.4.6 Headings and Labels** — descriptive headings and labels.
- **2.4.7 Focus Visible** — visible keyboard focus indicator.
- **3.2.3 Consistent Navigation** — consistent ordering of repeated navigation.
- **3.2.4 Consistent Identification** — consistent naming of repeated components.
- **4.1.3 Status Messages** — status messages exposed via role/`aria-live`.

### Level AAA (only when the audit explicitly targets AAA)
- **1.4.6 Contrast (Enhanced)** — 7:1 text, 4.5:1 large text.
- **2.2.3 No Timing**, **2.3.2 Three Flashes**, **2.4.8 Location**,
  **2.4.9 Link Purpose (Link Only)**, **2.4.10 Section Headings**,
  **3.3.5 Help** — cite the relevant one when auditing at AAA.

---

## `findings.json` schema

The build script consumes this file. Write it to the output folder.

```json
{
  "meta": {
    "title": "Accessibility Audit",
    "subtitle": "Twig Component Templates",
    "project": "Fluidmaster",
    "scope": "drupal/web/themes/custom/fluidmaster/templates/components/",
    "standard": "WCAG 2.1 AA",
    "date": "2026-05-15",
    "fileCount": 27,
    "slug": "twig-component-templates"
  },
  "summary": "One or more paragraphs of executive summary. Separate paragraphs with a blank line. Supports `code` and **bold**.",
  "severities": [
    { "id": "critical", "label": "Critical", "description": "Broken markup or hard WCAG failures with no mitigations." },
    { "id": "high",     "label": "High",     "description": "Missing ARIA patterns; fails SC at AA." },
    { "id": "medium",   "label": "Medium",   "description": "Inconsistent practices that degrade the AT experience." },
    { "id": "low",      "label": "Low",      "description": "Minor improvements and redundancies." }
  ],
  "issues": [
    {
      "id": "C-1",
      "severity": "critical",
      "title": "Debug `<h1>` tags left in production templates",
      "files": ["paragraph.html.twig", "paragraph--standalone_form.html.twig"],
      "filesDisplay": "list",
      "location": "line 11",
      "wcag": [
        "SC 1.3.1 Info and Relationships (A)",
        "SC 2.4.6 Headings and Labels (AA)"
      ],
      "code": [
        { "label": "Current code", "language": "twig", "content": "<h1>paragraph.html.twig</h1>" }
      ],
      "impact": "Screen readers announce a top-level `<h1>` for every instance.\n\nA second paragraph if needed.",
      "fixLabel": "Fix",
      "fixIntro": "Optional sentence shown before a fix list.",
      "fix": [
        "Remove all `<h1>` debug lines from every template.",
        "Re-check the heading outline afterwards."
      ]
    }
  ],
  "recommendations": [
    {
      "phase": "immediate",
      "label": "Immediate",
      "note": "Before next release",
      "items": [
        { "ref": "C-1", "severity": "critical", "text": "Remove all debug `<h1>` tags." }
      ]
    }
  ],
  "testing": [
    { "id": "vo",   "text": "VoiceOver + Safari (macOS) — navigate by headings, landmarks, and links." },
    { "id": "nvda", "text": "NVDA + Chrome (Windows) — verify widget patterns." },
    { "id": "kbd",  "text": "Keyboard-only navigation — tab through all interactive elements; confirm visible focus." },
    { "id": "axe",  "text": "axe DevTools — zero critical, zero serious violations." },
    { "id": "lh",   "text": "Lighthouse accessibility score ≥ 90 on representative pages." }
  ]
}
```

### Field rules

- **meta.slug** — optional; if omitted the script slugifies `subtitle`. Output
  files are `<slug>-audit.md` and `html/<slug>.html`; `slug` also namespaces the
  HTML `localStorage` keys.
- **meta.fileCount** — optional; omit or `0` to hide the file count.
- **severities** — list only the tiers you used; order is the report order. Each
  `id` must be one of `critical` / `high` / `medium` / `low`.
- **issues[].id** — stable, unique, conventionally `C-1`, `H-2`, `M-3`, `L-4`.
- **issues[].severity** — must match a `severities[].id`.
- **issues[].files** — optional list. `filesDisplay` is `"chips"` or `"list"`;
  if omitted, the script uses `"list"` for 4+ files, `"chips"` otherwise.
- **issues[].location** — optional (e.g. `"line 11"`, `"lines 42–48"`).
- **issues[].wcag** — list of criterion strings; required for every issue.
- **issues[].code** — optional ordered list of `{label, language, content}`;
  `content` is raw code (the script escapes it). Rendered at the top of the card.
- **issues[].impact** — required; blank lines split paragraphs.
- **issues[].fix** — required; a string (single paragraph) or a list (bullets).
- **issues[].fixLabel** / **fixIntro** — optional; `fixLabel` defaults to `"Fix"`.
- **recommendations** — optional; phases render in array order. `phase` is one of
  `immediate` / `short` / `medium` / `backlog` for colour coding.
- **testing** — optional; each item becomes a persisted checklist row.

Inline formatting in text fields: `` `code` `` → inline code, `**bold**` → bold.
These render in both the Markdown and the HTML.
