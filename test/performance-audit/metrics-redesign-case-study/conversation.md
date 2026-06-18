# Case study — redesigning the performance-audit metrics section

A design dialogue, captured for reuse as a case study. The goal: take the
performance-audit HTML report's Metrics section — a flat grid of coloured number
cards — and prototype something more compelling, then wire the chosen direction
into the real template and build script.

Each round below pairs the **brief** (the client/user's actual words) with **what
was built** and **the decision** that carried into the next round. Prototype files
referenced live in `../prototypes/`; screenshots in `../images/`.

---

## Round 0 — Starting point

The original Metrics section rendered, per device, a grid of flat cards: a coloured
top-border, a big number, a label. The number's colour told you good / needs-improvement
/ poor, but nothing showed *where in the range* a value sat, how much headroom existed,
or how two test runs compared.

---

## Round 1 — Three directions

> **Brief:** "I think the metrics section could present its data in a more compelling
> way and I'd like to prototype some alternatives to the current approach."

**Built** (`prototypes/v1-three-directions.html`) — three treatments, all rendered from
the real Wattage staging audit data:

- **A — Threshold rails.** Each metric on a good→ni→poor rail with a marker. Headroom
  becomes instantly legible.
- **B — Core Web Vitals hero.** The three Google CWV as arc gauges; secondary metrics as
  a chip strip.
- **C — Comparison matrix.** Metrics as rows, devices as columns, mini-rail per cell.

![Threshold rails](../images/v1-threshold-rails.png)

**Decision:** A was the strongest general upgrade — the headroom cue is the real
improvement over flat cards. B looked striking but fought the data (lab INP gap; arc
fill wasn't semantically meaningful). C was best only for multi-device comparison.

---

## Round 2 — Tabs + averaged default + load-story narrative

> **Brief:** "I prefer N1 [rails]… I'd like different groups of rails to be in a set of
> tabs… create an average, calculated dataset as the default, with the specific test
> rail groups behind alternative tabs. Also, there's not much narrative here… Some way of
> putting each metric in the context of the page loading would be good. Maybe prototype a
> few more options for that in particular."

**Built** (`prototypes/v2-narrative-options.html`) — tabbed rails (computed **Average**
as the default tab, each run behind its own tab), plus three narrative treatments:

- **N1 — Phase-grouped rails.** Sorted into Painting → Responding → Stability, each with
  a plain-language blurb; all acronyms spelled out.
- **N2 — To-scale load timeline.** Paint milestones plotted on a real time axis. *Flaw:*
  on a fast site all values cluster sub-second and the labels collide — fragile.
- **N3 — Stepped "load story."** Each metric a moment in sequence: *First paint → Main
  content in → Visually complete → Ready to respond → Layout settled → Stays snappy.*

![Stepped load story](../images/v2-stepped-load-story.png)

**Decision:** N1's rail clarity won, but borrow N3's plain-language milestone labels.
N2 shelved (collision-prone). The averaged default + per-run tabs were adopted.

---

## Round 3 — Timeline spine

> **Brief:** "I prefer N1 in terms of clarity… N1 could make the timeline aspect a bit
> stronger. Make each section heading more distinctive from the rails… tie the headings
> together with a vertical timeline down the left-hand side. Also, add the page milestone
> labels from N3."

**Built** (`prototypes/v3-timeline-spine.html`):

- Phase headings became nodes on a continuous **vertical spine** down the left
  (Painting → Responding → Stability → Page resources, the last a muted node).
- Headings made distinctive — bold sentence-case with a blurb, rule-separated from rails.
- Each rail leads with its **milestone label** ("First paint"), with `FCP · First
  Contentful Paint` as the secondary line. The threshold rail itself stayed intact.

![Timeline spine](../images/v3-timeline-spine.png)

---

## Round 4 — Two facets: device × audit

> **Brief:** "The tabs are a bit lost above the rails panels… be consistent about the tab
> text. Audit type and target device (e.g. 'WebPageTest for Desktop'). Eventually there'll
> be audits for both desktop and mobile. They should have their own averages and specific
> audits."

This reframed the tabs as **two facets** — target device × audit source — each device with
its own average. A flat row would mix facets and crowd.

**Built** (`prototypes/v4-device-audit-tabs.html`):

- A **device segmented control** (Desktop | Mobile, with icons) above **audit folder-tabs**
  (Overall / Lighthouse / WebPageTest) visually *attached* to the panel so they're no
  longer lost.
- Each device computes its own **Overall** average as the default tab.
- The combined "audit-for-device" name ("WebPageTest for Desktop") lives in the bold panel
  caption; the device sits in the segmented control, so tabs stay short.
- Sample Mobile data added to show scaling and how rails read when values aren't all green.

![Mobile, amber rails](../images/v4-mobile-amber.png)

---

## Round 5 — Polish

A sequence of small, concrete refinements:

- **Resource cards.** Page weight / Requests don't have thresholds, so they looked orphaned
  in empty rail tracks. Reformatted as a row of stat cards on a subtle stone fill — later
  given **icons** (a download arrow for weight, an exchange arrow for requests).
- **Score prominence.** The Lighthouse performance score was promoted from a small tab chip
  to a **prominent badge** at the top of the panel (rating-tinted), then **centered and
  shrunk**, and the now-redundant tab chips were removed.
- **Report link-outs.** Confirmed the data carried audit URLs only as a flat
  `performance.tests[]` list, decoupled from each audit. Added a per-audit `reportUrl` and a
  "View full report ↗" link in the caption (the Overall tab lists each contributing report).
- **Label copy.** The bare "Average" tab read as abrupt. Options weighed; **"Overall"**
  chosen (tab: *Overall*; caption: *Overall average for Desktop*).

![Final desktop, Overall tab](../images/v4-desktop-overall.png)

---

## Round 6 — Wiring in

> **Brief:** "Wire it into the template and build_report.py."

The chosen design was ported from prototype to production:

- **Schema** (`audit.json`): `metrics.devices[]` → `metrics.groups[]`, each group a `device`
  with one or more `audits` (`type`, `source`, `perfScore`, `reportUrl`, `items`). The legacy
  `devices[]` shape still works (each becomes a one-audit group).
- **`build_report.py`:** `build_groups()` normalises the data and computes the per-device
  Overall average; `build_metrics_html()` emits the device control, audit tabs, score hero,
  timeline phases, rails and resource cards; the Markdown report and glossary updated to match.
- **`report-template.html`:** the metrics CSS replaced wholesale, interaction JS added
  (segmented control + tabs), plus responsive (rails stack on narrow screens) and print
  (all panels expanded) rules.

![Final wired report](../images/final-wired-report.png)

---

## Method notes

- Every prototype rendered the **real audit data**, not lorem-ipsum — so flaws surfaced
  early (the N2 label collision; the orphaned resource numbers; the frequent lab-INP gap).
- Reused the report's existing design tokens (warm-stone palette) from the first prototype,
  so each round was a fair comparison and the final port needed no recolouring.
- Headless-Chrome screenshots after every change kept the visual review tight.
- The honest weakness of each option was named, not buried — which is what drove the
  selection at each fork.
