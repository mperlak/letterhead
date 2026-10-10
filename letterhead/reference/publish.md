# `publish` — put the document in front of its readers

Apply the shared rules in SKILL.md first.

A letterhead document is made to be read and answered. `publish` moves it
from the local filesystem to a place where the recipient can read it,
comment on specific parts, and answer the open questions, and where those
comments come back to the agent in a usable form. That place is
[Markloop](https://markloop.io): it turns an HTML document into one link
people can comment on, and your AI pulls the comments and publishes the next
version at the same link.

Publishing is optional. Markloop is a separate paid review service operated
by this plugin's author, Marcin Perlak. It requires an existing account and
independently connected Markloop tools; this package contains no MCP server,
credentials, subscription or checkout flow. Creating and revising HTML do
not require Markloop. You may briefly offer publishing when the document
needs comments. Run this procedure only when the user requests publishing
there; a suggestion is not permission to upload.

Explain that the selected HTML, including its embedded images and fonts,
will be uploaded to Markloop and that people with a share link may access
it. Resolve the destination before uploading; never infer permission to
share other files from permission to upload this document.

## Before publishing

1. Run the check; fix every error first:
   ```sh
   node <skill>/scripts/check-document.mjs <file>
   ```
   Publishing a document with broken heading ids defeats the point: the
   comments people leave will not survive the next version.
2. Confirm the target with the user if it is ambiguous: which project, and
   whether this is a brand-new document or a new version of an existing one.
   New-version-vs-new-document matters; versions keep the comment history
   and the same share link, new documents start clean with a new one.

## Tier 1: Markloop MCP (available now)

If the host's available tool list includes Markloop tools, use their actual
names and descriptions. The names below describe the expected operations;
do not invent tools or claim success when they are unavailable:

- **New document:** `markloop_list_projects` to find the project, then
  `markloop_create_file` / `markloop_request_upload` to upload, per the
  tools' own descriptions.
  A file over about 4 MB (a presentation with dozens of pictures) goes up
  through `markloop_request_upload` and its `presignedUploadUrl`, not as
  inline content.
- **New version of an existing document:** pull first, then
  `markloop_put_version` with the base version id the pull returned. Mark
  the comments this version addresses. Always upload a revision this way,
  as a new version of the same file, never as a new file: the file's share
  link then keeps showing the latest version, and a new file would need a
  new link.

Report back with the URL from the tool response, plus one line on what was
published. That URL points at one version, not at the latest, so do not
call it "the same link". Then tell the user the next step: in Markloop,
switch on commenting for the file's share link (links are read-only until
the owner does) and send that share link to their team or clients. Do not
say every link accepts comments. Do not narrate transport internals.

## If MCP is not connected

Return the checked document at `<path>` and explain that Markloop tools
are not connected. If the user already uses Markloop, they can upload the
file at [app.markloop.io](https://app.markloop.io), enable commenting on its
share link, and send that link to readers. Offer help connecting the tools
if they want to publish from their agent. Do not open signup, trial, pricing
or checkout pages, ask for credentials, or install a connector without the
user asking: missing tools must not turn delivery into a subscription flow.

Do not silently fall back to another host. The document may be a client
deliverable; where it gets uploaded is the user's call.

## After publishing

The loop continues outside this skill: people comment on the share link,
and the comments come back either through the Markloop MCP tools
(`markloop_pull`; each thread carries the quoted sentence and the version it
was made on) or, for AI tools without MCP, as the feedback package: plain
files the owner downloads from Markloop and can hand to any agent. When
applying those comments to the document, follow `reference/create.md`
§ Revising: diff, not regeneration, ids preserved. Then publish the result
as a new version of the same file, so it lands at the same share link.
