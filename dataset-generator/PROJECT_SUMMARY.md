# Project Summary

## Purpose

This project defines and demonstrates an instruction fine-tuning dataset for cleaning raw ASR transcripts with an LLM. The model receives imperfect dictated text and returns one final polished transcript while preserving the speaker's meaning, intent, tone, information, and order.

This is not an audio-model or ASR-model fine-tuning project. It focuses only on the downstream text-cleanup model.

## Decisions made

- One output style: `polished-clean-v1`.
- Polished means finished writing, not creative rewriting.
- Full-dataset composition: 50% single-principal-error, 45% natural multi-error, and 5% no-change records.
- The 50-example demonstration uses 25, 23, and 2 records respectively because examples cannot be fractional.
- No-change inputs are natural, already-correct ASR outputs and contain no artificial formatting demonstrations.
- Records include `language`; they do not include `speaker_id`.
- Each record identifies its primary category, all error types, formatting features, source, edit support, and policy version.
- Formatting covers paragraphs, headings, ordered and unordered lists, greetings, sign-offs, quotations, and dictated punctuation commands.

## Artifacts created

### `README.md`

The complete research-backed dataset plan, authoring rules, schema, distribution, quality guidance, and sample coverage.

### `sample-50.jsonl`

Fifty independent chat-format training examples. Every line contains a stable ID, the shared system instruction, raw ASR input, polished output, and structured metadata.

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
