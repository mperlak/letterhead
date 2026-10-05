# project-recap--fieldwork: raw notes and prompt

Output: [`documents/project-recap--fieldwork.html`](../documents/project-recap--fieldwork.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: the project recap for our client Saltværk, now that their new shop is live. My notes are in notes/project-recap--fieldwork.md. Make it a single self-contained HTML file on our own letterhead (the fieldwork brand), using the project-recap template in the startup style. Save it as project-recap--fieldwork.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 2 of the fieldwork session of the regeneration run (`--resume` of the previous turn). The taught `fieldwork` profile (`examples/brands/fieldwork/`, without `site.html`) was placed in `.letterhead/brands/fieldwork/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/project-recap--fieldwork.md`.

## Raw notes (verbatim, as given to the model)

```text
# Saltværk – project recap (notes)

client: Saltværk (sea-salt producer, ~20 people). Anne Bech (founder/CEO), Lars Holt (ops manager)
us: Signe Krog (lead), Tomasz Wójcik (backend), Ines Ferreira (frontend), Ole Brandt (design, freelance)
project: move from old hosted shop to Shopify + live link to their warehouse system (WMS)
recap written Mon 28 Sep 2026, for Anne + Lars, and for us

dates
- kickoff Tue 7 Apr 2026 (not 6th, Easter Monday)
- planned launch Tue 18 Aug, actual launch Tue 1 Sep (2 weeks late)
- why late: WMS vendor changed their order API on 14 Jul without notice, cost us ~6 working days, plus 1 week of summer holidays we had not planned around (our fault)
- handover / project closed Fri 11 Sep

money (DKK excl. VAT)
- quoted 412,000 fixed
- change request: gift-box configurator, approved Fri 12 Jun, +24,000
- final invoice total 431,500 -> +4.7% vs original quote, all of it the approved change (we came in 4,500 under on the rest)

delivered
- new shop on Shopify, 86 products, DK + DE + SE storefronts
- live order + stock sync with the WMS (every order in WMS within 1 min)
- gift-box configurator (choose 3 salts + card) – the change request
- B2B login for 40 restaurant customers with their own prices
- not delivered: subscription box (monthly salt box) – moved to phase 2 by Anne in June, it needs a subscription app we didn't want to rush

first 4 weeks live (1–28 Sep 2026 vs same 4 weeks 2025)
- orders 1,812 vs 1,431 (+26.6%)
- conversion rate 2.9% vs 2.1%
- same-day dispatch: 94% of orders placed before 13:00 leave the same day (was ~60%)
- "where is my order" emails to support: 71 vs 212
- 68% of orders on mobile
- careful: September 2025 had no campaign, Sep 2026 had a newsletter on 8 Sep, so not all of the +26.6% is the shop

open
- 3 open bugs, all minor: gift message cut at 140 chars in WMS (WMS limit, workaround = shorter field in shop); discount codes don't apply to B2B prices (by design? Anne to decide); one payment method listed twice on iOS Safari (fix in test, out this week)
- subscription box = phase 2, quote by end of October
- warranty period: 3 months after launch, until Tue 1 Dec

what we learned
- WMS sandbox is not the same as their production API. next time: get a named contact at the vendor in week 1 and test against prod read-only early
- content migration took 3x our estimate because Saltværk rewrote all product texts during the project (good texts, but plan for it)
- the weekly written status worked, Anne said she read every one; the Thursday calls could have been 15 min not 45
- gift-box configurator was the best-selling "product" in September (212 boxes) – worth the change request
```
