# spec--kestrel: raw notes and prompt

Output: [`documents/spec--kestrel.html`](../documents/spec--kestrel.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: the spec for missed-collection reports, for Marloes Janssen (Gemeente Westerhaven) and Kees Brouwer (ReinNet) to review, from my notes in notes/spec--kestrel.md. Make it a single self-contained HTML file on our letterhead (the kestrel brand), using the spec template in the engineering style. Save it as spec--kestrel.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

A later turn (`--resume`) of the kestrel session. The session's first turn taught the brand from `kestrel-site.html` (saved here as `examples/brands/kestrel/site.html`) with this prompt:

> I work at Kestrel Labs; a saved copy of our homepage is in kestrel-site.html. Teach letterhead our brand from it and save the profile under the name kestrel (.letterhead/brands/kestrel/), so our specs, release notes and incident reports go out on it. I am not available to answer questions during this run: use the site file as the brand evidence, and I approve in advance whatever brand reading you propose, so do not wait for my confirmation. Just go.

The notes were in the run directory as `notes/spec--kestrel.md`.

## Raw notes (verbatim, as given to the model)

```text
# spec notes – missed-collection reports -> same-day return trips (v0.3)

for review by: Marloes Janssen (head of waste operations, Gemeente Westerhaven) and Kees Brouwer (dispatch lead, ReinNet – the contractor that drives Westerhaven's trucks). they need to confirm the flows match how it really works.
us: Noor Hamdi (PM), Felix Aydın (eng lead)
date Mon 5 Oct 2026. review comments by Fri 16 Oct. pilot in Westerhaven from Mon 11 Jan 2027.

background
- residents report a missed bin via the municipal app, website or the call centre -> lands in the municipality's reports system (they call it the meldingen system)
- today: a ReinNet dispatcher reads the reports, phones a driver, driver maybe goes back. no record of whether it happened
- Westerhaven: 88,000 residents, 14 trucks/day, ~140 missed-bin reports/week
- Kees's sample of 300 reports in Aug: 61% genuine misses (truck skipped it), 39% bin not out in time / wrong day / blocked by a parked car
- same-day return today: 34% of genuine misses. target for the pilot: 80% of genuine misses reported before 13:00 collected the same day

flow (happy path)
1. report comes in: meldingen system POSTs to Kestrel /v2/missed-collections – address (BAG id), container type (rest/gft/paper/pmd), reported_at, report id
2. Kestrel matches the address to a stop on today's or yesterday's route for that container type. no match -> "not scheduled", reply right away, nothing goes to a driver
3. classify using the truck's GPS trace + lift events from the truck body:
   - genuine: truck passed within 25 m during the planned window, no lift event at that stop
   - not presented: lift sensor shows no bin at the arm / driver tagged "not out" on the tablet
   - unknown: no GPS trace for that street (dead zone), or truck didn't pass at all
4. genuine + reported before 13:00 -> insert as a return stop into the best live route (cheapest detour that keeps driver hours + truck capacity + tipping-site opening hours)
5. driver sees the new stop on the tablet, with a "return" marker
6. after the lift event at that stop -> Kestrel calls back the meldingen system: report closed, collected_at timestamp
7. genuine but reported after 13:00 -> goes into tomorrow's plan as a priority stop (first 2 h of the route)

requirements (with how to check)
- R1 return stop inserted within 2 min of the report, p95 – measured from report received to stop on tablet
- R2 never break driver hours: EU 561/2006 (4.5 h driving then 45 min break) and ReinNet's own 9 h shift
- R3 max 6 return stops per truck per afternoon (Kees: more than that and drivers stop trusting the plan)
- R4 never send a full truck back: if the best truck is over 90% of capacity_kg, pick the next, or tomorrow
- R5 "not presented" reports are closed with the reason + photo if the truck took one, nobody is sent
- R6 "unknown" -> dispatcher queue in the Kestrel planner, dispatcher decides (no automatic return)
- R7 every report gets an answer to the meldingen system, also the ones we don't act on
- R8 cut-off time (13:00) configurable per municipality
- R9 dispatcher can undo a return stop up to the moment the driver starts towards it

integrations
- in: webhook from the meldingen system, HMAC-SHA256 signed (same as our other webhooks), idempotent on report id
- out: callback PATCH to the meldingen system's URL, retried 5x over 30 min
- truck data: GPS + lift events via ReinNet's fleet system (already connected for planning)
- photos: only from trucks with cameras (9 of 14 in Westerhaven)

data / privacy
- Kestrel only gets address id + container type + report id. no resident name, phone or email
- GPS traces kept 90 days (already the case), lift photos 30 days

open decisions (need Marloes + Kees)
- extra kilometres for return trips: who pays? contract says nothing. ~ estimate 18–25 km per truck-day
- "unknown" class: should dispatcher get it, or should the resident get "we'll come tomorrow" automatically?
- 13:00 cut-off: Kees thinks 12:00 is safer in winter (dark at 17:00)
- does the call centre want to see the status too, or only the meldingen system?

not in scope
- bulky waste reports, overflowing street bins, resident-facing app changes (municipality owns the app)
```
