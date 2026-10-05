# release-notes--kestrel: raw notes and prompt

Output: [`documents/release-notes--kestrel.html`](../documents/release-notes--kestrel.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: the release notes for Kestrel 4.3, for our customers' fleet managers and their developers, from my notes in notes/release-notes--kestrel.md. Make it a single self-contained HTML file on our letterhead (the kestrel brand), using the release-notes template in the corporate style. Save it as release-notes--kestrel.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 2 of the kestrel session of the regeneration run (`--resume` of the previous turn). The taught `kestrel` profile (`examples/brands/kestrel/`, without `site.html`) was placed in `.letterhead/brands/kestrel/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/release-notes--kestrel.md`.

## Raw notes (verbatim, as given to the model)

```text
# Kestrel 4.3 – release notes (draft notes)

released: Tue 29 Sep 2026 EU-West, all regions Thu 1 Oct 2026. notes dated Thu 1 Oct.
readers: fleet + operations managers at our 38 customers (municipalities and contractors) and their developers who use the API
contact: support@kestrel.example, Noor Hamdi (PM)

highlights
- tipping-site queue times: planner now uses live queue times at 9 tipping sites (weighbridge feeds), so the dump trip gets planned around the queue. Westerhaven pilot Aug–Sep: 22 min less waiting per truck per day on average
- driver app offline mode: works up to 6 h without signal; stop confirmations and photos queue on the tablet and upload when back online
- lock stop order: planners can lock the order of a stretch of a route (drivers who know their streets asked for this a lot), the optimizer plans around it

other changes
- planner: route map shows tipping-site ETA + expected queue
- exports: daily plan export now also as Parquet (CSV still there)
- API: /v2/plans response has a new field tipping_eta per route
- API: vehicle.capacity_kg now required when creating vehicles. existing vehicles without it default to 10,000 kg and show a warning in the planner

breaking / action needed
- v1 API removed Mon 30 Nov 2026. /v1/routes and /v1/stops deprecated since 3.8 (Feb 2026). 4 customers still call v1 (we've emailed them). migration: /v1/routes -> /v2/plans/{date}/routes, /v1/stops -> /v2/stops, guide at docs/migrate-v1
- webhook signature: new header Kestrel-Signature (HMAC-SHA256). old header X-Kestrel-Signature (SHA-1) still sent alongside until Mon 30 Nov 2026, then only the new one. steps: read the new header, verify with your existing webhook secret using SHA-256, deploy, then stop reading the old one

fixes
- routes crossing midnight showed the next day's date on the tablet
- time-dependent weight limits on bridges were ignored after 18:00
- importing NDJSON stop files with a byte-order mark created duplicate stops
- planner slow (8–12 s) to open depots with more than 2,000 stops – now under 2 s

known issues
- offline mode: photos larger than 12 MB fail to upload after reconnect. workaround: set tablet camera to "standard" quality (most are). fix in 4.3.1, mid-October
- Parquet export has no timezone metadata for depots outside CET/CEST (affects 2 customers, both told)

rollout
- no action needed for planning, the tablets update themselves overnight
- if you call the API: check the two breaking items above before 30 Nov
```
