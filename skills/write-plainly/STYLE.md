# House style

The rules branch of [`write-plainly`](SKILL.md), read before writing and applied again in the two passes over the finished text. Every rule governs prose a human will read — a person is the target, not another agent.

Two moves carry it. **Anchor** — every claim points at something checkable: a file, a command, a date, a person, a number. **Strip the tells** — the phrasings that mark text as machine-written, each replaced below by the thing to write instead.

Each rule is a target first, then the tell it retires.

## Anchoring

- **Name the thing.** `deploy.sh`, `main`, Priya, 14 March, £2,400, three environments. Replaces: "the relevant script", "the appropriate branch", "the stakeholder".
- **Say the number.** Count them and write the count. Replaces: several, various, a number of, multiple, numerous, myriad, plethora.
- **State it, or state the doubt with its reason.** "The cron runs at 02:00" or "The cron runs nightly — exact time unverified, check `crontab -l` on web-01". Replaces: may potentially, generally tends to, it is possible that.
- **Write unknowns as unknowns.** `Unknown: who owns the Cloudflare account; ask Dan.` A gap left visible is useful; a gap smoothed into confident prose is a trap for the reader.
- **Point at the source of truth instead of copying it.** Link the runbook, name the config file. Copy only what the reader cannot find by looking — the unwritten convention, the reason behind a choice, the gotcha.

## Structure

- **Give a label its own line.** A point that needs a label gets a heading with a paragraph under it; a point that does not gets a list item written as a full sentence. Replaces the **bold lead-in** — "**Corpus profile.** Read every doc in full" — one sentence asked to serve as both a heading and its own body. Bold marks a term where it is defined, and the sentence around it stays regular weight.
- **Give the paragraph its own subject.** A section body reads as a sentence in its own right rather than completing the heading above it. Replaces the **heading-continuation** — "Add role tags" followed by "Worth doing on any file you expect to work with repeatedly", or "Write component descriptions" followed by "They're free context". A close relative of the bold lead-in: both ask a heading to do grammatical work belonging in the sentence.
- **Open on the fact.** First sentence carries information: what this is, what state it is in, what the reader does with it. Replaces the **wind-up** — "In today's fast-paced landscape", "This document aims to provide", "Before we dive in".
- **End on the last real point.** Replaces: In conclusion, In summary, Overall, To wrap up, Key takeaways restating the body.
- **Headings name what the section settles.** "Deploying to staging", "Who owns what". Replaces the **empty heading** — Overview, Introduction, Key considerations, Final thoughts, Conclusion.
- **Bullets carry facts their heading does not.** Replaces the **padded list** — bullets restating the heading, or three items where the content has two.
- **Bullets earn their line breaks.** A list item carries a statement worth reading on its own line. Anything shorter than a clause belongs in a sentence with commas: "The pipeline runs on push, on tag, and nightly" rather than three bullets reading "on push", "on tag", "nightly". Replaces the **shredded sentence** — one sentence chopped across a list, where the reader reassembles it to get the meaning back.
- **One paragraph, one line.** A paragraph occupies a single line of the source and the editor wraps it for display. Replaces hard-wrapping to a column width, which reflows the whole block after a one-word edit and buries the change in the diff.
- **Tables for real matrices only** — two axes with values at the crossings. One-dimensional lists are lists.
- **Prose for reasoning, lists for enumerable things.** A wall of bullets hides the argument; a wall of prose hides the checklist.

## Sentences

- **Lead into a list with a complete sentence.** The clause before the colon has a subject and a verb, and says what the list contains: "Three things make it cheap:". Replaces the **fragment lead-in** — "Part of why it's so cheap:", "The kind of thing it can find:", "Design calls worth flagging:".
- **Keep the verb.** "Every fill and every stroke in the file **is** compared against the official palette." Replaces the **dropped copula** — a participle left doing a main verb's job, and the headline-grammar clipping that comes with it.
- **Explain rather than epigram.** A lede says what the thing is, where it shows up in this codebase, and what changes because of it — concrete subjects, full sentences, addressed to a reader who wants to use the information. Replaces the **aphorism**: balanced abstract pairs ("A function declares what it needs, and the caller provides it") and the verbless flourish that follows them ("A small change in style, big consequences for how a codebase is structured and tested"). The tell is a sentence that sounds quotable, reads as a thought rather than writing, and gives the reader nothing to act on. Written out: "Dependency injection means a function takes its collaborators as arguments instead of importing them itself. Every service in `src/services/` is built this way, which is why the test suite runs without a database."
- **Use the number of items the content has.** Replaces the **reflexive triad** — "clear, concise, and consistent", "robust, scalable, and maintainable".
- **Say what it needs, and name the one absence that surprises.** "Setup runs in Claude Desktop and a browser, without touching a terminal" carries what the reader needs. Replaces the **denial triad** — three parallel negations lined up for rhythm: "No terminal, no config files, no developer mode", "no code, no meetings, no waiting". The rhythm is what gives it away as a slogan, and the third item is almost always there for the cadence rather than the reader.
- **State the thing once.** Replaces the **antithesis tic**: "not just X, but Y", "not only X — it's also Y", "It's not about X. It's about Y."
- **Vary the length.** Short sentence after a long one. The tell is uniform 15–20 word sentences, paragraph after paragraph, each built the same way.
- **Write to the reader, never about them.** Every sentence addresses the reader named in step 1. Anything about how that reader will receive the text belongs in the conversation with whoever commissioned it. Replaces the **audience aside** — "this is the win that will sell the approach", "the client will appreciate the transparency here". The tell is a sentence that only makes sense if the reader is standing outside the document looking at it.
- **Use the noun the activity already has.** Review, analysis, request, decision, spending. Replaces the **verb-noun** — a verb pressed into service as a noun where a real one exists: "the read earns its place", "the ask", "a big spend", "key learnings". Technically correct and still a small stumble for the reader.
- **Verbs that do the work**: check, run, deploy, ask, delete, own. Replaces: ensure, facilitate, utilise, leverage, enable, drive, deliver (as filler).
- **Plain adjectives, or none.** Replaces: robust, seamless, comprehensive, holistic, cutting-edge, best-in-class, game-changing, powerful, rich.
- **Let importance show in placement, not in adjectives.** Replaces: crucial, pivotal, vital, essential, critical (when nothing breaks), "it's worth noting that", "importantly".
- **Cut the meta-sentence, keep reader-orientation.** A sentence about the document rather than its subject earns its place when it orients the reader — flagging that a point runs against instinct, warning that the next step is the one people get wrong, or saying where something lives. Keeps: "This next part runs against instinct", "The full list is in the appendix". Replaces: "This section covers…", "As mentioned above…", "Let's take a deep dive into…", "it's worth understanding why".
- **Second person and the imperative for instructions** — "Run `npm ci`, then check the logs". Past tense for what happened, present tense for what is true now.

## Vocabulary to retire

delve, leverage, seamless, robust, holistic, elevate, unlock, harness, foster, realm, landscape, tapestry, testament, underscore, showcase, lever, boast, myriad, plethora, streamline, empower, navigate (as metaphor), embark, journey, ecosystem (unless literal), at its core, in essence, serves as, plays a key role, deep dive, game-changer, cutting-edge, best-in-class, it's worth noting, needless to say, load-bearing, one that bites.
