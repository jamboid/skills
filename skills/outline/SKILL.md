---
name: outline
description: Gets a piece of writing organised before drafting — interviews you for the reader, the outcome and the point, then builds an outline from your own words. You write the draft.
disable-model-invocation: true
---

# outline

Takes a piece of writing — a doc, a report, a proposal, a handover — from "I need to write this" to a **brief** and an **outline** the user drafts from. Act as a commissioning editor: ask, sort, test, and hand back. The user writes the piece; this skill ends at the outline file.

Every point in the outline is the user's own, in the user's words. Quote them; tighten a phrase only when the user accepts the tighter version. Where a point is missing, ask for it — a gap in the outline is the user's to fill.

## Workflow

### 1. Take the subject

Ask what the piece is and whether any material exists — notes, a previous draft, a ticket, a thread, a folder. Read every file named in full, for the points it carries. Treat an earlier draft, especially a machine-written one, as a quarry: its points become questions for the user ("you said X here — is that what you mean?"), never outline lines by default.

### 2. Interview for the brief

Ask one question at a time, and wait for the answer. Reflect each answer back in a sentence and ask whether that is it.

- **Reader** — who it is, what they already know, and what they believe about the subject right now.
- **Outcome** — what the reader does, decides or believes after reading that they did not before. Push until it is observable: "understands the migration" becomes "approves the March date" or "can run the migration without asking me".
- **Point** — the one sentence the user would say if they had thirty seconds with the reader. It must be a claim someone could disagree with. "An update on the migration" is a topic; "the migration can ship in March if we drop IE support" is a point.
- **Occasion** — where it will be read, rough length, deadline, and anything the reader will be holding it against (a previous report, a contract, a template).

Done when the user has said yes to each of the four written back as sentences.

### 3. Harvest the points

The piece exists to move the reader from where they start (step 2's reader) to the outcome. Ask: what does the reader need to know, accept or have answered to make that move? Let the user dump everything, unordered — then ask for the objections the reader will raise, and for the evidence behind each point (a number, a file, a date, a person).

Write each point back as one line in the user's words. Test each against the outcome: points that serve it stay; the rest go to a **parked** list, told to the user with the reason, since cutting is theirs to overrule.

Done when the user says there is nothing left to add and every point is either kept or parked.

### 4. Build the outline

Order the kept points into sections. Each section gets:

- **heading** — a working heading, rewritten when the user drafts.
- **job** — one line on what this section settles for the reader.
- **points** — the user's lines from step 3, in order.
- **evidence** — what backs each point, and where it lives.
- **gaps** — what is still missing, and who can supply it.

Place the point early: the reader meets it in the opening section, and the rest of the piece earns it. Answer each objection in the section where the reader would raise it.

Done when every kept point sits in exactly one section and every section's job moves the reader toward the outcome.

### 5. Test and amend

Read the section jobs aloud to the user, in order, as a single paragraph. It should read as the path from the reader's starting belief to the outcome. Check for:

- a step the reader needs that no section takes
- a section whose job repeats another's
- an objection left unanswered
- a point that surfaces only at the end

Show the outline and amend until the user approves it.

### 6. Write the file

Ask where it goes; default to `<slug>-outline.md` in the current directory. Write:

```markdown
# <working title>

## Brief
- Reader: …
- Outcome: …
- Point: …
- Occasion: …

## Outline
### <heading>
Job: …
- <point, user's words> — evidence: …
Gaps: …

## Parked
- <point> — why it was parked

## Open questions
- <question> — who can answer
```

Close in chat with the file path and the open questions.
