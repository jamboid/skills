---
name: draft-document
description: Derives a document's shape from a corpus of existing docs you point it at, proposes an outline for approval, then drafts it in a house style stripped of LLM tells. For project docs, handovers, onboarding notes.
disable-model-invocation: true
---

# draft-document

Writes a document — handover, project overview, onboarding note, decision record — by deriving its shape from a **corpus** the user names, then drafting to the house style in [`STYLE.md`](STYLE.md).

Two things carry the quality: the **corpus profile** (shape borrowed from documents that already work) and the **tells pass** (the style, enforced over the finished draft).

## Workflow

### 1. Take the brief

Get four things before reading anything:

- **The document** — what it is, and what the reader must be able to do after reading it.
- **The reader** — successor, client, contractor, future self. Handovers are written for someone with no context and no access to you.
- **The corpus** — paths to the docs whose shape to borrow. If none are named, ask for them. Never guess a folder.
- **The destination** — output path. Default: alongside the corpus.

Ask for whichever is missing, then continue.

### 2. Build the corpus profile

Read every named doc in full. Record **shape, not content**:

- section sequence, and what each section settles for the reader
- what the opening paragraph does — orients? states status? names the reader?
- heading grammar — noun phrases, questions, imperatives
- resolution — a sentence per point, a paragraph, worked examples
- devices in use — tables, bullets, callouts, code blocks, links, diagrams
- voice — person, tense, formality, and how uncertainty gets written
- typical length, whole document and per section

Write the profile as 10–15 lines and show it to the user with the outline. Where the corpus disagrees with itself, follow the most recent doc and say that you did.

Done when every named doc has been read in full and is represented in the profile.

### 3. Gather the material

Dig until every section has something real behind it. The sources are the repo, `git log`, issues and PRs, existing docs, notes the user supplies, and this conversation.

For a handover, chase all of:

- current state — what runs, where, on what
- in flight — each thread, its next action, and who holds it
- decisions taken and the reasoning that is not visible in the code
- gotchas — the things that bite, the ones no config file confesses
- access and ownership — accounts, keys, domains, vendors, and who to ask
- what you could not establish

Done when every claim you intend to make traces to a source you have read, and everything else sits on the gap list.

### 4. Propose the outline

Give every section its own block:

- **heading** — in the corpus's heading grammar
- **purpose** — one line on what it settles for the reader
- **material** — the specific facts filling it, with their sources
- **gaps** — what is missing and who can answer it

Follow the profile's section sequence where the material fits. Where this document needs a section the corpus has no precedent for, include it and say why. Close with the gathered open questions.

### 5. Wait for approval

The outline is the deliverable of this step. Amend and re-present until the user approves it, then draft.

### 6. Draft

Read [`STYLE.md`](STYLE.md) and write the approved outline out in full, to the destination path.

The reader named in step 1 is the only person the document speaks to. Observations about how that reader will take it go to the user in chat, never into the file.

Write gaps as themselves — `Unknown: staging DB credentials; ask Priya` — never as confident filler.

### 7. Run the tells pass

Search the draft for the tell vocabulary:

```
grep -inE 'delve|leverag|seamless|robust|holistic|elevat|unlock|harness|foster|realm|landscape|tapestry|testament|underscore|showcase|boast|myriad|plethora|game.?chang|cutting.?edge|best.in.class|streamlin|empower|crucial|pivotal|worth noting|at its core|in essence|serves as|plays a .{0,12}role|deep dive|in conclusion|in summary|not just|not only|a number of|various|comprehensive|key takeaway' <file>
```

Fix every hit, then reread the whole draft once against the rules `grep` cannot see: aphorisms, verb-nouns, shredded sentences, bold lead-ins, heading-continuations, hard-wrapped paragraphs, audience asides, fragment lead-ins, dropped verbs, rhythm, wind-up, empty headings, bullet padding, and the anchoring rule. The reread also catches the words too ordinary to search for — `ensure`, `several`, `overall`, `vital` — which the style retires but which read fine often enough to be worth judging in place.

Done when the search comes back clean and every rule in `STYLE.md` has been applied. Report what the pass changed.

## Extending the style

When the user names a new tell, add it to `STYLE.md` in the same form as the rules already there — the positive target first, the tell it replaces second — and extend the `grep` pattern above if the tell is a word rather than a habit.
