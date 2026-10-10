# Submission kit

Everything a directory, marketplace or awesome list asks for, in one place.
Copy from here so every listing says the same thing. When the version, the
template count or the style count changes, update this file first.

Facts checked on 2026-10-09 against letterhead 0.2.0.

## Assets

Regenerate the upload copies in `temp/submission/` (git-ignored) with:

```bash
bash dev-scripts/promo/build-submission.sh
```

| Asset | Path | Use |
|---|---|---|
| Icon, 512×512 PNG | `plugin/icon.png` | every listing icon / logo |
| Social preview, 1280×640 PNG | `examples/screenshots/social-preview.png` | link cards, banner fields |
| Hero, before/after | `temp/submission/screenshots/hero-before-after-light.png` | first screenshot everywhere |
| Status update | `temp/submission/screenshots/status-update--arkona-light.png` | screenshot 2 |
| Brand sheet | `temp/submission/screenshots/brand-sheet--arkona-light.png` | screenshot 3: "learns a brand" |
| Proposal | `temp/submission/screenshots/proposal--halde-light.png` | screenshot 4 |
| Phone view | `temp/submission/screenshots/meeting-notes--fieldwork-mobile.png` | screenshot 5: "reads on a phone" |
| Styles contact sheet | `temp/submission/screenshots/styles-contact-sheet.png` | screenshot 6: the 9 styles |
| Presentation | `temp/submission/screenshots/presentation--bunnyfeelshome-light.png` | optional |
| Plugin archive (OpenAI) | `temp/submission/letterhead-plugin.zip` | `plugin/` without the Cursor manifest |
| Demo video, 56 s, 4.6 MB | `examples/video/letterhead-demo.mp4` | video fields |

The screenshots are PNG copies of the `.webp` files in `examples/screenshots/`
because most upload forms reject WebP.

## Links

| | URL |
|---|---|
| Repository | https://github.com/mperlak/letterhead |
| Gallery (homepage) | https://mperlak.github.io/letterhead/ |
| Demo video | https://github.com/mperlak/letterhead/blob/main/examples/video/letterhead-demo.mp4 |
| Latest release zip | https://github.com/mperlak/letterhead/releases/latest/download/letterhead.zip |
| Skill folder | https://github.com/mperlak/letterhead/tree/main/letterhead |
| Issues (support) | https://github.com/mperlak/letterhead/issues |
| License | MIT, https://github.com/mperlak/letterhead/blob/main/LICENSE |
| Author | Marcin Perlak, https://github.com/mperlak |

## Copy

**Name:** letterhead (always lowercase)

**Category:** Productivity. Second choice where a list has it: Documents /
Writing, then Design.

**Keywords:** documents, html, brand, branding, reports, proposals,
status-update, specs, design-tokens, review, meeting-notes, presentation

**Up to 10 words** (VoltAgent):
> Learns a brand from a website, writes branded HTML documents

**Up to 60 characters:**
> Branded documents from your agent

**Tagline:**
> Your agent writes the document. letterhead puts it on your client's letterhead.

**Up to 150 characters** (karanb192 and other single-row tables):
> Learns a client's brand from their website once, then writes proposals, status updates, plans and specs as branded HTML documents.

**Up to 300 characters:**
> An agent skill that turns notes, a repo or a conversation into one HTML
> document for someone outside your team: a proposal, status update, plan,
> spec or report. It learns a brand from a website once and puts every
> document on it. Works in Claude, Codex, Cursor and other agents.

**Long description:**
> letterhead turns notes, a repo or a conversation into a self-contained HTML
> document for someone outside your team: a proposal, a status update, an
> implementation plan, a spec, a report, meeting notes, or a presentation of a
> project from a folder of pictures.
>
> Point it at a website once and it reads the brand's colors, fonts and logo,
> shows you a one-page brand sheet to confirm, and puts every later document
> on that brand. Keep one profile per client. With no brand to learn, pick one
> of 9 built-in styles chosen by who reads the document.
>
> Before writing any HTML it shows you the template, the sections and the
> first phone screen, and waits for your yes. Every document has light and
> dark themes, reads well on a phone, prints cleanly and keeps stable section
> ids, so comments survive the next version. 13 templates: proposal, status
> update, implementation plan, spec, report, audit, meeting notes, project
> recap, release notes, checklist, postmortem, change walkthrough and
> presentation.
>
> Works in Claude (app, Cowork and Claude Code), Codex, Cursor, OpenCode and
> any other host that reads Agent Skills. MIT licensed.

**Example prompts** (forms and lists that ask for usage):

```text
learn the brand of https://arkona.example, it's my client
make a status update for Arkona from NOTES.md
polish status-update.html
```

## Answers for review forms

Use these for "what does it access", "data handling" and "requirements"
questions. They match `plugin/README.md`.

- **Components:** one skill. No MCP server, no hooks, no commands, no agents,
  no settings.
- **Requirements:** code execution and Node.js. No npm install, no account,
  no API key.
- **Telemetry:** none.
- **Network:** only when the user asks for it. Teaching a brand from a URL
  reads that website (the page, its stylesheets and the logo) and downloads
  the brand's fonts from Google Fonts. Product cards in a presentation read
  the shop pages the user links. With a brand book PDF or font files instead
  of a URL, nothing leaves the machine. Writing and checking a document needs
  no network.
- **Files:** reads the notes or files the user points at; writes the HTML
  document and a brand profile in `.letterhead/` in the project.
- **Commercial disclosure:** the optional `publish` command uploads a
  document to Markloop, a paid review service from the same author. It needs
  a Markloop account and its connector. Everything else works without it.
  State this wherever a form or a list asks about paid services. Never
  describe letterhead as needing Markloop.
- **Claude app note:** the claude.ai sandbox may not reach the internet. If
  teaching from a URL fails there, the user gives the brand book PDF or a
  saved copy of the page.

## Install lines

| Host | Install |
|---|---|
| Claude app, Cowork | upload `letterhead.zip` in Settings → Capabilities → Skills |
| Claude Code | `/plugin marketplace add mperlak/letterhead` then `/plugin install letterhead@letterhead` |
| Codex | `codex plugin marketplace add mperlak/letterhead` then `codex plugin add letterhead@letterhead` |
| Cursor, OpenCode, others | `npx skills add mperlak/letterhead` |

Prefer `npx skills add mperlak/letterhead` in posts and lists that are not
about one host: every install counts toward the skills.sh ranking.

## Ready-made list entries

Each list has its own format. Paste the matching line into the right category,
at the end of the section unless the list sorts alphabetically.

travisvn/awesome-claude-skills:
```markdown
- **[letterhead](https://github.com/mperlak/letterhead)** - Learns a client's brand from their website once, then writes proposals, status updates, plans and specs as branded HTML documents.
```

VoltAgent/awesome-agent-skills (Community Skills → Productivity and Collaboration):
```markdown
- **[mperlak/letterhead](https://github.com/mperlak/letterhead/tree/main/letterhead)** - Learns a brand from a website, writes branded HTML documents
```

karanb192/awesome-claude-skills (one table row):
```markdown
| [letterhead](https://github.com/mperlak/letterhead/tree/main/letterhead) | Learns a client's brand from their website once, then writes proposals, status updates, plans and specs as branded HTML documents. |
```

PR title: `Add letterhead`. PR body: the 300-character description, a link to
the gallery, and the commercial disclosure sentence.

## Where to submit

Ordered by what each place requires. Submit the first group now; the second
group rejects new repositories, so wait until the gate is met.

### Now

**Anthropic's directory** (claude.ai, Cowork, and Claude Code through account
sync)
1. Needs a paid claude.ai plan.
2. Run `claude plugin validate plugin --strict` and go through the
   [pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist#run-the-checks-before-you-submit).
3. Submit at https://claude.ai/directory/manage, pointing at this repository
   and the `plugin/` folder ([walkthrough](https://claude.com/docs/plugins/submit#submit-a-plugin)).
4. The listing text is `plugin/README.md`; the icon is `plugin/icon.png`.

`claude-plugins-official` takes no submissions from the portal; it is for
Anthropic partners.

**OpenAI Codex plugin directory**
1. Needs identity verification (individual or business) and Apps Management
   write access in the OpenAI organization that will own the plugin.
2. At https://platform.openai.com/plugins choose Create plugin → Skills only
   and upload `temp/submission/letterhead-plugin.zip`.
3. Compare the generated `.codex-plugin/plugin.json` with ours in
   `.codex-plugin/plugin.json` and copy over `interface` (display name,
   short and long description, category Productivity).
4. Fix every scan result, then submit. Expect questions about `publish`
   (an external paid service): answer with the commercial disclosure.

**Cursor Marketplace**
1. Manifests: `.cursor-plugin/marketplace.json` points at `plugin/`, which
   holds `.cursor-plugin/plugin.json`. Validate with the script from
   [cursor/plugin-template](https://github.com/cursor/plugin-template)
   (`scripts/validate-template.mjs`, run from the repository root).
2. Submit the repository URL at https://cursor.com/marketplace/publish.
   Every plugin is reviewed by hand and must be open source.
3. Once listed, add a Cursor line to the README install section.

**Skills Directory**: sign in with GitHub at https://www.skillsdirectory.com
and submit the repository.

**AgenticSkills.io**: "Submit a Skill" at https://agenticskills.io/skills.

**karanb192/awesome-claude-skills**: PR with the table row above. Stars
help but are not a hard rule.

### Indexed automatically (nothing to submit)

- **skills.sh**: https://skills.sh/mperlak/letterhead/letterhead. There is
  no form: a skill gets its page after the first `npx skills add` install
  that sends telemetry (one with `SKILLS_NO_TELEMETRY=1` does not count),
  and installs drive the ranking. Search (Algolia) catches up later than the
  page. A missing skill answers HTTP 200 with "isn't available in this
  repository", so check the page text, not the status code.
  `npx skills add mperlak/letterhead --list` shows what the CLI parses.
- **SkillsMP, claudemarketplaces.com, ClaudeSkills.info**: crawl GitHub. The
  repository topics already cover `agent-skills`, `claude-skills`,
  `codex-skills` and `claude-code-plugin`. If letterhead is missing after a
  few weeks, use the site's feedback form.

### Later, after traction

| List | Gate | How |
|---|---|---|
| travisvn/awesome-claude-skills (15k ★) | "social proof": a number of GitHub stars; no SaaS funnels | PR |
| VoltAgent/awesome-agent-skills (35k ★) | "real community usage"; brand-new skills are not accepted | PR |
| hesreallyhim/awesome-claude-code (55k ★) | 100 stars; only the web issue form, written by a human, never a PR | [issue form](https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml) |
| ComposioHQ/awesome-claude-skills (77k ★) | wants the skill folder copied into their repo, which would then go stale | skip unless they accept a link-only entry |

### Not a fit

- Agensi: a paid marketplace through Stripe; letterhead is free.
- block/agent-skills: archived on 2026-09-25.
- Smithery, PulseMCP, mcp.run: MCP server directories; letterhead has no
  MCP server.
- GitHub Marketplace: Copilot extensions only.

## Tracking

| Directory | Submitted | Status | Listing URL |
|---|---|---|---|
| Anthropic directory | | | |
| OpenAI Codex directory | | | |
| Cursor Marketplace | | | |
| Skills Directory | | | |
| AgenticSkills.io | | | |
| karanb192/awesome-claude-skills | | | |
| skills.sh | first install 2026-10-09 | page live, search pending | https://skills.sh/mperlak/letterhead/letterhead |
| SkillsMP | automatic | check | |
| claudemarketplaces.com | automatic | not found on 2026-10-09 | |

On every version bump: the Anthropic and OpenAI listings need a new version
submitted, Cursor reviews each update, and the Claude Code and Codex
marketplaces pick it up from the repository.
