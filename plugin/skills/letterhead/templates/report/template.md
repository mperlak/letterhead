---
name: Report
description: Findings from work already done: what was examined, what was found, what it means, and what to do about it.
---

# Report

## Use when

Work happened (research, analysis, an investigation, a measurement period)
and the reader needs its results with enough evidence to trust them and act
on them. The reader's questions are "what did you find" and "what should we
do".

## Do not use when

The document argues for future work; that is a proposal. It assesses
against a defined set of criteria with severities; that is an audit. It
recurs weekly on a running project; that is a status update. It closes a
project; that is a project recap.

## Structure

1. **Header:** title, one-line subtitle naming what was examined, labeled
   metadata (period or dataset covered, author, audience, date).
2. **Summary of findings:** the two to four findings that matter, each in
   one sentence, plus the single recommended action if one dominates. The
   busy reader stops here and is fine.
3. **What was examined and how:** scope of the work and method, short. It
   exists so the reader can judge how much to trust the findings, not to
   showcase effort.
4. **Findings.** One section per finding. Each carries: the claim, the
   evidence (numbers, examples, quotes — whatever the work produced), and
   the implication. Findings are ordered by importance to the reader, not
   by the order they were discovered.
5. **Recommendations:** what to do, each tied to the finding it follows
   from, each with an owner or next step when the source names one.
6. **Appendix material** (only when needed): the full table, the method
   detail, the raw list. Below everything, clearly secondary.

## Creation guidance

Every number in the report has a source in the examined material. Charts
and tables appear when the finding is quantitative; a finding carried by
one number can state it inline in prose. Negative results (nothing found,
hypothesis not confirmed) are findings too and are reported plainly.

## Hierarchy contract

The summary of findings is the strongest block after the title. Within a
finding, the claim leads and the evidence supports; evidence never opens a
section. Recommendations read as a compact actionable list, not an essay.

## Mobile contract

First two phone screens: title, metadata, complete summary of findings.
Evidence tables scroll in their own container; a chart that cannot be read
at phone width is replaced by the number it was carrying plus a labeled
table.

## Review contract

Stable ids per SKILL.md § Review-ready contract. Each finding and each
recommendation is its own anchor point, so a reviewer can dispute one
finding's evidence without the comment floating over the whole document.

## Failure modes

**Method theater.** Three screens of methodology before the first finding.
The reader came for findings; method is one honest paragraph.

**Claims without evidence.** A finding stated with nothing behind it reads
as opinion. If the evidence is weak, say how weak; confidence labeling
beats confidence acting.

**Chronological dump.** Findings ordered by when the work happened instead
of what matters most. The reader's priority wins.

**Recommendation drift.** Advice that follows from no finding in the
document. Every recommendation cites its finding; anything else is a
different document.

**Fake precision.** "37.4% improvement" from a sample of five. Round to
what the data supports and show the base.
