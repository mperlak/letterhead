# agreement--series-seed: the agreement template's worked example

Output: [`documents/agreement--series-seed.html`](../documents/agreement--series-seed.html).
Built 2026-11-09. Not the output of an agent run, and no fictional company: a
contract only shows what the template does when it has the length and the
structure of a real one.

The text is `equity/Series Seed - Preferred Stock Investment Agreement.md` from
[CooleyLLP/seriesseed](https://github.com/CooleyLLP/seriesseed) at commit
`0d705f2b0704ddf01a6aa450a762eb9251b2085f`, which the repository releases under the
[CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/).
The form was written for companies incorporated in Delaware, and Cooley
provides it for reference only. This example shows a layout. It is not legal
advice, and the form is not ready to sign as it stands.

A one-off script turned the Markdown into the markup of
`letterhead/reference/markup.md`, then:

```sh
node letterhead/scripts/apply-tokens.mjs letterhead/styles/boardroom/tokens.css examples/documents/agreement--series-seed.html
node letterhead/scripts/apply-template.mjs agreement examples/documents/agreement--series-seed.html
node letterhead/scripts/check-document.mjs --render examples/documents/agreement--series-seed.html
```

A word-by-word comparison with the source found no difference across 11,426
words, once the Markdown marks and the underscores of the blanks (now
`.line` elements) are set aside. The check reports 0 errors, 0 warnings and 2
info notes: no metadata block, because the form has none, and the bracketed
`[COMPANY NAME]`, which a blank form keeps. The document's own CSS is one
line, `@page { size: letter; }`, for a US contract.
