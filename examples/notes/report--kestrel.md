# report--kestrel: the report template's worked example

Output: [`documents/report--kestrel.html`](../documents/report--kestrel.html).
Built 2026-10-18. Unlike the other documents here, this one is not the output
of an agent run: it is `letterhead/templates/report/example.html`, the worked
example the report template ships with, put on the Kestrel letterhead by the
skill's scripts and nothing else.

```sh
cp letterhead/templates/report/example.html examples/documents/report--kestrel.html
node letterhead/scripts/apply-tokens.mjs examples/brands/kestrel examples/documents/report--kestrel.html
node letterhead/scripts/apply-template.mjs report examples/documents/report--kestrel.html
node letterhead/scripts/check-document.mjs --render examples/documents/report--kestrel.html
```

The example carries every element of the template: the thesis title with an
accent, labeled metadata with date and scope, one contents list (rail on wide
screens, jump list on phones), the findings summary with its "what we do"
panel, sections that own their content with margin notes and pull numbers,
an explorer diagram (SVG with an HTML twin), a stepper, a chart with its
table, layers, recommendations with anchors, the decision panel and folded
terms. Its numbers are invented for the fictional Kestrel Labs world of the
spec and audit examples (`notes/spec--kestrel.md`), kept consistent with
each other. It replaces nothing: `report--halde.html` shows the same template
as an agent wrote it before the template had a layout of its own.
