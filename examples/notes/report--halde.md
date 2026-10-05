# report--halde: raw notes and prompt

Output: [`documents/report--halde.html`](../documents/report--halde.html). Generated
2026-10-05 by `claude -p --model opus` (claude-opus-5-5) with the letterhead
plugin loaded from this repo; the HTML is unedited.

## Prompt (verbatim)

> Next: the write-up of our survey of the Mulder house in Haarlem, for Priya and Daan Mulder, from my notes in notes/survey--halde.md. Make it a single self-contained HTML file on our letterhead (the halde brand), using the report template in the gazette style. Save it as report--halde.html. I am not available to answer questions during this run: I approve in advance the shape you propose, so do not wait for my confirmation. Just go.

Turn 2 of the halde session of the regeneration run (`--resume` of the previous turn). The taught `halde` profile (`examples/brands/halde/`, without `site.html`) was placed in `.letterhead/brands/halde/` of the run directory beforehand, so no turn taught a brand. The notes were in the run directory as `notes/survey--halde.md`.

## Raw notes (verbatim, as given to the model)

```text
# survey findings – Mulder house, Haarlem (notes)

clients: Priya and Daan Mulder. bought a 1932 semi-detached house in Haarlem-Noord (Kleverpark), 168 m² over 3 floors, key handover was 1 Sep. they asked us to design the renovation + a kitchen extension at the back.
survey: Tue 29 Sep 2026, Liv Halde + Daan Visser (us) + Joost van Eck (Van Eck Bouw, the builder we work with most). 4 hours.
write-up date: Fri 2 Oct 2026. for Priya + Daan, so they can decide what goes in the design brief.
their budget for the works: € 240,000 (not counting our fee, not counting furniture)

what we found
1. damp in the front bay (living room, ground floor)
   - moisture readings 22–28% in the lower 60 cm of the bay wall (dry wall here would be under 15%)
   - cause most likely: blocked air bricks + a garden bed against the facade, soil above the damp course
   - fix: clear the air bricks, lower the bed, let it dry a winter, then re-plaster with lime. € 4,500 – 7,000
2. ground floor is suspended timber over a crawl space
   - 2 joists at the front rotten at the ends (where the damp is), rest sound
   - crawl space ventilation blocked on 3 of 5 vents
   - fix: replace/splice 2 joists, open vents, insulate under the floor while we're there. € 6,000 – 9,000 (insulation would be needed anyway)
3. electrics
   - 1970s fuse box, 6 groups, no earth in 3 rooms, cloth-covered wiring in the attic
   - needs a full rewire, not optional, and best done before any plastering. € 14,000 – 18,000
4. possible asbestos
   - flat sheet panel in the boiler cupboard + floor tiles under the carpet in the back room (look like 1960s vinyl tiles)
   - test booked Wed 7 Oct (€ 450), results in ~10 working days -> around Wed 21 Oct
   - if positive: certified removal, € 3,000 – 8,000 depending on what and how much
5. windows
   - the leaded stained-glass top lights (glas-in-lood) in the front are original and in good shape. keep. inner secondary glazing for heat + noise, € 3,800
   - rear windows are 1990s double glazing, fine
6. loft
   - ridge height 2.10 m in the middle, floor is boards over joists
   - a study up there is possible, but a proper stair would take ~1.2 m² off the smallest bedroom
   - loft conversion rough cost € 28,000 – 36,000 (stair, insulation, dormer at the back, window)
7. kitchen extension at the back
   - garden is 14 m deep, extension of 3.5–4 m deep across the width is probably permit-free (rear, ground floor) – to confirm with the municipality, Joost has done several in Haarlem
   - rough cost € 85,000 – 110,000 incl. new kitchen

what it adds up to
- necessary works (1 + 2 + 3, + 4 if positive, + window glazing): roughly € 28,000 – 46,000 before any of their wishes (low end = no asbestos)
- extension: € 85,000 – 110,000
- loft: € 28,000 – 36,000
- extension + necessary works fits the € 240k with room for the rest of the house (bathroom, floors, paint). adding the loft gets tight, at the top of the ranges it doesn't fit

our advice
- do the necessary works first, whatever else they decide. the rewire and the damp come before any finishing
- design the extension now
- keep the loft as phase 2: design it so the stair position is reserved, build it later
- decide by Fri 16 Oct whether the loft is in the brief or phase 2, so we can start the concept on Mon 19 Oct

next steps
- Wed 7 Oct asbestos test (Van Eck arranges, someone needs to let them in – Priya?)
- ~Wed 21 Oct test results
- Fri 16 Oct their decision on the loft
- we ask the municipality about the extension (Daan, this week)
```
