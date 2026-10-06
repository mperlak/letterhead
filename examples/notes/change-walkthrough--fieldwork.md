# change-walkthrough--fieldwork: raw notes and prompt

Output: [`documents/change-walkthrough--fieldwork.html`](../documents/change-walkthrough--fieldwork.html). Generated
2026-10-06 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Arkona's team was not involved in building the out-of-stock handling we shipped on Wednesday, and they have to accept it. Walk them through it, from my notes in notes/change-walkthrough--fieldwork.md, as a single self-contained HTML file on our own letterhead (the fieldwork brand). It goes to Mette, Jens and Karin, with Sofie in copy. Save it as change-walkthrough--fieldwork.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 1 of a fresh fieldwork session, separate from the regeneration run (same flags). The taught `fieldwork` profile (`examples/brands/fieldwork/`, without `site.html`) was placed in `.letterhead/brands/fieldwork/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/change-walkthrough--fieldwork.md`. The prompt names neither the template nor a style: the agent picked `change-walkthrough` and the profile's base style (consulting).

## Raw notes (verbatim, as given to the model)

```text
# arkona – out-of-stock handling in order sync (walkthrough notes, tomasz + me)

for: Mette Ravn (customer service – she'll live with this most), Jens Kofoed (warehouse), Karin Holm (ecom lead, accepts it). Sofie (finance) cc – refunds. NOT for Henrik
us: Signe (writing), Tomasz Wójcik (built it), Ines Ferreira (did the shop admin screens + the email)
date: Thu 12 Nov 2026, last week of hypercare (ends Fri 13 Nov). change is on prod since Wed 11 Nov 15:40, built on branch fix/oos-lines, tag v1.0.3 in the shop repo. all of it can be seen in the shop admin (Orders > Backorders) and on staging for the test steps
reply by: Wed 18 Nov so we can close it out before the hypercare invoice

why we did it
- go-live Mon 2 Nov. stock sync every 5 min (agreed). problem: two customers can buy the last 1–2 pieces inside the same 5 min, or the ERP count is just wrong (stock taken for a showroom piece on Bornholm, not booked)
- what happened before the change: shop pushes order to ERP, ERP says "line short, not enough stock" for ONE line, and the whole order was rejected = "sync failed". customer had paid and had a confirmation mail. nobody picked it. Mette only found out when she looked at the failed list – longest one sat 26 h (Tue 3 Nov evening → Wed 4 Nov 19:00, a pair of Skagen armchairs)
- numbers Mon 2 – Tue 10 Nov: 2,847 orders, 17 had a line the ERP couldn't cover (0.6%). 11 were multi-line orders: whole order "sync failed", handled by hand by Mette / Tomasz, 6 of them only because Jens happened to see the stock. 6 were single-line orders – failed too, but Mette cancelled + refunded those within the hour (so the 26 h one is a multi-line)

what changed – in order of what they will notice
1. order is no longer rejected when one line is short. sync now splits it: lines with stock go to ERP and to the warehouse as normal (Jens sees them on his pick list), the short line becomes a "backorder line" – status "Awaiting stock" – and stays in the shop only
2. customer gets a new email right after (template "Part of your order will ship later", English + Danish + Norwegian + Swedish, Ines): says what ships now, what's delayed, the expected date if ERP has one (supplier delivery date from ERP field exp_date, often empty – then "we'll write when we know"), and two links: "wait for it" (default) / "cancel this item and refund it". customer has 72 h to click, no click = keeps waiting
3. cancel = refund of that line only through the payment provider (the same provider, 4 methods) – shipping is not refunded unless the whole order is gone. gift-card part of the payment goes back on the gift card. Sofie sees it in the daily refund export (new column "reason: backorder")
4. new admin list Orders > Backorders: all open backorder lines, oldest first, order number, customer, SKU, days waiting, customer's choice. Mette works from this. there's a red-ish badge on lines waiting more than 5 days
5. when the ERP shows stock again (every 5 min sync) the line is released automatically: goes to ERP as a new order line + to Jens's pick list. customer gets the normal shipped mail. if freight was flat-rate for the order it's NOT charged twice (second parcel free) – decision, see below
6. the small one: safety buffer. for SKUs with ERP stock ≤ 2 the shop now shows "out of stock" instead of the last 2 (so the 5-minute gap can't oversell the last pieces). the buffer is 2 as a first guess, per SKU editable in admin (field "stock buffer"). 38 of 412 SKUs are affected right now

what we decided for you (please say yes or no)
- backorder waits max 14 days, then the line is auto-cancelled + refunded and the customer is mailed. 14 is our guess, Karin knows suppliers' lead times better. some suppliers (the teak ones, Bali) are 8-10 weeks – those SKUs probably should be "no backorder, show out of stock" instead. NEEDS KARIN'S LIST
- second parcel shipping free. costs Arkona roughly DKK 80–120 per split order, at the current rate (≈ 0.6% of orders, so maybe 50 split orders a month at the current volume) ~ DKK 5,000/month. Karin ok? (she said "sounds fine" on the phone Tue but not in writing)
- trade customers (the 4 price tiers, 212 accounts active) do NOT get the choice email – their lines go on the backorder list marked "trade" and Mette phones. reason: project customers often need all items together and may want the whole order held. we haven't asked any of them. is that right?
- buffer of 2 – too cautious? we don't know how often the last piece is really sold in-store at the showroom. Jens to say

things that surprised us / flags
- the ERP's "short" answer comes as HTTP 409 with code STOCK_SHORT but ONLY for the first short line – for an order with 2 short lines you get one error, then we have to re-send. we handle it (loop, max 5 lines) but if it ever shows 3+ short lines in one order, tell us
- time zone: exp_date from the ERP is in Danish time, shop shows UTC – saw one date off by a day in staging, fixed, but look at the dates in the emails
- one thing not done: partial shipments to Norway – customs paperwork is per parcel, so a split Norway order means two customs forms. Jens, you know this better than us – we haven't changed the packing slip. Norway orders in the first 9 days: 41, none split so far
- we have NOT changed stock sync frequency, still 5 min

how to check (staging, shop.staging.arkona.example, test login as Mette – she has it. no real money, the payment provider is in test mode)
1. in the admin open Products > TEST-STOCK-3 (a test chair, ERP stock set to 3 on staging). add 2 to the cart as a customer, check out with test card, order must be accepted. you should see: order confirmed, goes to "Sent to ERP"
2. now Products > TEST-STOCK-0 (stock 0). put 1 of it AND 1 of TEST-STOCK-3 in the cart, check out. should see: order in status "Partly sent" – 1 line sent, 1 line on Orders > Backorders with "Awaiting stock", and an email in the staging mailbox (mailpit-like inbox at /dev/mail) within 1 min. wrong would be: order in "Sync failed"
3. click "cancel this item" in that email → backorder line "Cancelled", the refund appears in Orders > Refunds with reason backorder. amount = price of that line only, shipping unchanged
4. repeat step 2 and then, in the ERP test console (Tomasz can open it, or ask), put TEST-STOCK-0 to 5. within 5 min the line should disappear from Backorders and show on Jens' pick list. if still there after 10 min, tell us
5. open TEST-STOCK-2 on the shop as a customer – it should show "out of stock" (buffer 2). check the same SKU in admin: stock 2, buffer 2
6. as a trade customer (login trade-test@arkona.example) do step 2: no email, line on the list marked "trade"

on yes: we tag v1.0.3 as accepted, invoice stays as it is (inside hypercare – no extra cost, the work was ~1.5 days which we absorb), Tomasz switches the buffer + 14-day rules to what Karin decides, and hypercare closes Fri 13 Nov as planned. if no: say what's wrong, send to Signe; anything small we fix by Mon 16 Nov, anything that changes a decision above we discuss on the daily call
```
