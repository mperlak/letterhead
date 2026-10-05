# checklist--arkona: raw notes and prompt

Output: [`documents/checklist--arkona.html`](../documents/checklist--arkona.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: the go-live weekend checklist for Arkona's team and ours, from my notes in notes/checklist--arkona.md, as a single self-contained HTML file on Arkona's letterhead (the arkona brand), using the checklist template in the workshop style. Save it as checklist--arkona.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 3 of the arkona session of the regeneration run (`--resume` of the previous turn). The taught `arkona` profile (`examples/brands/arkona/`, without `site.html`) was placed in `.letterhead/brands/arkona/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/checklist--arkona.md`.

## Raw notes (verbatim, as given to the model)

```text
# go-live weekend checklist – Arkona (notes)

for: the people in the room at the go-live walkthrough Thu 29 Oct 14:00 (Arkona showroom, Rønne) and on the weekend itself. Gets printed, ticked off by hand, one copy on the warehouse wall.
Arkona: Karin Holm (ecom lead, runs the weekend on Arkona's side), Jens Kofoed (warehouse), Mette Ravn (customer service), Sofie Lund (finance), Henrik Mortensen (MD, go/no-go)
Fieldwork: Signe Krog (lead), Tomasz Wójcik (backend), Ines Ferreira (frontend)
sign-off line at the end of each block: name + time

BEFORE THE WEEKEND (by Thu 29 Oct)
- 4th trade price tier loaded + 10 customers per tier spot-checked – Sofie
- remaining SKUs w/o package dimensions filled in (was 37 on 5 Oct) – Karin
- "shop closed for the weekend" email + phone message ready – Mette, reviewed by Signe
- 88 hand-mapped redirects done and tested – Ines
- DNS TTL lowered to 300 s (done Fri 23 Oct) – Tomasz
- price freeze in ERP active since Tue 27 Oct 06:00 – Sofie
- go/no-go #1 held, decision written down – Henrik
- phone list for the weekend printed (everyone's mobile) – Signe

FRIDAY 30 OCT
- 17:30 last orders in old shop picked/packed as normal – Jens
- 18:00 old shop -> maintenance page – Ines
- 18:15 last orders exported + synced to ERP, count checked against shop admin – Tomasz
- 18:30 out-of-office on shop@ mailbox switched on – Mette

SATURDAY 31 OCT
- 08:00 final migration starts (customers, order history, gift cards) – Tomasz
- gift card total = DKK 148,900, 312 cards – Sofie checks the number Tomasz sends
- order sync switched to new shop – Tomasz
- stock levels in new shop match ERP for 20 random SKUs – Jens (only here 09–15!)
- product pages spot check: 30 pages, prices, images, freight – Karin + Ines

SUNDAY 1 NOV
- 20 test orders: DK, SE, NO, DE; all 4 payment methods; each trade tier; at least 1 Norway order – Ines places, Karin watches ERP
- test orders arrive in ERP with right VAT code – Tomasz
- test orders picked in warehouse system (not shipped) – who?? Jens not available Sunday -> OPEN
- all test orders refunded, refunds visible in payment provider – Sofie
- 16:00 go/no-go #2 by phone – Henrik decides, Signe reports criteria

MONDAY 2 NOV
- 07:00 DNS switch – Tomasz
- 07:30 new shop reachable from 3 networks (office, mobile, home) – Ines
- 08:00 shop open, maintenance page gone – Ines
- 08:00 "set your new password" mail to 14,212 customers goes out in batches – Tomasz
- first 10 real orders synced clean -> 12:00 lift ERP price freeze – Sofie, after Tomasz confirms
- 12:00 rollback window closes – Henrik informed
- 09:00 daily check-in Karin + Signe starts (every weekday until Fri 13 Nov)

IF SOMETHING GOES WRONG
- before Mon 12:00: Signe calls Henrik, rollback = DNS back to old shop (Tomasz, ~15 min)
- payment problems: switch to backup payment method, Ines
- warehouse can't see orders: Jens calls Tomasz directly
```
