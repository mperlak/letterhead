# proposal--fieldwork: raw notes and prompt

Output: [`documents/proposal--fieldwork.html`](../documents/proposal--fieldwork.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: a proposal from us (Fieldwork Digital) to our client Arkona for phase 2, a trade portal. My notes are in notes/proposal--fieldwork.md. Make it a single self-contained HTML file on our own letterhead (the fieldwork brand), using the proposal template in the consulting style. Save it as proposal--fieldwork.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 1 of the fieldwork session of the regeneration run. The taught `fieldwork` profile (`examples/brands/fieldwork/`, without `site.html`) was placed in `.letterhead/brands/fieldwork/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/proposal--fieldwork.md`.

## Raw notes (verbatim, as given to the model)

```text
# proposal to Arkona – phase 2: trade portal (notes)

to: Henrik Mortensen (MD) + Karin Holm (ecom lead), Arkona. Henrik asked in Sept for a number for next year's budget, board meets end of Nov.
from: Signe Krog, Fieldwork Digital. date Mon 5 Oct 2026. valid until Fri 27 Nov 2026.

why
- trade customers (garden centres, landscape architects, hotels, ~180 active accounts) order by email + phone today
- 1,900 trade orders last year, Mette's team keys each one into the ERP by hand, ~22 min each -> ~700 hours/yr
- 14% of trade orders had a price corrected after invoicing (wrong tier, old price list) – credit notes, annoyed customers
- 2 big garden-centre chains asked for online ordering in this year's account reviews
- the new shop (live 2 Nov) already has the 4 price tiers + ERP order sync, so most of the plumbing exists. phase 2 builds on it, doesn't start over

what we'd build
- trade login per company, several users per company (buyer, accounts)
- prices per tier incl. tier 4 project pricing, straight from ERP
- quick order by SKU / paste a list, reorder from history
- credit limit + open invoices from ERP, invoice PDFs downloadable
- several delivery addresses per account (chains deliver to each store)
- request-a-quote for contract jobs over DKK 50,000 -> creates a quote in ERP for Karin's team

NOT included: punch-out / EDI to the big chains' purchasing systems (separate later, if they ask), mobile app, new ERP modules

price (DKK excl. VAT, our rate DKK 1,050/h)
- discovery, 2 weeks, fixed: 38,000
- trade portal build: 290 h = 304,500
- request-a-quote flow: 64 h = 67,200
- ERP integration (customers, credit limits, invoices): 80 h = 84,000
- testing + launch: 40 h = 42,000
- total 535,700
- discovery is fixed. the rest is an estimate ±15% until discovery is done; after discovery we give a fixed price
- optional after launch: support retainer 20 h/month at DKK 950/h = 19,000/month, min 6 months

payback (rough, say it's rough)
- if 60% of trade orders move online, ~420 h/yr of keying saved = roughly a third of one CS person
- price corrections: hard to put a number on, don't invent one

timeline
- discovery Mon 11 – Fri 22 Jan 2027
- build Mon 1 Feb – Fri 30 Apr 2027
- launch Tue 4 May 2027, before the season's big trade reorders
- needs from Arkona: Karin ~1 day/week, Sofie for price/credit rules (~6 days total), 5 trade customers for testing in April

the ask
- approve the discovery (DKK 38,000) by Fri 27 Nov so we can hold the team for January
- the rest gets decided after discovery, with a fixed price in hand

risks / honest bits
- depends on phase 1 going live clean on 2 Nov; if hypercare drags, discovery slides
- ERP credit-limit data is messy (Sofie said so); discovery will tell how messy
```
