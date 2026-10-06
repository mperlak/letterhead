# meeting-notes--fieldwork: raw notes and prompt

Output: [`documents/meeting-notes--fieldwork.html`](../documents/meeting-notes--fieldwork.html). Generated
2026-10-06 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Arkona is our client. Write up the meeting notes from our weekly go-live call with them on Wednesday 21 October, from my notes in notes/meeting-notes--fieldwork.md, as a single self-contained HTML file on our own letterhead (the fieldwork brand). It goes to everyone who was on the call and to the two who missed it. Save it as meeting-notes--fieldwork.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 1 of a fresh fieldwork session, separate from the regeneration run (same flags). The taught `fieldwork` profile (`examples/brands/fieldwork/`, without `site.html`) was placed in `.letterhead/brands/fieldwork/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/meeting-notes--fieldwork.md`. The prompt names neither the template nor a style: the agent picked `meeting-notes` and the profile's base style (consulting).

## Raw notes (verbatim, as given to the model)

```text
# arkona weekly call – wed 21 oct (my notes)

10:00–10:50, Teams. weekly go-live call, the second-last before cutover (27 Oct)
Arkona: Karin Holm (ecom lead), Sofie Lund (finance), Mette Ravn (customer service, joined 10:30 for the email bit)
us: me (Signe), Tomasz, Ines
not there: Henrik (MD, at a trade fair in Hamburg, Karin briefs him), Jens (warehouse, on leave till Mon)

1. order sync / VAT
- Norway VAT fix retested Mon 5 Oct, then full rerun Mon 19 Oct: 1,300 test orders, 0 failed
- Karin happy, no more sync testing before the weekend except the Sunday test orders

2. payments
- provider fixed the sandbox Thu 15 Oct (ticket from 29 Sep finally closed)
- Ines ran 40 test payments, all 4 methods ok
- MobilePay refunds show 2-3 min late in the provider dashboard. normal per provider. fine, nobody worried
- so we do NOT need the small-real-orders plan anymore

3. stock levels
- Tomasz checked the ERP API limit: 600 calls/hour, 5-min sync uses ~290. -> we go live with 5 min. Karin agreed

4. data still missing
- package dimensions: 9 SKUs still missing (was 37). content freeze was Mon 19 Oct but Karin asked to keep dims open. AGREED: Karin can fill dims until Wed 28 Oct. anything still missing then goes live w/ flat-rate freight, Karin OK with Arkona paying the difference for those few
- 4th price tier: spreadsheet came 13 Oct. Sofie loads it + spot-checks 10 customers per tier by Mon 26 Oct
- price freeze: Sofie confirmed freeze from Tue 27 Oct 06:00, lifted Mon 2 Nov 12:00 after first 10 real orders sync clean (her call, finance)

5. comms (Mette)
- "shop closed for the weekend" email + phone message: Mette drafts, I review, by Fri 23 Oct
- password reset mail to 14,212 customers mon 2 nov 08:00 in batches of 2,000 every 15 min (so we don't get flagged as spam) – decided, Karin + me
- Mette asked if CS can see test orders in the old shop – no, old shop is read-only from Fri 18:00

6. weekend people
- Jens away Sunday 1 Nov (family thing, known). someone from the warehouse has to pick the Sunday test orders (not ship). Karin will ask around but NEEDS A NAME by Fri 23 Oct or we move the pick test to Mon 07:00 which is tight before the 08:00 opening
- go/no-go #2 Sunday 16:00 by phone, Henrik decides – Karin to confirm Henrik can do 16:00 (he's back from Hamburg Sat)

actions
- Karin – dims for last 9 SKUs – Wed 28 Oct
- Sofie – load 4th tier + spot check – Mon 26 Oct
- Mette – closed-for-weekend email + phone msg draft – Fri 23 Oct (I review)
- Tomasz – DNS TTL to 300 s – Fri 23 Oct
- Ines – finish 88 hand-mapped redirects + test – Tue 27 Oct
- Ines – send Karin the Sunday test order matrix (20 orders, countries/payments/tiers) – asap
- me – weekend phone list printed for the walkthrough – Thu 29 Oct
- Karin – name for sunday pick + confirm henrik 16:00 – Fri 23 Oct

next: go-live walkthrough Thu 29 Oct 14:00, Arkona showroom Rønne, in person (replaces next week's call). go/no-go #1 there with Henrik
```
