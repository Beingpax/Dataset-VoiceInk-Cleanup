# Dataset Generator: Project Summary

## Active specification

[README.md](README.md) is the concise source of truth for future authoring.

## Current scope

- Text-only ASR cleanup under `polished-clean-v1`, not speech recognition, summarization, or answering the dictated request.
- Current generator collection: 5,000-pair authoring run in progress; drafts are not accepted until foreground review. The previous 180 pairs remain removed.
- Approved target: 5,000 synthetic, AI-reviewed pairs in 50 batches. Do not describe unfinished batches as complete or human-reviewed.
- Record-type target: 500 single-principal-error (10%), 4,250 natural multi-error (85%), and 250 unchanged (5%).
- The agreed 5,000-pair category allocation is 750 fillers, 750 repetition/stutters, 500 local repairs, 750 punctuation/dictated formatting, 500 lists, 625 email layout, 625 entity normalization, 250 context-inferred quotation, and 250 unchanged. This does not rebalance the benchmark. Target approximately 500 extended inputs.

## Authoring decisions

- Everyday communication comes first: roughly 50% general conversation, personal/business emails, and correspondence; around 30–35% software engineering, engineering, and technical scenarios; the remaining roughly 15–20% medical/legal/financial scenarios combined. These are flexible planning ideas, not hard quotas. Scenario weighting is separate from error-category allocation and does not rebalance the benchmark.
- Nine categories for future generation: fillers; repetition/stutters; brief false starts/immediate corrections; punctuation/capitalization/dictated formatting; lists; email layout; entity normalization; context-inferred quotation; already correct. The separate benchmark retains its current category assignments.
- Each pair has one category and multiple actual error labels. Domain, scenario, length, and difficulty are separate dimensions.
- Email layout means greeting, body, and sign-off, not email-address normalization. Filename and URL handling are incidental, not generation quotas.
- Remove filler uses of “basically,” “actually,” “like,” and “I mean.” Preserve meaningful clarification and ordinary lexical uses. Conversational “like” before a number is removed under this policy; explicit “about” or “roughly” remains.
- Keep ASR input plausible: correct, partial, and missing punctuation/capitalization all occur across categories. Never strip them systematically or manufacture keyword templates.
- Every future raw input must contain 20–200 whitespace-separated words inclusive, including no-change records, without artificial padding. Cleaned outputs have no minimum. Preserve length variety, the 30+ word coverage rule, and the extended-length coverage target.
- False starts are one brief unfinished phrase immediately repaired, not chained restarts or complete rejected claims. Self-corrections stay explicit and local.
- Infer paragraphs from meaningful discourse changes in shorter and longer passages without requiring spoken commands. Length alone does not determine paragraph breaks. Distinguish punctuation restoration, spoken punctuation commands, and literal words such as “period.” Quotation commands are supported occasionally.
- Context-inferred quotation adds double quotes around clearly identified phrases, speech, labels, or messages without spoken quote commands. Textual evidence must identify the span; emphasis alone does not justify quotes or other decoration.
- Entity normalization includes currency, units/measurements, percentages, dates/times, numbers, names, acronyms, technical terms, and physical/email addresses.
- Lists and emails preserve complete substantive wording. Do not invent headings, greetings, signatures, or list content; do not summarize full statements into labels.
- No-change input and target are identical. Preserve intentional emphasis, uncertainty, and supported names/numbers; do not guess corrections from unavailable context.
- For this run, review every pair in the foreground and record acceptance against the batch content hash. Run mechanical checks for schema, counts, word bounds, duplicates, and distributions. Correct failures and recheck. Generated drafts are not human-reviewed gold data.
- Keep privacy, provenance, licensing, versioning, and split-leakage safeguards. Training and evaluation are separate workflows described in the README.

## Data and viewer

All eight JSONL files belonging to the previous 180-pair generator collection (combined files, component files, and public copies) have been removed.

The React JSONL Viewer at `#/viewer` now defaults to `public/data/benchmark-sample.jsonl`, containing the unchanged 100 labeled benchmark cases. Their archived sources and benchmark results remain intact. Future generated files can be opened through the local JSONL picker.

The viewer offers a count-sorted Category selector, multi-select error checkboxes with any/all matching, a horizontal record selector, and side-by-side transcripts. The generator page is at `#/generator`. Older static pages remain historical artifacts.

The generator README remains the active specification for future creation; removing the old collection does not change those rules.
