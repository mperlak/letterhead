# Arkona – weekly status, wk 41 (notes)

project: new webshop + ERP order sync. client contact: Karin Holm (ecom lead). us: Fieldwork Digital (me + Tomasz backend, Ines frontend)

DONE this week
- checkout redesign live on staging, Karin + 2 of her team clicked through, 6 small fixes logged, 5 already done
- product import: 412 of 412 SKUs in the new shop. 37 still missing package dimensions -> freight cost calc falls back to flat rate for those
- order sync staging test ran Tue-Thu: 1,284 test orders pushed to ERP, 1,279 ok, 5 failed (all same cause: VAT code for Norway deliveries not mapped). fix written, retest monday
- trade customers: price lists for 3 of 4 tiers imported

IN PROGRESS
- 4th trade price tier (project/contract pricing) – waiting on spreadsheet from Arkona finance, promised last fri
- stock levels: sync every 15 min in staging, want 5 min for go-live, Tomasz checking ERP API rate limits
- payment provider webhooks – sandbox flaky, support ticket open since 30 Sep

RISKS
- the 37 SKUs w/o dimensions: if not filled by 20 Oct, those products go live with flat-rate freight (cheaper for customer than real cost on big tables, Arkona eats the diff)
- payment webhooks: if sandbox not fixed by 14 Oct we test against live with small real orders instead
- budget: 62% of hours used, we're at ~55% of the timeline. ok-ish, watching it

DECISION NEEDED (Karin / finance) by Fri 10 Oct
- price freeze in ERP during cutover 28 Oct – 3 Nov? option A freeze (clean cutover, no manual work), option B no freeze (we reconcile price changes by hand after go-live, est. 1-2 days of our time + Arkona checking)
- we recommend A

DATES
- retest order sync: Mon 6 Oct
- 4th price tier needed by: Wed 8 Oct
- content freeze: 20 Oct
- cutover window: 28 Oct – 3 Nov, go-live Mon 3 Nov
