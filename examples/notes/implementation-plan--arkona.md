# implementation-plan--arkona: raw notes and prompt

Output: [`documents/implementation-plan--arkona.html`](../documents/implementation-plan--arkona.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next document for Arkona. I'm Signe Krog, project lead at Fieldwork Digital, the agency building their new web shop. Turn my notes in notes/implementation-plan--arkona.md into the cutover and go-live plan that Henrik and Karin are to sign off, as a single self-contained HTML file on Arkona's letterhead (the arkona brand you taught), using the implementation-plan template in the boardroom style. Save it as implementation-plan--arkona.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 2 of the arkona session of the regeneration run (`--resume` of the previous turn). The taught `arkona` profile (`examples/brands/arkona/`, without `site.html`) was placed in `.letterhead/brands/arkona/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/implementation-plan--arkona.md`.

## Raw notes (verbatim, as given to the model)

```text
# Arkona – cutover + go-live plan (my notes, for Henrik + Karin to sign off)

who: Arkona = Henrik Mortensen (MD, signs), Karin Holm (ecom lead), Sofie Lund (finance), Jens Kofoed (warehouse lead), Mette Ravn (customer service)
us = Fieldwork Digital: Signe Krog (me, project lead), Tomasz Wójcik (backend/ERP), Ines Ferreira (frontend)
written Mon 5 Oct 2026. want sign-off by Fri 16 Oct so we can book the weekend.

price freeze decision: option A (freeze ERP prices during cutover). Karin said yes on the phone Thu 1 Oct, Sofie confirmed by mail Fri 2 Oct. so plan assumes A.

what moves at cutover
- 412 SKUs (already in new shop), 4 trade price tiers (tier 4 = project pricing, spreadsheet due Wed 7 Oct)
- 14,212 customer accounts, 61,048 historical orders (since 2019) – customers get a "set your new password" mail on Mon 2 Nov, not before
- 312 active gift cards, total value DKK 148,900 – must match to the krone
- 2,140 old URLs -> redirects. 2,052 mapped automatically, 88 by hand (Ines, done by Fri 16 Oct)
- order sync + stock sync switch from old shop to new shop

timeline
- Mon 19 Oct: content freeze in old shop. any product/text edit after that goes in the shared sheet and gets re-applied after go-live
- Tue 20 – Fri 23 Oct: full dress rehearsal on staging with a copy of prod data. last trial migration took 5 h 40 min (customers + order history are the slow part), target under 4 h. Tomasz batching the order-history import
- Fri 23 Oct: lower DNS TTL to 300 s
- Tue 27 Oct 06:00: ERP price freeze starts
- Thu 29 Oct 14:00: go/no-go #1 (Henrik, Karin, Signe) + walkthrough of the weekend with Jens and Mette
- Fri 30 Oct 18:00: old shop -> maintenance page ("back Monday 08:00"), last orders exported + synced
- Sat 31 Oct 08:00–~14:00: final migration (customers, order history, gift cards), switch order sync to new shop, reconcile gift-card total
- Sun 1 Nov: 20 test orders – DK/SE/NO/DE, all 4 payment methods, each trade tier, one Norway order (VAT code fix) – then refund all. go/no-go #2 Sun 16:00 by phone
- Mon 2 Nov 07:00 DNS switch, 08:00 shop open. price freeze lifted 12:00 once the first 10 real orders have synced clean
- hypercare Mon 2 – Fri 13 Nov: we're on call weekdays 07–20 and Sat 10–16. daily 15-min check-in with Karin at 09:00

go criteria (all must be true at go/no-go #2)
- order sync error rate under 0.5% on the test orders (target 0)
- stock sync every 5 min or better (now 15 in staging; depends on ERP API rate limits, Tomasz checking)
- all 4 trade price tiers loaded and spot-checked by Sofie (10 customers per tier)
- payment webhooks verified (sandbox still flaky, ticket open since 29 Sep; fallback = small real orders on live)
- gift card total matches DKK 148,900
- redirects: 100% of the top 300 URLs by traffic return 301 to the right page

rollback
- until Mon 2 Nov 12:00 we can point DNS back to the old shop (kept read-only until 30 Nov)
- orders taken in the new shop during that window would be keyed in by hand (we expect fewer than 30)
- after 12:00 Monday: roll forward only, fix in place

risks
- 37 SKUs still without package dimensions -> flat-rate freight on those at go-live if not filled by 19 Oct (Arkona eats the difference on big tables)
- trial migration too slow -> if rehearsal still over 5 h we start Sat 06:00 instead of 08:00
- Jens only available Sat 09–15. warehouse needs someone Sun for test-order picking? -> open
- Mette needs the "shop closed for the weekend" mail + phone message by Fri 23 Oct (she writes, we review)

money
- cutover + hypercare inside the fixed quote EXCEPT weekend work: 2 people x 2 days at weekend rate = DKK 18,400 extra. needs Henrik's ok

open
- who from Arkona picks test orders on Sunday
- Henrik's ok on the DKK 18,400
- does finance want to see the gift-card reconciliation before or after go/no-go #2
```
