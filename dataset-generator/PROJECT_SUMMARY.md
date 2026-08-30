# Project Summary

## Purpose

This project defines and demonstrates an instruction fine-tuning dataset for cleaning raw ASR transcripts with an LLM. The model receives imperfect dictated text and returns one final polished transcript while preserving the speaker's meaning, intent, tone, information, and order.

This is not an audio-model or ASR-model fine-tuning project. It focuses only on the downstream text-cleanup model.

## Decisions made

- Current generation priorities: everyday emails, messages, updates, and technical dictation; predominantly fillers, repetition/stutters, and brief local repairs. Other main groups cover punctuation/dictated formatting and combined entity/technical normalization. Filename and open/close-quote examples are not generation targets. Detailed labels remain diagnostic rather than separate quotas. Revised category percentages and a reduced extended-context share await agreement.
- One output style: `polished-clean-v1`.
- Polished means finished writing, not creative rewriting.
- Full-dataset composition: 50% single-principal-error, 45% natural multi-error, and 5% no-change records.
- The 50-example demonstration uses 25, 23, and 2 records respectively because examples cannot be fractional.
- No-change inputs are natural, already-correct ASR outputs and contain no artificial formatting demonstrations.
- Raw ASR presentation is intentionally mixed across every record type: inputs may be correctly punctuated and capitalized, partially punctuated, or unpunctuated. Existing correct punctuation and capitalization are preserved, and those error labels are used only when the target changes them.
- Records include `language`; they do not include `speaker_id`.
- Each record identifies its primary category, all error types, formatting features, source, edit support, and policy version.
- Formatting covers paragraphs, ordered and unordered lists, greetings, sign-offs, quotations, and dictated punctuation commands. Structure is inferred from natural content; artificial commands such as `heading`, `bullet list`, and `numbered list` are prohibited.
- Longer uninterrupted ASR passages are split into multiple paragraphs when genuine topic, purpose, or discourse shifts support the break, without requiring spoken `new line` or `new paragraph` commands. Paragraphs are not created mechanically from length alone, and closely related sentences remain together.
- Formatting is never permission to summarize. Paragraphs, headings, notes, and lists must retain complete substantive statements, including subjects, actions, qualifiers, relationships, and useful detail; full sentences must not be collapsed into telegraphic labels.
- Synthetic raw ASR must remain plausible spoken language. Authors cannot delete subjects, verbs, articles, or connective wording to manufacture keyword streams that force itinerary, checklist, note, or report formatting; genuine source fragments remain permissible when they actually occur.
- Version 1 permits only explicit, local false starts and self-corrections involving a word, name, number, date, time, entity, or short phrase. Paragraph-scale retractions, broad intent reversals, and replacements of one substantive request with another are excluded.
- False-start inputs contain a single brief unfinished phrase with an immediate local repair, not chained restarts or a complete rejected statement. The surrounding request and target detail remain intact.
- At least 20% of each sufficiently populated record type is represented by natural 30-word-or-longer inputs, with long examples spread across cleanup categories.
- Intentional emphasis on a word, name, number, function, or variable is preserved rather than mistaken for disfluency.

## Artifacts created

### `README.md`

The complete research-backed dataset plan, authoring rules, schema, distribution, quality guidance, and sample coverage.

### `sample-50.jsonl`

Fifty independent chat-format training examples. Every line contains a stable ID, the shared system instruction, raw ASR input, polished output, and structured metadata.

### `data/sample-50-additional.jsonl`

A batch expanded in place from 50 to 100 records, retaining its historical filename. It contains exactly 50 single-principal-error, 45 natural multi-error, and 5 no-change pairs, now numbered `sample_081` through `sample_180` within the combined collection.

### `data/curated-180.jsonl`

The combined collection, numbered `sample_001` through `sample_180` in original 50 / additional 30 / additional 100 order. Component files and their public copies use the same IDs. The JSONL Viewer loads `public/data/curated-180.jsonl` as “Curated pairs · 180 pairs.” Benchmark datasets are separate and retain their existing IDs.

### `index.html`

The static project website. It explains the cleanup contract, dataset composition, coverage, artifacts, and links directly to the sample and viewer.

### `jsonl-viewer.html`

A dependency-free, browser-based JSONL reader. It provides content search, metadata filters, sortable and hideable columns, rich formatting, side-by-side review, token-level change highlighting, raw JSON inspection, and keyboard navigation. Files are processed locally in the browser.

### `PRODUCT.md` and `DESIGN.md`

The product intent and quiet-editorial interface direction used to keep the website and viewer consistent.

## Repository scope

The repository contains the dataset, documentation, and website/viewer source. Local models, model weights, checkpoints, caches, and packaged model formats are excluded through `.gitignore`.

## Website use

Open `index.html` to browse the project. Open `jsonl-viewer.html` and choose or drag in `sample-50.jsonl` to inspect the examples. If the folder is served with a local static server, the viewer can load the nearby sample automatically.

No build step or dependency installation is required.
