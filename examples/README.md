# Examples

Everything in this directory is generated output, kept as proof and gallery
material. Nothing here is part of the installable skill.

## brands/

Two brand profiles produced by the `teach` flow on 2026-07-12:

- **markloop/** — taught from the Markloop product app's design tokens with
  the live site as a secondary source. In a real project this profile would
  live at `.letterhead/brand/`.
- **mroomy/** — taught from the live site (mroomy.com). In a real project
  this would live at `.letterhead/clients/mroomy/` as a client profile.
  The dark theme is derived (the site ships light-only), and that is noted
  in the profile itself.

Open each `brand-sheet.html` for a one-glance visual of the profile.

## documents/

Four demo documents covering both Milestone 1 templates, both reference
styles, and both brand profiles:

| Document | Template | Look |
|---|---|---|
| `implementation-plan-boardroom.html` | implementation-plan | boardroom style |
| `status-update-engineering.html` | status-update | engineering style |
| `status-update-markloop.html` | status-update | Markloop brand profile |
| `implementation-plan-mroomy.html` | implementation-plan | Mroomy brand profile |

The content of all four comes from the Lumen/Atlas fixtures
(`letterhead/fixtures/`), a fictional e-commerce integration between two
fictional companies. The Mroomy-branded document demonstrates client-brand
application mechanics; its content stays in the Lumen/Atlas fiction and
says nothing about the real Mroomy's operations.

All four pass `check-document.mjs` with zero errors, carry light and dark
themes in one file, and are fully self-contained.

### Style demos (full craft)

Six more documents cover the Milestone 2 templates and styles, each written
individually against its template contract and its style's DESIGN.md:
`spec--consulting` (numbered spine, oxblood section numbers, serif
display), `proposal--startup` (display-scale claims, the ask as the
closing panel), `report--corporate` (evidence panels, recommendation
ledger), `audit--public-sector` (verdict box, explicit-border tables,
severity words), `project-recap--workshop` (delivered-outcome cards,
sticky-note handoff boxes), `release-notes--gazette` (masthead, kickers,
vermilion lead, rule-delimited sections).

The 8 x 8 matrix builder (`dev-scripts/build-matrix.mjs`) still renders
every template in every style with a shared semantic shell as a CI gate;
those outputs live in `temp/` and are deliberately plainer than these.

## screenshots/

Rendered captures of the documents and brand sheets: desktop light, desktop
dark, and mobile (390px) for each document; light and dark for each brand
sheet.
