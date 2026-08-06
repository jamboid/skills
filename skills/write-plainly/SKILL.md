---
name: write-plainly
description: Puts prose into a house style — every claim anchored to something checkable, and the phrasings that mark text as machine-written replaced. Drafts new text to it, or edits existing text into it.
disable-model-invocation: true
---

# write-plainly

Puts prose a person will read — a doc, a README, a report, an email, a section of a draft — into the house style in [`STYLE.md`](STYLE.md).

Two moves carry it. **Anchor**: every claim points at something checkable — a file, a command, a date, a person, a number. **Strip the tells**: the phrasings that mark text as machine-written, each replaced in `STYLE.md` by the thing to write instead.

## Workflow

### 1. Fix the text and the reader

Name the text — a file path, or the passage in this conversation — and name the reader: successor, client, contractor, future self. The reader decides how much anchoring a sentence needs, and which sentences are asides about an audience standing outside the document.

Ask for whichever is missing, then continue.

### 2. Write, or read

Read [`STYLE.md`](STYLE.md) in full. Then either write the new text to the style, or read the existing text end to end before changing a line of it.

Anchor from the source, never from invention. Where a rule wants a name, a date or a number the material does not carry, ask the user for it, or write the gap as itself — `Unknown: who owns the Cloudflare account; ask Dan`. A gap left visible is useful; a gap smoothed into confident prose is a trap for the reader.

Change the lines the rules reach and leave the rest. A sentence already in the style is finished work.

### 3. Search for the tell vocabulary

```
grep -inE 'delve|leverag|seamless|robust|holistic|elevat|unlock|harness|foster|realm|landscape|tapestry|testament|underscore|showcase|boast|myriad|plethora|game.?chang|cutting.?edge|best.in.class|streamlin|empower|crucial|pivotal|worth noting|at its core|in essence|serves as|plays a .{0,12}role|deep dive|in conclusion|in summary|not just|not only|a number of|various|comprehensive|key takeaway' <file>
```

Fix every hit. Where the text lives in this conversation rather than in a file, check it against the vocabulary list at the end of `STYLE.md` by reading.

Done when the search returns no hits.

### 4. Reread for the habits the search cannot see

Read the whole text again, against the rules no pattern catches: the **aphorism**, the **denial triad**, the **reflexive triad**, the **antithesis tic**, the **verb-noun**, the **shredded sentence**, the **bold lead-in**, the **heading-continuation**, the **fragment lead-in**, the **dropped copula**, the **wind-up**, the **padded list**, the **empty heading**, the **audience aside**, hard-wrapped paragraphs, sentence rhythm, and the anchoring rules.

This pass also catches the words too ordinary to search for — `ensure`, `several`, `overall`, `vital` — which the style retires but which read fine often enough to be worth judging in place.

Done when every rule in `STYLE.md` has been applied to every paragraph.

### 5. Report what changed

In chat, not in the file: what the two passes changed, and anything you could not anchor, as a question back to the user.

## Extending the style

When the user names a new tell, add it to `STYLE.md` in the form the rules already take — the positive target first, the tell it retires second, so the rule reads as a thing to write rather than a thing to avoid. Give the tell a bold name where it is a habit, and extend the search pattern in step 3 where it is a word.
