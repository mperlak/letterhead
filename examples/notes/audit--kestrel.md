# audit--kestrel: raw notes and prompt

Output: [`documents/audit--kestrel.html`](../documents/audit--kestrel.html). Generated
2026-10-06 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Gemeente Westerhaven asked us to review their Kestrel setup before the missed-collection pilot opens the tenant to their meldingen system. Write up what I found, from my notes in notes/audit--kestrel.md, as a single self-contained HTML file on our own letterhead (the kestrel brand). It goes to Marloes Janssen, her security officer and Kees Brouwer at ReinNet. Save it as audit--kestrel.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 1 of a fresh kestrel session, separate from the regeneration run (same flags). The taught `kestrel` profile (`examples/brands/kestrel/`, without `site.html`) was placed in `.letterhead/brands/kestrel/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/audit--kestrel.md`. The prompt names neither the template nor a style: the agent picked `audit` and the profile's base style (engineering).

## Raw notes (verbatim, as given to the model)

```text
# westerhaven – access + integration review before the missed-collection pilot (my notes)

who asked: Marloes Janssen (head of waste ops, Gemeente Westerhaven). she wants it before the pilot opens the tenant to the meldingen system, and her security officer (Lars Veldhuis) wants something to file against the contract
who else reads: Kees Brouwer (ReinNet dispatch lead) – he owns the ReinNet side of the fixes
me: Ruth Okafor (SRE). did it Tue 13 + Wed 14 Oct 2026, write-up going out Thu 15 Oct
subject: the Westerhaven tenant (prod, 14 trucks, 31 planner/dispatcher users) on Kestrel 4.3, plus the 3 systems that talk to it: ReinNet fleet connector (GPS/lift events), the meldingen system webhook (staging only so far), ReinNet's own dispatch dashboard
bar: Annex C of the Westerhaven contract (information security requirements for suppliers, version 2.1, 12 requirements C1–C12) + our integration guide 4.3 (webhook + API key rules). not a pentest, nobody attacked anything. config and log review, a read-only look at the ReinNet side with Kees on screen share

NOT looked at (say so): Westerhaven's own meldingen system internals, the municipal app, the tablets' OS hardening (ReinNet's MDM), physical security of the depot, anything in other tenants. also did not test the "return stop" feature itself – it doesn't exist yet

what I found, roughly worst first

1. one API key (name: "reinnet-shared") is used by THREE things: fleet connector, ReinNet dashboard, and Kees's own excel macro that pulls the plan every morning. scope = read+write on routes and stops. created 14 Feb 2025, never rotated, last 30 days: 41,000 calls from 3 IPs. Annex C7 says a key per system, least privilege, rotated at least yearly. the macro doesn't need write at all. also the key sits in plain text in a shared sheet on ReinNet's SharePoint (Kees showed me, ~20 people can open it). this one I'd call critical – anyone with the sheet can rewrite tomorrow's route.
2. 7 of 31 user accounts belong to people who left ReinNet or the municipality (last login between Feb 2025 and Mar 2026). 2 of the 7 are role "planner admin" (can edit routes and add users). Annex C4: accounts removed within 5 working days of leaving. they have no process to tell us. major – nobody has logged in with them since but one of them has an active password reset email pending? no: checked, no pending reset. fine
3. no MFA on the planner admin role (all 5 admins). we support TOTP, it's just not switched on for the tenant. C9 says MFA for admin access. major
4. ReinNet's webhook receiver for plan-published events checks the OLD header (X-Kestrel-Signature, SHA-1) only. the new Kestrel-Signature header (SHA-256) shipped in 4.3, old one is dropped Mon 30 Nov. so after 30 Nov their receiver rejects every event (or, worse, if someone "fixes" it by turning the check off...). Kees says it's a 5-line change. major, with a date on it
5. fleet connector still calls /v1/routes and /v1/stops (v1 removed Mon 30 Nov – we've told them, they haven't scheduled it). major for the same reason, it's more of an availability finding than security but it's in the integration guide so I'm counting it. hmm – put 4 and 5 together? no, different owners inside ReinNet (4 = Kees's dashboard dev Bram, 5 = the fleet vendor). keep separate
6. staging webhook endpoint of the meldingen system (the one we'll use for pilot testing) accepts requests without a signature – we ask for HMAC but their staging doesn't enforce on their side, i.e. THEY send unsigned and OUR staging accepted them. found because our staging has the "allow unsigned" flag on. prod flag is off, checked. so: minor but must be off before pilot. fix: turn flag off, they must sign. owner: me + their integrator (Joost at the municipality's supplier)
7. plan exports (CSV) from the planner: download links are valid 7 days and not tied to a user. 3 links from the last 30 days were opened from IPs outside NL (checked with Kees: 2 are Kees on holiday in Portugal, 1 unexplained – a Kestrel IP? no, not ours. 1 unexplained.) the exports contain addresses + container types, no resident names. minor, but the unexplained one should be run down. proposal: link lifetime 24 h + login required
8. audit log retention on the tenant is 90 days (default) – Annex C11 wants 12 months. we can raise it, costs nothing for them. minor

things that were fine (list them, they should know what was checked)
- prod webhook endpoint of the meldingen system doesn't exist yet so nothing to check... skip. BUT: our outgoing webhooks to ReinNet's dashboard go over TLS 1.2+ only, cert valid till Mar 2027 – ok (C6)
- role model: viewer / dispatcher / planner / planner admin – 31 users, no one has more than they need except the 2 stale admins above (checked the 24 active ones against Kees's list of who does what) – ok (C5)
- audit log is on and records user, action, IP for plan edits and user changes – ok (C10)
- payloads contain no resident personal data: sample of 200 events, only BAG address id, container type, report id (C2, C3) – ok
- GPS traces kept 90 days, lift photos 30 days, matches the contract (C3) – ok
- data stays in EU-West (C1) – ok
- backups encrypted + restore tested in Aug (that's ours, the tenant is covered by our standard test) (C12) – ok
- C8 (incident notification within 24 h) – nothing technical to check, they know the contact. n/a
so 12 criteria: 6 pass cleanly (C1, C2, C3, C6, C10, C12), C5 pass with the stale-admin finding counted under C4, C8 n/a, failing: C4, C7, C9, C11 + the two integration-guide ones (no Annex number)... hmm. don't over-count, just give the table by finding

severity scale: critical = lets someone outside the people who should have access change or read operational data, or can be exploited today. major = breaks the contract bar or will break in production on a known date. minor = deviates from the bar but low exposure / easy.
so: 1 critical (finding 1), 4 major (2,3,4,5), 3 minor (6,7,8)

overall: does NOT meet Annex C v2.1 today. fixable before pilot start Mon 11 Jan 2027 – none of it is big. I'd say: pilot can go ahead IF the critical is fixed before the connection to the meldingen system is opened and the majors by the dates below

fixes / owners / dates (suggested, Kees has seen the list, Lars hasn't)
1. issue 3 keys (connector, dashboard, macro: read-only), rotate, delete reinnet-shared, take the key out of the sheet. Kees + Bram. by Fri 23 Oct. effort: half a day. we (Ruth) create the keys on request same day
2. remove the 7 accounts, agree a leavers process (ReinNet HR mail to support@ when someone leaves). I remove now once Kees confirms the list in writing. Kees. by Fri 16 Oct for the removal; process by Fri 6 Nov
3. switch on TOTP for planner admins. Ruth does the tenant setting, the 5 admins enrol. by Fri 30 Oct
4. webhook receiver: verify Kestrel-Signature (SHA-256). Bram. by Fri 13 Nov (so we have 2 weeks buffer before 30 Nov). I can send test events to their staging any day
5. move the fleet connector to /v2. Kees to push the fleet vendor. by Fri 20 Nov. if the vendor says no: tell me by 6 Nov and we figure out a shim, but I don't want to write that
6. turn off "allow unsigned" on staging, meldingen supplier signs their staging calls. Ruth + Joost. by Fri 4 Dec (before pilot integration testing in Dec)
7. export links: 24 h + login. Ruth (config). by Fri 30 Oct. and the one odd download: Ruth looks through the access log + asks Kees who might have used that link – by Fri 23 Oct
8. audit log to 12 months: Ruth, today, 5 min. do it Thu 15 Oct

retest: I re-check everything Mon 7 Dec 2026 (all fixes should be in), then the document is re-issued as a clean version for Lars to file. earlier retest for finding 1 on Mon 26 Oct
```
