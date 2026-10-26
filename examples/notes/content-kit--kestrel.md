# content-kit--kestrel: the content-kit template's worked example

Output: [`documents/content-kit--kestrel.html`](../documents/content-kit--kestrel.html).
Built 2026-10-26. Like `report--kestrel`, this one is not the output of an
agent run: it is `letterhead/templates/content-kit/example.html`, the worked
example the content-kit template ships with, put on the Kestrel letterhead by
the skill's scripts and nothing else.

```sh
cp letterhead/templates/content-kit/example.html examples/documents/content-kit--kestrel.html
node letterhead/scripts/apply-tokens.mjs examples/brands/kestrel examples/documents/content-kit--kestrel.html
node letterhead/scripts/apply-template.mjs content-kit examples/documents/content-kit--kestrel.html
node letterhead/scripts/count-copy.mjs examples/documents/content-kit--kestrel.html
node letterhead/scripts/check-document.mjs --render examples/documents/content-kit--kestrel.html
```

`count-copy.mjs` rewrote no counter (13 copy blocks, all within their
limits) and `check-document.mjs --render` reports 0 errors, 0 warnings and 0
info notes. The `<body>` is the example's, byte for byte, with the template's
script added at its end.

The example is Kestrel's launch kit for its Route API, owned by Noor Hamdi,
running 3 to 9 November 2026: the launch article on the blog (Tue 3 Nov), a
thread on X (Wed 4 Nov), a LinkedIn post (Thu 5 Nov) and a customer email
(Mon 9 Nov). It carries every element of the template: one "Before you
publish" section with two open decisions (each with its owner, its date and
the default that goes out without an answer), what to remember when
publishing and the settled points folded; one schedule table; the pieces in
publication order, each with its date badge; copy blocks with a counter and
a copy button, the X posts counted the way X counts them; a dashed
`.confirm` variant (post 2 with ReinNet named, used only on a yes); the
article as rich-text copy; folded verification under each piece; and the
sources. Its people and customers (ReinNet, the beta teams) come from the
fictional Kestrel Labs world of the spec, audit and report examples.
