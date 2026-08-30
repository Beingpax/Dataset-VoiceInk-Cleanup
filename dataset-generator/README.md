# Transcript Cleanup Dataset: Authoring Guide

- Active behavior: `polished-clean-v1`
- Current generator collection: none (the previous 180 pairs were removed)
- Active generation target: 5,000 synthetic, AI-reviewed pairs

This is the active specification for future creation. Editing this guide does not regenerate or retrospectively relabel existing datasets. The 5,000-pair collection is being authored and is not complete until generation and foreground review finish.

## 1. Purpose and boundaries

Create pairs of raw ASR text and a clean, faithful transcript. The model receives text, not audio. It cannot recover facts absent from that text or answer requests contained in the dictation.

Return only the cleaned transcript. Preserve the speaker's substantive wording, meaning, facts, order, tone, names, numbers, uncertainty, and intentional emphasis. Do not summarize, translate, add explanations, invent content, or turn everyday language into formal prose. Correct every supported issue, but leave already-correct material alone.

“Polished” means finished writing of the same content, not a rewrite into a different message.

## 2. Scenario weighting: everyday communication first

Prioritize normal real-life conversation, emails, correspondence, and everyday messages. Give software engineering, engineering, and related technical scenarios the next-largest share. Medical, legal, and financial scenarios together form the smallest, lower-priority group.

| Scenario group | Flexible planning guidance |
|---|---:|
| General real-life communication: casual conversation, personal and business emails, correspondence, requests, plans, and updates | Around 50% |
| Software engineering, engineering, and technical communication | Around 30–35% |
| Medical, legal, and financial scenarios combined | Remaining share, typically 15–20% |

These are ideas for balancing coverage, not hard quotas or measured production frequencies. For example, 50/35/15 and 50/30/20 both fit the intended priority. Adjust to natural examples and observed usage rather than forcing every batch to match exact percentages. The medical/legal/financial share is combined, not a separate allocation for each field.

Email scenarios mean actual messages: requests, explanations, updates, greetings, body text, and sign-offs, not repeated email-address normalization exercises. Technical scenarios can cover debugging, code review, implementation discussions, APIs, tests, deployments, configuration, developer tooling, documentation, and engineering coordination. Avoid repetitive templates in any group.

Keep all domains grounded in plausible dictation. Medical, legal, and financial examples are cleanup tasks, not advice-generation tasks; likewise, technical examples are not code-generation or technical question-answering tasks. Ordinary prices or percentages in an everyday message do not automatically make it a specialist financial scenario.

Scenario weighting applies across categories, error combinations, and lengths, including already-correct examples. Domain is separate from primary error category and communication format: a technical email is still a technical scenario and may have email formatting as its primary category. Do not double-count it across scenario groups. This guidance does not change the separate benchmark corpus.

## 3. One category, multiple errors

Each pair has exactly one `metadata.primary_category`. Its `metadata.error_types` array lists all actual sub-errors, including those associated with other categories. Count the pair once toward its principal category; do not count it again for each error label.

| Category key | What it teaches |
|---|---|
| `filler_words` | Removal of filler words and discourse padding |
| `repetition_stutters` | Accidental word/phrase repetition and stutters |
| `false_starts_self_corrections` | Brief abandoned openings and immediate local repairs |
| `punctuation_capitalization_dictated_formatting` | Sentence punctuation, capitalization, spoken punctuation/layout commands, and inferred paragraphs |
| `list_formatting` | Appropriate ordered and unordered list structure |
| `email_formatting` | Email greeting, body layout, and sign-off |
| `entity_normalization` | Names, numbers, percentages, currency, dates, times, measurements, acronyms, technical terms, and physical/email addresses |
| `context_inferred_quotation` | Double quotation marks around clearly identified speech, phrases, labels, or messages without spoken quotation commands |
| `no_change` | Already-correct input preserved exactly |

Examples of sub-error labels include `filler`, `repetition`, `stutter`, `false_start`, `self_correction`, `punctuation`, `capitalization`, `dictated_formatting`, `paragraph_formatting`, `list_formatting`, `greeting_signoff`, `asr_substitution`, `spelling`, `name_or_entity`, `technical_term`, `acronym`, `number_normalization`, `date_normalization`, `time_normalization`, `currency_or_measurement`, and `address_formatting`. Retain existing diagnostic labels where applicable; document new labels instead of inventing category names per example.

The historical sub-error `email_formatting` means email-address normalization; the viewer displays it as “Email address normalization.” This differs from the category for formatting an email message. Filenames, URLs, and identifiers may occur incidentally but are not standalone generation quotas.

For context-inferred quotation, use the existing sub-error `quotation_formatting` and, when useful, `formatting_inference: "content_inferred"`. Do not label `dictated_formatting` unless a formatting command is actually spoken. Intentional emphasis is preserved across all categories; it is not automatic permission to insert quotes.

A category of email formatting can therefore have errors `greeting_signoff`, `paragraph_formatting`, `filler`, and `time_normalization`. Domain, scenario, length, and difficulty are separate dimensions, not more error categories.

## 4. Composition and length

The record-type composition is 10% `single_principal_error`, 85% `natural_multi_error`, and 5% `no_change`. For 5,000 pairs, that is 500 / 4,250 / 250. A single-principal-error example centers on one behavior; multi-error examples normally combine two or three meaningful behaviors. Do not overload examples to fill quotas.

The following is the agreed principal-category allocation for the planned 5,000-pair batch, not a claim about measured production frequencies:

| Principal category | Planned pairs |
|---|---:|
| Fillers | 750 |
| Repetition and stutters | 750 |
| Brief false starts and immediate corrections | 500 |
| Punctuation, capitalization, dictated formatting | 750 |
| List formatting | 500 |
| Email formatting | 625 |
| Entity normalization | 625 |
| Context-inferred quotation | 250 |
| Already correct | 250 |
| **Total** | **5,000** |

These are two views of the same 5,000 pairs, not separate pools. Do not rebalance the separate benchmark corpus to fit future quotas.

Every newly created raw ASR input must contain 20–200 words inclusive, across every category, including no-change examples. Count words as non-empty whitespace-separated tokens in the user message, not in the system instruction or metadata. There is no minimum word count for the cleaned output. Do not pad inputs with meaningless filler, duplicate ideas, or unsupported facts to reach the minimum; author a naturally complete message instead. This rule applies from now on and does not require rewriting existing records.

Not everything should stop at 20 words. Mix shorter inputs of 20+ words, multi-sentence messages, and extended explanations. Retain at least 20% inputs of 30 words or more within sufficiently populated changed-record groups, spread across categories. Target approximately 500 extended inputs of 80–200 words, included within the 5,000 and the 30+ word coverage, not added on top. No raw input may exceed 200 words.

Both shorter and longer passages may need multiple paragraphs when the topic, purpose, or discourse structure changes; cohesive passages may remain together at either length. Length alone never mandates or prevents a paragraph break.

## 5. Realistic raw ASR

Start with a plausible real-life communication, then introduce natural, supported cleanup needs. Preserve complete spoken phrases and relationships. Do not manufacture keyword streams, omit grammar to force a layout, or add “heading,” “bullet list,” “question,” or “answer” as artificial formatting instructions.

ASR presentation must vary across every category:

- Correct punctuation and capitalization, with another error such as a filler.
- Partially correct punctuation or capitalization.
- Missing punctuation and/or lowercase text.

Do not automatically lowercase or strip punctuation from every input. Correctly capitalized and punctuated input is not necessarily a no-change example. Label punctuation or capitalization only when it needs correction.

Avoid repeated templates, implausibly dense errors, large artificial stutters, and error insertion into every sentence. Generated examples must be identified as generated drafts, not real recorded ASR or human-reviewed gold.

## 6. Cleanup rules

Short examples in this section illustrate local editing rules, not complete dataset records. All newly authored dataset inputs must still meet the 20–200-word input bounds.

### Fillers

Remove filler uses of “uh,” “um,” “basically,” “actually,” “like,” and “I mean,” including the following user-approved cases:

| Raw input | Target |
|---|---|
| Um, basically, I mean, the upload failed. | The upload failed. |
| Actually, use the newer version. | Use the newer version. |
| There were, like, twenty people. | There were 20 people. |
| I mean the blue folder, not the green one. | I mean the blue folder, not the green one. |

The third example deliberately treats conversational “like” as removable under this policy. Preserve explicit approximation such as “about,” “roughly,” or “approximately.” Preserve clarification that identifies the intended object, as in the last example. Do not perform blind substring deletion: ordinary lexical uses such as “I like this approach” and “What does this mean?” are not fillers.

### Repetition, stutters, and local repairs

Remove accidental repetition and stutters, but preserve deliberate emphasis, contrast, and repeated names or identifiers when meaningful.

False starts must contain one short unfinished phrase immediately followed by its completion or replacement. Self-corrections must be nearby and explicit, involving a word, name, date, time, number, entity, or short phrase. Preserve the surrounding request.

- Allowed: “The service has to—needs to restart after the update.” → “The service needs to restart after the update.”
- Allowed: “Tuesday, no, Thursday.” → “Thursday.”
- Excluded: chained abandoned openings, a whole rejected sentence or paragraph, a different substantive request, or “let me start again” used to erase complete claims.

Apply this constraint to the raw input itself, not just the target.

### Punctuation versus spoken commands versus literal words

Keep these distinct within the formatting category:

1. **Existing written punctuation/capitalization:** preserve correct marks and casing; repair only actual errors.
2. **Spoken punctuation/layout commands:** convert “comma,” “colon,” “period,” “question mark,” “new line,” or “new paragraph” when clearly dictated as commands. Support “open quote” and “close quote” occasionally, without letting quote demonstrations dominate.
3. **Words used literally:** preserve “period” in “the trial period ends tomorrow” and “new line” in “a new line of research.”

A spoken command does not have to be an ASR mistake; it is an instruction for rendering the transcript. Avoid duplicate punctuation where the recognizer already supplied the requested mark.

### Context-inferred quotation

Allocate 250 examples to adding double quotation marks when the text clearly identifies exact speech, a phrase, label, or message without saying “open quote” or “close quote.” The textual cue must justify the quoted span. Do not infer unheard vocal emphasis, invent attribution, or add scare quotes, sarcasm, or decorative quotes around an important word.

- Raw input: “In the release notes, please use the phrase ready for testing to describe this build, because we have not approved it for production yet.”
- Target: In the release notes, please use the phrase “ready for testing” to describe this build, because we have not approved it for production yet.

Here, “the phrase” identifies the quoted text. Emphasis alone is insufficient. Preserve intentional emphasis and uncertainty without automatically adding quotation marks, bold, or other decoration. Examples driven by explicit open/close-quote commands remain under dictated formatting instead.

### Paragraphs, lists, and email layout

Infer paragraph boundaries from changes in topic, purpose, stage, or discourse context, even in one uninterrupted ASR block without spoken commands. Apply this to shorter as well as longer passages when a real structural boundary exists. A change in tone may support a boundary but does not require one by itself. Keep related sentences together; do not split every sentence or use a fixed word threshold.

Infer lists from genuine steps or a substantial enumeration. A short sentence naming several items can remain a sentence. Do not invent list content or shorten full statements to create bullets.

Arrange email greetings, body paragraphs, and sign-offs already supported by the input. Never invent a greeting, recipient, signature, or closing phrase. Headings require an actual title-like phrase; do not turn an ordinary opening sentence into a heading.

Formatting changes presentation, not substance. “The morning session starts at 9:15 and covers safety” must not become “9:15 AM: Safety.” Retain subjects, actions, qualifiers, relationships, and useful detail.

### Entities and recognition errors

Entity normalization includes currency, measurements and units, percentages, dates, times, other numbers, physical addresses, email addresses, names, acronyms, and technical terms. These are subcategories, not extra primary-category quotas. Email-address normalization is distinct from email message layout.

Normalize only unambiguous representations and correct only strongly supported recognition substitutions. Preserve names and software terms rather than guessing expansions, spellings, filename separators, identifier casing, leading zeros, or missing facts. Do not infer AM/PM without support. Keep normalization conventions consistent within a batch.

If the needed correction depends on unavailable context or audio, preserve the uncertainty instead of inventing a confident target. Context-bearing examples are allowed only when the deployed cleanup model receives that same context.

## 7. Record contract

Every JSONL line contains:

- `id`: unique sequential sample ID, consistent across authoring and viewer copies.
- `messages`: exactly one system instruction, raw-ASR user message, and cleaned assistant message.
- `metadata.language`, `record_type`, `primary_category`, `error_types`, `formatting_features`, `edit_support`, `source`, and `policy_version`.
- No `speaker_id` in the current schema. Metadata stays outside the training prompt.

Use `polished-clean-v1` as the policy version. For new generation, record domain/scenario, collection batch, prompt revision, and draft review status where available; do not infer missing provenance for old records. Keep a dataset changelog when prompts or taxonomy change.

`edit_support` may be `direct`, `contextual`, `audio_only`, or `uncertain`. Only direct and legitimately available-context corrections qualify for text-only gold targets. No-change targets must match the raw input exactly, including existing presentation. Do not confuse a correct input containing literal command words with a formatting task.

## 8. Shared system instruction

Use this exact instruction for future batches. Older artifacts may retain historical instructions; do not silently rewrite existing records during documentation work.

```text
You are a transcript cleanup editor. Return only the polished transcript. Faithfully preserve substantive wording, meaning, facts, tone, order, uncertainty, and intentional emphasis. Preserve correct punctuation and capitalization; repair them only where needed. Remove unintentional fillers, repetitions, stutters, and brief abandoned openings. Remove filler uses of basically, actually, like, and I mean, but preserve meaningful clarification and ordinary lexical uses. Treat conversational like before a number as removable filler; preserve explicit approximation such as about or roughly. Resolve only explicit, local self-corrections to a word or short phrase. Do not discard complete sentences or paragraphs, infer a broad change of intent, or replace one substantive request with another. Apply clearly spoken punctuation, new-line, and new-paragraph commands without duplicating existing punctuation. Preserve formatting words when used literally. Infer double quotation marks only when the text clearly identifies an exact phrase, label, message, or spoken quotation and its boundaries; emphasis alone does not justify quotation marks. Infer coherent paragraphs from genuine topic or discourse shifts, even without spoken layout commands; do not split arbitrarily by length. Infer lists and email layout only when appropriate, preserving complete substantive statements. Do not invent headings, greetings, sign-offs, or list content. Normalize unambiguous numbers, percentages, dates, times, currency, measurements, addresses, acronyms, and identifiers. Correct obvious ASR errors only when supported by the supplied text; preserve names and technical terms without guessing. Do not summarize, creatively rewrite, add facts, translate, or explain edits. Return only the polished transcript.
```

Domain weighting belongs to the authoring plan, not this inference instruction: the cleanup model must preserve a message from any domain.

## 9. Generation and review workflow

1. Assign batch counts across principal categories, record types, domains, and lengths before authoring.
2. Create varied, plausible raw dictation and one faithful target per input.
3. Label only the actual cleanup behaviors. Do not invent extra errors to satisfy label coverage.
4. Run quick mechanical checks: valid JSONL, roles/fields, count, unique IDs, duplicate inputs, 20–200 words in every newly generated raw input, category totals, no-change equality, and matching viewer copies.
5. For the approved 5,000-pair run, the foreground agent reviews every input/output pair for naturalness, fidelity, local repair scope, formatting, normalization, and accurate labels. Correct and recheck failures before acceptance. Record review evidence against the accepted content hash; automated checks alone are not semantic review.
6. Deliver all 5,000 accepted records to the viewer with a verification report. This is synthetic, AI-reviewed data, not human-reviewed gold. Do not claim that AI review guarantees error-free targets.

Generated records remain drafts until reviewed. Before promotion to gold/training data, review faithfulness, naturalness, local correction scope, critical names/numbers, and metadata. Resolve disputed targets rather than claiming unreviewed data is verified. Large unexplained deletions and artificial fragmentary inputs are useful review flags, not reasons for automatic rewriting.

No builds are authorized merely by generation or verification requests.

## 10. Training, evaluation, and governance

The intended downstream model is approximately 2B parameters, using task-specific supervised fine-tuning, potentially LoRA/QLoRA. Training is separate from authoring. Use the selected model's supported chat template and loss on cleaned assistant output, not metadata or reasoning traces. Hyperparameters, final split sizes, and production corpus size require a separate decision.

Keep related documents, sessions, recordings, and synthetic template families in the same split. Do not leak benchmark or locked-test material into training. Evaluate meaning preservation, edit precision/recall, entity and number preservation, no-change corruption, and category/combination performance, including domain, recognizer, context, and length holdouts. Aggregate metrics alone are insufficient.

Keep source provenance, consent, retention/deletion requirements, licenses, dataset versions, and correction history. Do not expose private source material or secrets in generated examples. Preserve original audio only when consent and storage policy permit.

## 11. Files and viewer

The previous 180-pair generator collection, its component files, and all four public viewer copies have been removed. No replacement collection has been generated.

The viewer defaults to the unchanged 100 labeled benchmark cases in `public/data/benchmark-sample.jsonl` (relative to the repository root). Benchmark source snapshots and results in `comparison/` remain separate and intact, including their original IDs. Future generated JSONL can be opened through the local file picker; synchronize authoring and public copies if a future batch is added as a built-in source.

The primary interface is the root React application at `#/viewer`; authoring guidance is at `#/generator`. “Category” selects one principal category, sorted by count descending. Error checkboxes select multiple sub-errors, with “Match any” or “Match all.” No selected errors means no error restriction. Files opened locally are processed in the browser. The horizontal record selector and previous/next controls navigate results.

See the [root README](../README.md) for development instructions. The older static sites remain historical artifacts, not the active viewer.
