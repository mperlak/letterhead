# letterhead

Your AI agent learns any brand from a website once, yours or a client's, then
writes every document in it.

letterhead turns notes, a repo or a conversation into one HTML file for
someone outside your team: a proposal, a status update, an implementation
plan, a spec, a report, meeting notes, or a presentation of a project from a
folder of pictures. The file comes out in the brand you taught it, reads well
on a phone, has light and dark themes and prints cleanly.

## How to use it

Talk to Claude the way you would talk to a colleague. The skill loads on its
own when you ask for a document or mention a brand.

```text
learn the brand of https://arkona.example, it's my client
make a status update for Arkona from NOTES.md
polish status-update.html
```

1. **Brand, about two minutes.** Claude reads the site, proposes the colors,
   fonts and logo it found, and waits for your yes. Then it shows a one-page
   brand sheet. You can also give it a brand book PDF or font files. Each
   brand is saved as a profile you can reuse.
2. **Document.** Before writing anything, Claude shows the plan: template,
   brand, sections and what the first phone screen says. You say yes or change
   it.
3. **Done.** One `.html` file that opens offline in any browser. Send it as a
   file, print it to PDF, or publish it as a link people can comment on.

There are 13 templates (proposal, status update, implementation plan, spec,
report, audit, meeting notes, project recap, release notes, checklist,
postmortem, change walkthrough, presentation) and 9 built-in styles for
documents with no brand to learn.

## What runs, and what leaves your machine

The skill is a set of instructions plus Node.js scripts that Claude runs where
it runs code: no npm install, no telemetry, no account. Your notes and the
document go to the model you are using, as with anything you ask Claude.
Beyond that, three things use the network, and only when you ask for them:

- **Learning a brand** reads the website you give it (the page, its
  stylesheets and the logo) and downloads the brand's fonts from Google Fonts
  so they can be embedded in the document. With a brand book PDF or font
  files instead, it stays offline.
- **Product cards** in a presentation read the shop pages you link and
  download the product photos.
- **Publishing** uploads the document to [Markloop](https://markloop.io), a
  paid review service from the author of this plugin. It needs a Markloop
  account and its connector, and it is optional: without it you send the file
  yourself.

Writing and checking a document needs no network at all.

## More

- Example documents and every style: https://mperlak.github.io/letterhead/
- Source, other agents (Codex, Cursor) and the full guide:
  https://github.com/mperlak/letterhead
- License: MIT (see `LICENSE`). Bundled fonts are under the SIL Open Font
  License; bundled libraries are listed in `skills/letterhead/NOTICES.md`.
