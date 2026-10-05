# postmortem--kestrel: raw notes and prompt

Output: [`documents/postmortem--kestrel.html`](../documents/postmortem--kestrel.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: the postmortem of the 22 September incident, for our customers, from my notes in notes/postmortem--kestrel.md. Make it a single self-contained HTML file on our letterhead (the kestrel brand), using the postmortem template in the public-sector style. Save it as postmortem--kestrel.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 3 of the kestrel session of the regeneration run (`--resume` of the previous turn). The taught `kestrel` profile (`examples/brands/kestrel/`, without `site.html`) was placed in `.letterhead/brands/kestrel/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/postmortem--kestrel.md`.

## Raw notes (verbatim, as given to the model)

```text
# incident 22 Sep – routes not published by 05:00 (postmortem notes)

audience: our customers – municipal waste departments and contractors, incl. their managers and council people who are not technical. blameless. going out Tue 29 Sep 2026, one week after.
incident lead: Ruth Okafor (on-call SRE that night). writeup: Felix Aydın (eng lead). customer contact: Sanne de Graaf (support lead)
all times CEST (UTC+2)

what happened, short
- night of Mon 21 → Tue 22 Sep 2026 the nightly planning for 14 of our 38 customers didn't finish. routes were not on the cab tablets at 05:00
- 211 trucks started the day without a new plan. drivers used yesterday's route or paper lists from the depot
- last routes published 07:52. average start delay for affected trucks: 47 min

timeline (Tue 22 Sep)
- 01:58 deploy of a database change (preparing the tipping-site queue feature for release 4.3) starts
- 02:10 the change starts rebuilding the stops table. table locked. nobody knew it would lock
- 02:10–03:58 planning jobs for 14 customers wait for the lock, retry 3x, time out. other 24 customers had already finished (they plan earlier)
- 03:58 table rebuild done, lock released. jobs don't restart by themselves (they'd given up)
- 05:00 alert "plans missing at 05:00" fires, pages Ruth
- 05:06 Ruth acknowledges
- 05:20 manual re-run started, biggest customers first
- 05:35 status page updated + email to affected customers
- 06:40 10 of 14 customers have routes
- 07:52 last customer's routes published
- 09:30 all-clear on status page

impact
- 14 customers (9 municipalities, 5 contractors), 211 trucks
- ~9,800 stops collected later than planned that morning
- 640 stops missed altogether, collected the next day (Wed 23 Sep)
- 3 customers claimed under the SLA (routes published by 05:00, 99.5% per month) – service credits total € 11,850
- no data lost

why
- the database change looked "online" in review, but it changed a column type, which rebuilds the whole table and locks it
- on our test environment it took 3 min (test data is about 1/40 of production), so nobody saw a lock long enough to matter
- deploys of database changes were allowed at night – exactly when planning runs
- we only alerted on the end result (no plans at 05:00), not on jobs waiting. we could have known at 02:20
- jobs that time out don't restart automatically after the cause goes away

what we're changing (owner, date)
1. no database changes between 20:00 and 06:00 – enforced by the deploy pipeline, not by a rule people remember. Felix. DONE Thu 24 Sep
2. alert when any planning job has waited more than 15 min. Ruth. by Fri 9 Oct
3. test database changes against a full-size copy of production data. Felix. by Fri 30 Oct
4. if a customer's new plan is missing at 05:00, publish yesterday's plan automatically with a clear banner on the tablet, so drivers have something. Noor Hamdi (PM). by Mon 30 Nov – it changes what drivers see, so we'll show it to customers first
5. status page + customer email within 15 min of a page, from a template. Sanne. DONE Fri 25 Sep

what we're not changing
- the 05:00 publish target stays the same

apology – plain, one line: we're sorry. your crews started late because of a change we made, and that's on us.
```
