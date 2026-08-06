# Parked: draft a document from a corpus

Parked 6 August 2026, never merged to `main`. This was the other half of the `draft-document` skill: derive a document's shape from a corpus of docs the user names, get an outline approved, then draft it. The language half of that skill became [`write-plainly`](../../skills/write-plainly/SKILL.md); this half went untested and was dropped rather than shipped.

Kept here in case it is worth rebuilding. Anything rebuilt from it should call `write-plainly` for the language pass rather than carry its own copy of the style.

## Why it was parked

The corpus-profile step was never run against a real corpus, so nothing here is known to work. The two halves also had different reach — the style applies to any prose, while this applies only when you already hold a set of documents whose shape is worth borrowing.

## The workflow, as it stood

### 1. Take the brief

Get four things before reading anything:

- **The document** — what it is, and what the reader must be able to do after reading it.
- **The reader** — successor, client, contractor, future self. Handovers are written for someone with no context and no access to you.
- **The corpus** — paths to the docs whose shape to borrow. If none are named, ask for them. Never guess a folder.
- **The destination** — output path. Default: alongside the corpus.

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

Write the approved outline out in full, to the destination path, in the `write-plainly` style.

The reader named in step 1 is the only person the document speaks to. Observations about how that reader will take it go to the user in chat, never into the file.

## Handover-specific rules

These lived in the style file and only apply to handovers, so they belong with this workflow rather than with a general writing style:

- **Date it and sign it.** Who wrote it, when, and what the state was as of that date.
- **Every in-flight thread gets its next action.** "PR #212 open, awaiting review from Sam" beats "work is ongoing on the checkout refactor".
- **Name a person for every dependency** — vendor, account, approval. Where nobody owns it, write that: `No owner. Renewal 3 Feb.`
- **Write the failure modes.** What has broken before, what it looked like, what fixed it.
