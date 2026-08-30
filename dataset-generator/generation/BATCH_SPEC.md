# Active 5,000-pair generation contract

Read ../README.md completely. Its cleanup behavior is authoritative. Author genuinely distinct communications, not templates with swapped names/numbers. Never copy benchmark cases or old datasets.

## Batch boundaries

There are 50 batches of 100 records. Batch N owns IDs sample_XXXX from (N−1)×100+1 through N×100, zero-padded to four digits. Save compact draft JSONL to batches/batch-NNN.jsonl. Every line has exactly:

- id: assigned sample ID.
- input: complete raw ASR text, 20–200 whitespace-separated words.
- output: faithful cleaned text.
- category: one README primary-category key.
- type: single_principal_error, natural_multi_error, or no_change.
- errors: array of actual README sub-error keys.
- features: array of applied document structures (paragraphs, ordered_list, unordered_list, email_layout, quotation) or empty.
- domain: general, technical, medical, legal, or financial.
- scenario: concise, specific communication context, not a generic category label.
- presentation: correct, partial, or absent, describing existing sentence punctuation/capitalization in the raw input.

These are compact authoring drafts. The foreground assembler adds the exact README system instruction, canonical messages/metadata, source, generation model, batch, prompt revision, and review provenance. Do not invent review status or claim human review.

## Exact counts per batch

| category | Total | single_principal_error |
|---|---:|---:|
| filler_words | 15 | 2 |
| repetition_stutters | 15 | 2 |
| false_starts_self_corrections | 10 | 1 |
| punctuation_capitalization_dictated_formatting | 15 | 1 |
| list_formatting | 10 | 1 |
| email_formatting | 13 in odd batches; 12 in even | 1 |
| entity_normalization | 12 in odd batches; 13 in even | 1 |
| context_inferred_quotation | 5 | 1 |
| no_change | 5 | 0 |

All remaining changed examples are natural_multi_error: 10 single, 85 multi, 5 unchanged per batch. Single-principal-error means one behavior family; several punctuation marks, or several filler occurrences, do not require a multi label. Multi-error examples must demonstrate at least two real cleanup behaviors, usually two or three. Punctuation incidentally repaired next to a removed filler does not alone justify multi-error.

Plan around 50 general, 35 technical, 5 medical, 5 legal, and 5 financial scenarios per batch. Domain guidance is flexible; prioritize natural content. Medical/legal/financial examples are ordinary correspondence or logistics, never invented professional advice.

Include at least 10 extended inputs of 80–200 words per batch, and at least 40 other inputs of 30–79 words. Spread lengths across categories. At least 20% of each changed category must be 30+ words. Mix correct, partial, and absent ASR presentation, including at least 20 changed inputs whose sentence punctuation/capitalization is already correct. Do not convert all raw inputs to lowercase.

## Essential safeguards

- Preserve substantive wording, order, qualifiers, uncertainty, entities, and intentional repetition/emphasis. Never summarize, answer the dictated request, invent headings, or formally rewrite casual speech.
- Remove filler uses of basically/actually/like/I mean; preserve lexical like and meaningful clarification. Preserve explicit about/roughly approximation.
- Only one short unfinished opening or immediate local word/phrase correction; never retract whole sentences/paragraphs or change intent.
- No telegraphic keyword streams or artificial headings/bullet commands. Lists arise from natural enumeration/steps and retain full content, including transitions when substantive.
- Email greetings and sign-offs must already be in the input. Do not infer recipients or signatures.
- Infer paragraphs at genuine discourse boundaries in both short and long texts. Do not paragraph every sentence or break solely by length.
- Use quotation_formatting only for a clearly delimited phrase/message/label/speech span. Do not insert decorative quotes for emphasis. Explicit open/close-quote commands are occasional, not a dominant pattern.
- Literal words such as period and new line remain literal when context says so.
- Normalize only text-supported values. Never guess AM/PM, acronyms, name spellings, file/identifier casing, or missing digits.
- Email-address normalization uses the historical error key email_formatting; email message layout uses greeting_signoff.
- No-change input/output strings must match exactly; errors must be empty.
- Use plausible fictional names, example.com email addresses if needed, and no private source material.

## Delivery

Write actual independent records using apply_patch. Small writing chunks are fine; do not mark a partial batch complete. You may run non-build mechanical checks for count, quotas, IDs, valid JSON, word bounds, and duplicates. Do not run builds. Notify the foreground agent when the batch is complete, including any uncertainty. Only the foreground agent accepts records after semantic review.
