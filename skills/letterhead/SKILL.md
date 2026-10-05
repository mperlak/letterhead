---
name: letterhead
version: 0.1.0
license: MIT
user-invocable: true
argument-hint: "[teach | polish | publish] [<topic-or-path>]"
allowed-tools:
  - Bash(node $SKILL_DIR/scripts/check-document.mjs*)
  - Bash(node $SKILL_DIR/scripts/check-tokens.mjs*)
  - Bash(node $SKILL_DIR/scripts/brand-evidence.mjs*)
  - Bash(node $SKILL_DIR/scripts/brand-tokens.mjs*)
  - Bash(node $SKILL_DIR/scripts/brand-sheet.mjs*)
  - Bash(node $SKILL_DIR/scripts/apply-tokens.mjs*)
  - Bash(node $SKILL_DIR/scripts/prepare-images.mjs*)
  - Bash(node $SKILL_DIR/scripts/product-cards.mjs*)
  - Bash(node $SKILL_DIR/scripts/build-presentation.mjs*)
  - Bash(node */letterhead/scripts/check-document.mjs*)
  - Bash(node */letterhead/scripts/check-tokens.mjs*)
  - Bash(node */letterhead/scripts/brand-evidence.mjs*)
  - Bash(node */letterhead/scripts/brand-tokens.mjs*)
  - Bash(node */letterhead/scripts/brand-sheet.mjs*)
  - Bash(node */letterhead/scripts/apply-tokens.mjs*)
  - Bash(node */letterhead/scripts/prepare-images.mjs*)
  - Bash(node */letterhead/scripts/product-cards.mjs*)
  - Bash(node */letterhead/scripts/build-presentation.mjs*)
description: >
  Generate branded HTML documents that go to a real reader: specs, plans,
  reports, proposals, status updates. Loads on creation intents ("create a
  plan", "write this up as a document", "make me a status update", "draft a
  spec for review", "generate an HTML report", "turn these notes into a
  doc", "prepare a project recap") and brand intents ("use my brand", "make
  this look like our company", "on our letterhead", "in their brand",
  "match our colors", "polish this document", "learn this brand", "brand
  sheet", "what does their brand look like"). Learns a brand once, yours or
  one you point it at, then puts every document on it, ready for comments
  and the next version.
---

# letterhead — your agent's work, on your letterhead

Generate self-contained HTML documents for a human recipient: a client, a
boss, a team. Each document is composed from a template contract in
`templates/*/template.md` against brand tokens from a taught profile in
`.letterhead/` (or a style the user confirms), and follows review-ready
conventions so feedback tools can anchor comments that survive new versions.
One template, `presentation` (a project shown picture by picture, room by
room), is assembled by scripts instead of written by hand; its
`template.md` carries the procedure.

What makes a letterhead document different from a generic pretty page:

1. **It carries a brand.** Yours by default, or any brand you point it at:
   a client's, a partner's, a business unit's. Each brand keeps its own
   profile, so documents come out in that brand's identity rather than in
   one house look. See Brand precedence below.
2. **It is ready for comments.** Stable section ids, an extractable title,
   labeled metadata. Documents are made to collect feedback, not just to be
   looked at. See the Review-ready contract below.
3. **It gets published, commented on, and updated at the same link.**
   `publish` sends the document to Markloop, which turns it into one link
   people can comment on. Your team or clients open that link and comment on
   the exact line. The agent pulls the comments and publishes the next
   version at the same link.

## Commands

In the commands in this skill, `<skill>` is the directory that holds this
`SKILL.md` (for example `.claude/skills/letterhead` in Claude Code or
`.agents/skills/letterhead` in Codex), and every script runs from the project
directory.

`/letterhead` invokes the skill. The argument decides what happens.

**Default (no command word):** `/letterhead <topic-or-path>` creates a new
document. The agent picks a template, resolves the brand, proposes a shape,
and only writes HTML after the user says yes. Procedure: `reference/create.md`.

| Command | Argument | What it does | Reference |
|---|---|---|---|
| `teach` | none, a brand name, and/or evidence: URL, PDF, HTML files | Build a brand profile from evidence, each field carrying its source and confidence, then generate a brand sheet: the first thing you publish, before the first document, so whoever owns the brand can comment on what is not theirs. Writes `.letterhead/brand/` (the default brand) or `.letterhead/brands/<slug>/`. | `reference/teach.md` |
| `polish` | `<path>` | Quality pass on an existing document. Targeted diff, not a rewrite. | `reference/create.md` (build steps apply) |
| `publish` | `<path>` | Publish the document to Markloop so people can comment on it. | `reference/publish.md` |

## Routing

1. **No argument:** show the Commands table as a menu and ask what the user
   wants to do.
2. **First word is a command** (`teach`, `polish`, `publish`): load its
   reference file before doing anything else. The table row alone is not the
   procedure. Everything after the command word is the target.
3. **Anything else:** the whole argument is the topic. Load
   `reference/create.md` and run the creation flow.

## Shape gate

Before writing a line of HTML, present the plan and wait for the user's yes:

- which template, and why
- which brand profile or style anchors the look
- the section list, in reading order
- how the first two phone screens read

The yes must come from the user. The agent restating its own plan and
proceeding does not count. If the user already supplied a confirmed brief,
say so and go. Details: `reference/create.md`.

## Absolute bans

Match and refuse. These patterns read as machine output, and a document that
reads as machine output undermines the person who sends it. No brand
declaration excuses them.

1. **Gradient-filled text** on headings or key numbers. Use a solid color
   and weight.
2. **An icon tile in front of every heading.** Headings carry themselves.
3. **The three-card grid** of icon + short heading + one paragraph. Use
   prose, a list, or a real table.
4. **The purple-plus-cyan default stack.** A single purple brand hue is
   fine; the cross-hue AI-startup combo is not.
5. **Footers that break character:** "Generated by AI", "Hope this helps",
   any signature from the model. A footer carries metadata or does not
   exist.
6. **Lorem ipsum or placeholder content.** If the source lacks a fact,
   ask or mark it as an open question. Never fake it.
7. **The imperative tricolon** ("Ship faster. Decide sooner. Win more.").
   Say one specific thing instead.

## Review-ready contract

Every document, every template. Feedback tools anchor comments to the
document's structure; these rules keep those anchors alive across versions.

1. **Stable, content-derived ids on every `h2` and `h3`.** The id is a slug
   of the heading text ("Error handling and retries" →
   `id="error-handling-and-retries"`). When a new version of the document is
   generated, unchanged sections keep their ids exactly. Never derive ids
   from position (`section-3`), because inserting a section renumbers
   everything and orphans every comment.
2. **Labeled metadata at the title, in the reading flow.** Date, owner,
   status, audience as labeled fields ("Status: draft for comments"), not
   anonymous chips, not a side rail.
3. **A real `<title>`** taken from the document's content. Commenting tools
   display it as the document's name.
4. **"Open questions / decisions needed" is an optional pattern.** Use the
   section when the document genuinely has decision points for the reader.
   Never pad a document with it to look thorough.

`scripts/check-document.mjs` verifies 1–3 mechanically, together with the
bans a script can see (template leftovers, draft markers, assistant
residue), contrast, and the light/dark theme contract. Run it before
delivering; it exits non-zero on errors.

## Brand precedence

When sources disagree, higher wins:

1. **A named brand the user pointed at** (`.letterhead/brands/<slug>/`).
   "For Acme" means Acme's tokens, fonts, and voice, not the default
   brand's. If Acme has no profile, stop before the shape gate. Do not
   fall back to the default brand or the nearest profile: a document for
   Acme in your house brand reads as yours, and Acme sees it first. Offer
   two ways on: `/letterhead teach acme` now, or a style chosen by
   recipient (point 4), named as such in the shape gate.
2. **The default brand** (`.letterhead/brand/`), used when no name is given.
3. **Repo guidance:** CLAUDE.md / AGENTS.md / README naming fonts, colors,
   or anti-references; token files they point to.
4. **No profile at all:** propose a style by recipient (who receives this
   document) and let the user confirm it in the shape gate. There is no
   random seed. A palette invented from the topic is a brand nobody agreed
   to, and it ships looking like a decision.

**Brand against style.** A style is complete on its own: colors, fonts,
composition, register. A brand profile overrides the style's colors, fonts,
voice, and logo. A filled `Composition` section in the profile also
overrides the style's composition; an empty one leaves composition to the
style, because a brand nobody measured should not dictate layout. The user
may say "ignore the brand" for one document; record that choice in the
shape gate and as an HTML comment in the file, so the next person to open
it does not read an off-brand document as a mistake.

Named fonts and colors in a profile are binding. If the profile says
Manrope, the CSS stack leads with Manrope; a generic sans in front of it is
a violation. When no profile exists, nudge the user once toward
`/letterhead teach`.

## Universal laws

1. **Brand and voice beat any single rule.** A finding that contradicts the
   resolved brand is a category error.
2. **Iteration is a diff, not a regeneration.** `polish` returns targeted
   edits. Regenerating shuffles heading ids and kills comment anchors,
   which is exactly what this skill exists to prevent.
3. **Accessibility and contrast are ship-blockers.** Taste is negotiable;
   a reader who cannot read the document is not.
4. **Passing the checks is not a good document.** The scripts catch what
   a pattern can catch. Judgment covers the rest.
5. **Mobile reading is the real reading.** The recipient opens the link on
   a phone. The first two phone screens must deliver title, thesis, and
   metadata as a composed state, not desktop chrome stacked.
6. **A document needs a shape of its own.** A document can pass every check and still have
   no point of view. Every style carries **signature moves** in its
   `DESIGN.md` — named composition patterns (a masthead, a numbered spine, a
   cover line) that make a document recognizable beyond its palette. A
   document that uses only the tokens and a generic layout has skipped the
   composition; instantiate at least one signature move the content earns.
   Tokens are the paint, the signature move is what you build with it.
7. **The profile changes only through `teach`.** `polish` and `create`
   never write to `.letterhead/brand/` or `.letterhead/brands/<x>/` as a
   side effect. A one-off color choice that quietly becomes the brand
   shows up on every later document, and nobody remembers agreeing to it.
8. **Never modify the skill's own files.** Scripts, templates, styles and
   references stay as shipped, even when a script lacks something the user
   needs. Say so, name the gap, and do what the document itself allows
   (document-level CSS, for example): a patched script is lost on the next
   update, and the documents it made cannot be made again.
