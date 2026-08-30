# Transcript Cleanup Fine-Tuning Dataset Plan

Status: Initial plan, written before online verification  
Target model: approximately 2B parameters  
Training method: task-specific supervised instruction fine-tuning (SFT), preferably with LoRA or QLoRA  
Primary task: transform a raw speech-recognition transcript into a clean, faithful transcript

## 1. Objective

Create a high-quality paired dataset that teaches a small local language model to clean speech-recognition output while preserving the speaker's meaning, facts, names, numbers, tone, and level of detail.

The model will receive text, not audio:

```text
cleanup instruction + raw transcript -> cleaned transcript
```

This is a transcript post-processing model. It is not an acoustic or speech-recognition model, and it must not be expected to reconstruct information that is absent from the raw transcript.

## 2. Intended cleanup behavior

The default cleanup policy is:

1. Restore punctuation, capitalization, and paragraph structure.
2. Remove unintentional fillers, repetitions, abandoned false starts, and stutters.
3. Resolve explicit self-corrections in favor of the speaker's final intended wording.
4. Infer document structure from the content and natural discourse: paragraphs, email layout, greetings, sign-offs, quotations, and lists should not require the speaker to name the structure. Long passages should be divided into coherent paragraphs at genuine topic, purpose, speaker, or discourse shifts even when the raw ASR contains no spoken "new paragraph" or "new line" command. Do not add paragraph breaks merely because a passage is long; keep closely related sentences together. Apply naturally dictatable control phrases such as "new paragraph," "new line," or literal punctuation when they are actually spoken.
5. Normalize numbers, dates, times, currency, measurements, email addresses, URLs, and common identifiers when the intended representation is unambiguous.
6. Correct obvious spelling and speech-recognition substitutions when the intended wording is strongly supported by context.
7. Preserve meaning, factual content, names, technical terms, tone, and useful detail.
8. Return only the cleaned transcript, with no explanation or commentary.
9. Leave an already-correct transcript unchanged.
10. Preserve uncertainty instead of inventing information when a correction is ambiguous.

## 3. Non-goals

Unless a future mode explicitly requests them, the model should not:

- Summarize or shorten the speaker's ideas.
- Add facts, examples, conclusions, or connective reasoning.
- Change the speaker's position or emotional tone.
- Rewrite ordinary language into a uniformly formal style.
- Translate between languages.
- Guess names, numbers, or technical terms that are not recoverable from the supplied text.
- Emit an explanation of its edits.

## 4. Dataset unit and canonical output

Each record represents one coherent dictation segment or short passage. Every record has one canonical, fully cleaned output under the default policy.

If an input contains several eligible problems, the target must correct all of them. Partially corrected targets create contradictory supervision and are not allowed.

Multiple cleanup styles must not share the same instruction. If later required, styles will use explicit controls such as:

- `verbatim`: punctuation and capitalization only.
- `clean`: remove disfluencies and apply safe normalization.
- `polished`: limited stylistic rewriting while preserving meaning.

Version 1 will implement only the `clean` behavior unless a product requirement says otherwise.

## 5. Initial size target

The first serious dataset should contain:

- 5,000 training pairs.
- 500 validation pairs.
- 500 locked test pairs.
- 6,000 total human-verified pairs.

An earlier pilot may use 1,000-2,000 training pairs to validate the training pipeline, but it should not be treated as the final quality target.

Additional data should be collected after evaluating category-specific failures. The next expansion target is 10,000-20,000 training pairs, driven by measured gaps rather than undirected volume.

## 6. Dataset composition

The initial 5,000 training pairs should use a hybrid composition:

| Record type | Target share | Approximate count |
|---|---:|---:|
| One principal error category | 40% | 2,000 |
| Natural combinations of two to four error categories | 40% | 2,000 |
| Correct input requiring no change | 20% | 1,000 |

### 6.1 Single-category examples

Single-category records provide a clear learning signal for individual transformations. They should be natural utterances rather than minimal artificial strings.

Initial allocation:

| Principal category | Approximate count |
|---|---:|
| Punctuation and capitalization | 350 |
| Fillers | 250 |
| Repetition and stutter cleanup | 200 |
| False starts and self-corrections | 250 |
| Spelling and speech-recognition substitutions | 250 |
| Numbers, dates, times, currency, and measurements | 250 |
| Emails, URLs, filenames, and identifiers | 200 |
| Dictated punctuation and formatting | 150 |
| Names, acronyms, and technical terminology | 100 |

These are starting allocations, not permanent quotas. Actual production error frequencies and evaluation results should determine later ratios.

### 6.2 Multi-error examples

Multi-error records teach the model to compose several cleanup operations in one pass. Most should contain two or three categories. Dense examples containing four or more categories should remain a minority.

Priority combinations include:

- Fillers plus punctuation.
- Repetition plus capitalization.
- Self-correction plus a date, time, or number.
- Technical terminology plus a speech-recognition substitution.
- Email or URL formatting plus dictated punctuation.
- False start plus filler removal plus paragraph formatting.
- Numbers plus units plus punctuation.

Real multi-error transcripts should remain intact when they form a coherent utterance. They should not be split merely to force every record into a single-error category.

### 6.3 No-change and hard-negative examples

No-change records prevent compulsive rewriting. They should include both ordinary clean transcripts and challenging inputs containing words that resemble editing commands.

Examples should cover literal uses of words such as:

- comma
- period
- colon
- quote
- new line
- new paragraph
- delete
- scratch

For example, "The trial period ends tomorrow" must not be interpreted as a dictated period command.

## 7. Data sources

Preferred source order:

1. Real raw output from the exact speech-recognition system used in production, paired with the user's accepted final edit.
2. Deliberately recorded dictation prompts designed to cover missing categories.
3. Human-authored examples modeled on observed production failures.
4. Carefully generated synthetic examples that are manually reviewed before inclusion.
5. Compatible public corpora, after checking their task fit, licensing, and annotation conventions.

Target source mixture:

- 80-90% real or directly human-authored pairs.
- 10-20% synthetic or externally sourced pairs.
- 0% unreviewed model-generated gold outputs.

The original audio should be retained when consent and storage policy allow, even though it will not be supplied to the cleanup model. Audio is useful for resolving disputed labels and identifying whether an apparent error originated in speech or recognition.

## 8. Record schema

Recommended JSONL representation:

```json
{
  "id": "pair_000001",
  "messages": [
    {
      "role": "system",
      "content": "Clean the transcript while preserving meaning, facts, names, numbers, tone, and useful detail. Remove unintentional disfluencies, apply clear dictated formatting, and return only the cleaned transcript. Do not explain your edits."
    },
    {
      "role": "user",
      "content": "uh email john at john at acme dot com and tell him tuesday no thursday at four thirty"
    },
    {
      "role": "assistant",
      "content": "Email John at john@acme.com and tell him Thursday at 4:30."
    }
  ],
  "metadata": {
    "speaker_id": "speaker_0012",
    "session_id": "session_0104",
    "document_id": null,
    "language": "en",
    "domain": "general",
    "source": "production_correction",
    "asr_model_version": "unknown",
    "error_types": [
      "filler",
      "self_correction",
      "email_formatting",
      "time_normalization",
      "punctuation"
    ],
    "requires_context": false,
    "review_status": "double_reviewed",
    "policy_version": "clean-v1"
  }
}
```

Metadata is for curation, splitting, auditing, and evaluation. It should not be inserted into the training prompt unless the deployed application will provide the same information.

## 9. Error taxonomy

Every changed record must receive one or more labels from a controlled taxonomy:

- `punctuation`
- `capitalization`
- `paragraph_formatting`
- `dictated_formatting`
- `filler`
- `repetition`
- `stutter`
- `false_start`
- `self_correction`
- `spelling`
- `asr_substitution`
- `name_or_entity`
- `technical_term`
- `acronym`
- `number_normalization`
- `date_normalization`
- `time_normalization`
- `currency_or_measurement`
- `email_formatting`
- `url_formatting`
- `identifier_formatting`
- `context_dependent`
- `code_switching`
- `no_change`
- `ambiguous_preserved`

The taxonomy should be versioned. New categories may be added without rewriting historical labels, but definitions must be documented.

## 10. Pair construction rules

1. Preserve a coherent semantic unit; do not split in the middle of a self-correction or dictated structure.
2. Match the length distribution of real deployment traffic. Within every principal category that has enough records to measure, at least 20% should be longer utterances of roughly 30-40 words or more; do not let a category collapse into short template fragments.
3. Correct every issue covered by the active policy.
4. Use one canonical output per identical input and instruction.
5. Do not include chain-of-thought, edit explanations, or markup in the target.
6. Do not silently turn ambiguous content into a confident assertion.
7. Preserve personal voice unless a style transformation is explicitly requested.
8. Preserve punctuation and capitalization that the recognizer already placed correctly. Raw ASR inputs must reflect a realistic mixture: some may be lowercase and unpunctuated, some may contain partial or imperfect punctuation, and some may already have correct punctuation and capitalization even when another cleanup behavior is required.
9. Do not manufacture a punctuation or capitalization error merely to make an example look like ASR. Label `punctuation` or `capitalization` only when the target actually changes that feature.
10. For longer inputs, infer paragraph boundaries from semantic organization rather than requiring dictated layout commands. Use multiple paragraphs when the speaker moves between distinct but related ideas, stages, audiences, or purposes. Do not split every sentence into its own paragraph, and do not break one continuous idea into arbitrary chunks based only on word count.
11. Formatting must not become summarization. Do not replace complete sentences with shorter labels, telegraphic bullets, headings, or fragments that omit the speaker's verbs, qualifiers, relationships, or useful detail. A list or structured layout may reorganize presentation only when every substantive statement remains recoverable in the target.
12. Keep unusual but intentional grammar when changing it would alter tone or identity.
13. Normalize representations consistently according to a written style guide.
14. Prefer authentic recognition errors over generic grammatical mistakes.
15. Raw inputs must sound like plausible speech captured by a recognizer. Do not manufacture telegraphic templates by deleting subjects, verbs, articles, or connective language merely to make the target look more structured. Genuine spoken fragments are allowed when the source naturally contains them, but itinerary, note, checklist, and report examples should normally retain the complete phrases and relationships a person would actually dictate.
16. Version 1 self-corrections and false starts must be local and bounded. Use repairs to a date, time, number, name, entity, word, or short phrase, or a brief abandoned opening immediately replaced by the intended wording. Do not create examples where cleanup discards or replaces an entire paragraph, reverses the speaker's overall intent, substitutes a different request, or requires deciding which of two substantially different meanings the speaker intended.
17. Design false-start inputs with one short, unfinished phrase followed immediately by its completion or replacement. Keep the surrounding request intact. Do not chain abandoned openings, introduce a different document or action, or use a complete rejected statement followed by “let me start again.” For example, “The legal team has to—needs to review the draft before I send it” becomes “The legal team needs to review the draft before I send it.” The raw input itself must satisfy this constraint, not merely the target.

## 11. Contrastive coverage

The dataset should contain deliberately paired situations that look similar but require different behavior:

- Dictated command: "tomorrow comma preferably before noon" -> "Tomorrow, preferably before noon."
- Literal word: "the comma after however is optional" -> preserve the word "comma."
- Dictated deletion: "Tuesday scratch that Thursday" -> retain Thursday.
- Literal deletion discussion: "The phrase scratch that appears in the draft" -> preserve the phrase.
- Number normalization: "four thirty p m" -> "4:30 PM."
- Number preservation: a version number or identifier whose zeros and punctuation must not be reformatted incorrectly.

Contrastive records should be distributed across training, validation, and testing without duplicating their wording.

## 12. Context policy

Most records should be independently understandable. Previous-segment context may be included only when the production model will receive the same context.

When context is available, the prompt structure should distinguish it from the text being cleaned. Context should help resolve terminology or references but must not be copied into the output.

Examples from the same session, recording, speaker-specific script, or document must stay together during dataset splitting.

## 13. Train, validation, and test splitting

Do not randomly split small fragments from the same session.

Group the split by the strongest available relationship:

1. `document_id`
2. `session_id`
3. recording identifier
4. collection batch or date
5. speaker, when evaluating generalization to unseen speakers

The locked test set should:

- Contain only human-verified pairs.
- Reflect real production length and error distributions.
- Include every primary error category.
- Include common multi-error combinations.
- Include at least 15-20% no-change records.
- Remain unchanged across model and hyperparameter experiments.

For a single-user product, the test set may contain that user but should use later, unseen sessions. For a multi-user product, maintain both seen-speaker and unseen-speaker evaluation subsets.

## 14. Annotation workflow

### Pass 1: correction

An annotator produces the clean transcript using the active policy and style guide.

### Pass 2: independent review

A second reviewer checks:

- Meaning preservation.
- Wording and detail preservation: formatting has not compressed full statements into shorthand labels, summaries, or fragments.
- Raw-input plausibility: the ASR text reflects natural speech or a credible recognition failure rather than an author-created sequence of keywords or template fields.
- Correction scope: every false start or self-correction is an explicit, local repair, not a paragraph-scale retraction, broad intent change, or inferred replacement of meaning.
- Names, numbers, and identifiers.
- Completeness of cleanup.
- Policy consistency.
- Whether an ambiguous phrase was over-corrected.
- Error-category labels.

### Pass 3: adjudication

Disagreements involving meaning, domain terminology, or ambiguous dictation are resolved by a senior reviewer or by consulting the original audio when available.

### Acceptance gate

A pair enters the gold dataset only after:

- Its input matches the raw source.
- Its output satisfies the policy.
- Its metadata and error labels are valid.
- It passes automated structural validation.
- It has the required human review status.

## 15. Automatic quality checks

Before training, validate that:

- IDs are unique.
- Required roles and fields are present.
- Inputs and outputs are non-empty.
- Exact and near duplicates are flagged.
- Identical inputs do not have conflicting outputs under the same policy.
- Session and document groups do not cross dataset splits.
- Outputs do not contain analysis prefixes or edit explanations.
- Changed outputs are flagged for review when content-word loss is unusually high relative to the declared disfluency or self-correction edits. Structured targets must not delete verbs, qualifiers, relationships, or useful detail merely to create headings or bullets.
- Inputs with unusually high fragment or keyword density are flagged for human review, especially when omitted subjects, verbs, articles, or connectives appear designed to force an itinerary, list, note, or form-like target.
- False-start and self-correction records are flagged when the removed span crosses a sentence boundary, contains multiple independent claims, or changes the document's overall request or intent. Such records are excluded from version 1 unless a later policy explicitly supports broad retractions.
- No-change records have identical input and output after permitted whitespace normalization.
- Error-category values come from the controlled taxonomy.
- Email addresses, URLs, numbers, and identifiers receive additional review when changed.
- Personally identifiable information is handled according to consent, retention, and redaction policies.

## 16. Training assumptions

The initial model is an already instruction-capable model near 2B parameters. The first approach should be LoRA or QLoRA rather than full-parameter tuning.

Training should:

- Use the model's official chat template.
- Compute loss only on assistant/completion tokens.
- Train the model to emit the cleaned transcript directly.
- Avoid reasoning traces in the target.
- Use short, stable instructions for most records.
- Reserve a small fraction of records for equivalent instruction paraphrases only if runtime instructions will vary.
- Shuffle records while preserving dataset composition.
- Monitor validation behavior by error category, not only aggregate loss.

Training hyperparameters are intentionally not fixed in this dataset document. They should be selected through controlled experiments after the model checkpoint, context length, hardware, and tokenizer are known.

## 17. Evaluation

Primary success criteria:

1. Meaning and factual preservation.
2. Correct handling of names, numbers, emails, URLs, acronyms, and identifiers.
3. High accuracy on no-change records.
4. Successful removal of unintended disfluencies.
5. Correct self-correction resolution.
6. Correct punctuation, capitalization, and dictated formatting.
7. No explanations, prefixes, or additional content.
8. Acceptable local latency and memory use.

Evaluation should report:

- Word error rate and character error rate against the canonical target.
- Exact match where appropriate.
- Edit precision and edit recall.
- No-change corruption rate.
- Named-entity and number preservation rate.
- Per-category results.
- Results for common category combinations.
- Results by transcript length and domain.
- Human preference and meaning-preservation review on a representative sample.

Aggregate scores must not hide safety-critical regressions. A model that improves punctuation while corrupting numbers is not acceptable.

## 18. Iteration strategy

1. Establish an untuned-model baseline on the locked test set.
2. Train a pilot adapter on 1,000-2,000 pairs.
3. Inspect errors and confirm that the schema, prompt, and cleanup policy are learnable.
4. Build the full 5,000-pair training set.
5. Train the first production candidate.
6. Compare it against the untuned model using identical decoding settings.
7. Build an error matrix by category and combination.
8. Add targeted data for recurring failures.
9. Repeat without modifying the locked test set.
10. Create a new test-set version only when product behavior or policy changes.

## 19. Dataset governance

- Record dataset version, policy version, collection date, and source provenance.
- Retain correction history without exposing it to training unless approved.
- Track consent and deletion requirements for user-derived data.
- Prevent test examples from entering later training versions.
- Document synthetic-data generators and reviewers.
- Review public-data licenses before redistribution or commercial use.
- Maintain a changelog of taxonomy, policy, and split changes.

## 20. Initial decisions to review

The following choices should be explicitly approved before large-scale collection:

1. Whether version 1 supports one cleanup mode or several explicit modes.
2. Whether filler words are always removed or preserved when rhetorically meaningful.
3. Preferred conventions for numbers, dates, times, currency, and measurements.
4. How dictated editing commands are recognized and escaped when spoken literally.
5. Whether preceding transcript context will be available at inference.
6. Languages and code-switching patterns included in version 1.
7. Whether the model is personal to one speaker or intended to generalize across speakers.
8. Privacy, consent, retention, and deletion requirements for production corrections and audio.

---

The sections below are reserved for online verification and additions. The initial plan above will remain unchanged so its assumptions can be compared with the source-backed review.

## 21. Online verification addendum

Verification date: 2026-08-30  
Method: review of current official training documentation and primary research papers on instruction tuning, transcript cleanup, disfluency correction, generative speech-recognition error correction, data quality, data diversity, and conservative correction.

This addendum does not replace or edit the initial plan. It records which assumptions were supported, which remain experimental, and what should be added before implementation.

### 21.1 Executive conclusion

The initial plan is directionally sound:

- The task is correctly framed as narrow, task-specific supervised instruction fine-tuning.
- A prompt-to-clean-completion dataset is appropriate.
- Completion-only or assistant-only loss is appropriate.
- Real raw recognizer output paired with a human-approved correction should be the primary data source.
- Single-error, multi-error, and no-change records are all necessary.
- Conservative behavior, context control, category-level evaluation, and session-grouped splits are important.
- A small specialized model is a reasonable choice; larger models are not automatically better for correction.

The main qualification is that no reviewed source establishes `40% single-error / 40% multi-error / 20% no-change` as a universally optimal ratio. That ratio should remain the balanced default for the first run, but it must be compared with alternative mixtures under the same training-token budget.

### 21.2 Source findings and their implications

#### Finding A: use a supported prompt-completion or conversational SFT format

The current [Hugging Face TRL SFT documentation](https://huggingface.co/docs/trl/main/sft_trainer) supports conversational records and standard prompt-completion records. It supports LoRA/PEFT and can compute loss only on completion tokens or only on assistant messages.

Implications:

- The initial `messages` schema is valid if the selected model's chat template exposes an assistant-generation mask and training explicitly enables assistant-only loss.
- A `prompt` plus `completion` schema is also valid and may be simpler for this deterministic transformation.
- Before training, render at least 20 records through the exact tokenizer and chat template and verify that only the cleaned output receives labels.
- Do not assume `assistant_only_loss=True` works with every template; verify that the template supplies the required generation markers.

#### Finding B: keep the small dataset focused on one task

[Empirical Analysis of Task Mixture Effects in Small-scale Instruction Tuning](https://aclanthology.org/2026.findings-acl.643/) evaluated 51 mixtures and found that one- or two-task mixtures worked best with small datasets, while broader synergistic mixtures became more useful with larger data.

Implications:

- Treat punctuation, disfluency removal, normalization, and dictated formatting as subskills of one `clean transcript` task.
- Do not add unrelated general chat, question answering, creative writing, summarization, or coding instructions to this adapter.
- If summarization or aggressive rewriting is needed later, train it as a separate mode, adapter, or explicitly controlled task.

#### Finding C: quality and diversity must be optimized together

[From Quantity to Quality](https://aclanthology.org/2024.naacl-long.421/) found that selected subsets could outperform substantially larger instruction collections, while [Data Diversity Matters for Robust Instruction Tuning](https://aclanthology.org/2024.findings-emnlp.195/) found that diversity improves worst-case instruction-following robustness.

Implications:

- The dataset should not maximize pair count at the expense of annotation certainty.
- It also should not consist of thousands of nearly identical high-confidence punctuation examples.
- Selection should reward both label quality and coverage across error type, error combination, length, domain, speaker style, recognizer version, and difficulty.
- Near-duplicate templates count as less diversity than naturally different utterances.

#### Finding D: conservative examples reduce over-correction

[Robust ASR Error Correction with Conservative Data Filtering](https://aclanthology.org/2024.emnlp-industry.20/) proposes two requirements for correction targets: the target should improve linguistic acceptability, and the correction should be inferable from the available input or context. Training the model not to edit low-quality or unsupported pairs reduced over-correction and improved out-of-domain behavior across the paper's evaluation suite.

Implications:

- The initial no-change allocation is strongly justified as a design feature, although the exact 20% ratio remains experimental.
- Add an annotation field named `edit_support` with values:
  - `direct`: the correction is directly supported by the text.
  - `contextual`: the correction is supported only by context that will be available at inference.
  - `audio_only`: the correction requires listening to audio and is not inferable by the text model.
  - `uncertain`: reviewers cannot establish one safe correction.
- Train normal correction targets only for `direct` and valid `contextual` records.
- Exclude `audio_only` records from text-only SFT or convert them to conservative identity targets if leaving the text unchanged is the product policy.
- Exclude unresolved `uncertain` records from the gold training set.

#### Finding E: correction models struggle with unseen error distributions and named entities

[Failing Forward: Improving Generative Error Correction for ASR with Synthetic Data and Retrieval Augmentation](https://aclanthology.org/2025.findings-acl.125/) reports weak generalization beyond error types observed during training, especially out of domain and for named entities. Its synthetic error augmentation and retrieval of named entities improved in-domain and out-of-domain results.

Implications:

- Add a recognizer-version holdout and a domain holdout to evaluation.
- Do not rely only on a random in-distribution test set.
- Use reviewed synthetic data to fill specific missing error patterns rather than to inflate the dataset generally.
- Treat evolving names and technical vocabulary as a possible runtime glossary or retrieval problem, not only a weight-training problem.
- If a glossary will be provided at inference, create a separate context-bearing subset whose prompt mirrors that exact interface.

#### Finding F: some cleanup decisions require multiple turns

[MultiTurnCleanup](https://aclanthology.org/2023.emnlp-main.613/) shows that some discontinuities in conversational transcripts cannot be identified from a single utterance and require information across turns.

Implications:

- The initial context policy is confirmed.
- Create separate evaluation slices named `single_segment` and `context_required`.
- Include context-required training records only if production inference supplies preceding turns.
- Explicitly mark which portion of the prompt is context and which portion must be returned after cleanup.
- Never train the model to infer context that the deployed system will not provide.

#### Finding G: disfluency correction benefits from more explicit supervision

[DISCO](https://aclanthology.org/2023.findings-emnlp.855/) formalizes disfluency correction around fillers, repetitions, and corrections. More recent work, [Mind the Pause](https://arxiv.org/abs/2605.12242), reports gains from token-level disfluency cues combined with instruction tuning and a contrastive objective.

Implications:

- Keep the existing disfluency categories and add optional character or token spans identifying removed reparanda, fillers, repetitions, and editing terms.
- Store these spans as annotation metadata, not in the ordinary inference prompt.
- Version 1 can use standard SFT. If the 2B model leaves disfluencies behind or deletes fluent content, test span-guided or auxiliary tagging supervision in a later experiment.

#### Finding H: a smaller fine-tuned correction model can beat a larger general model

[Post-ASR Correction in Hindi](https://aclanthology.org/2026.eacl-short.45/) found that smaller fine-tuned language models consistently outperformed larger LLM approaches in its correction setting. It also found different strengths for character-oriented and semantic models and observed out-of-domain degradation.

Implications:

- The approximately 2B specialized-model direction remains reasonable.
- Model size should not be increased until the 2B model's failure matrix shows a capacity problem rather than a data, prompt, or decoding problem.
- Maintain a small encoder-decoder or character-aware correction model as an optional control baseline if spelling, transliteration, or word-boundary repair becomes a dominant issue.

#### Finding I: synthetic data is useful when grounded by real examples

[CRAFT Your Dataset](https://aclanthology.org/2025.tacl-1.76/) builds task-specific synthetic data from user-written demonstrations and retrieved human text, and reports stronger results than less-grounded synthetic-instruction approaches in its evaluated tasks.

Implications:

- Begin synthetic generation from verified real correction pairs and real clean transcripts.
- Generate targeted variants for underrepresented error categories and combinations.
- Retain provenance linking every synthetic record to its generation policy and seed family.
- Human-review every synthetic gold output for version 1.
- Cap each near-duplicate synthetic family so it cannot dominate training.

### 21.3 Required additions to the initial schema

Add the following metadata fields before collection begins:

```json
{
  "edit_support": "direct",
  "input_error_count": 3,
  "principal_error_type": "self_correction",
  "difficulty": "medium",
  "context_mode": "none",
  "critical_spans": [
    {
      "kind": "number",
      "input_text": "four thirty",
      "output_text": "4:30"
    }
  ],
  "disfluency_spans": [],
  "synthetic_family_id": null,
  "collection_batch": "batch_0001"
}
```

Definitions:

- `input_error_count` is the reviewer-estimated count of distinct required edits, not just the number of categories.
- `principal_error_type` supplies a single balancing key even when several `error_types` are present.
- `difficulty` uses `easy`, `medium`, or `hard` according to written annotation examples.
- `critical_spans` tracks names, numbers, emails, URLs, identifiers, and other content whose corruption is especially costly.
- `synthetic_family_id` enables family-level deduplication and split grouping.

### 21.4 Replace certainty about the 40/40/20 ratio with a controlled ablation

The original 40/40/20 mixture remains Experiment B, the default balanced mixture. Before declaring it optimal, compare:

| Experiment | Single-principal-error | Natural multi-error | No-change | Purpose |
|---|---:|---:|---:|---|
| A: atomic-heavy | 50% | 30% | 20% | Strongest isolated learning signal |
| B: balanced | 40% | 40% | 20% | Initial plan and default candidate |
| C: compound-heavy | 30% | 50% | 20% | Stronger composition behavior |
| D: natural-frequency | Measured | Measured | Measured | Match a representative production sample |

Rules for a fair comparison:

- Use the same model checkpoint, tokenizer, optimizer family, number of training tokens, and decoding settings.
- Draw from the same quality-approved pair pool.
- Keep validation and locked test sets identical.
- Compare per-category results, combination results, no-change corruption, critical-span preservation, and human meaning-preservation judgments.
- Prefer the smallest or simplest mixture whose improvement is repeatable, not a difference within evaluation noise.

The final production mixture may combine natural frequency with modest oversampling of rare, safety-critical categories.

### 21.5 Add a staged data-scaling experiment

The reviewed literature supports careful curation but does not establish 5,000 pairs as a universal optimum for this 2B model and policy. Determine the saturation point empirically.

Train comparable adapters at:

- 500 approved pairs.
- 1,000 approved pairs.
- 2,000 approved pairs.
- 5,000 approved pairs.
- 10,000 pairs only if the curve is still improving and additional data is available.

Each nested subset should preserve the selected mixture and quality gates. Plot or tabulate performance against both example count and target-token count. Stop scaling when gains flatten and failure analysis shows that new data is duplicating learned behavior.

### 21.6 Add out-of-domain and cross-version evaluation

The locked evaluation suite should be divided into:

1. `ID-current`: current recognizer, familiar domains, familiar speaker population.
2. `OOD-domain`: current recognizer, unseen or deliberately held-out domains.
3. `OOD-recognizer`: a different recognizer or recognizer version producing a different error distribution.
4. `clean-hard-negative`: correct inputs containing command-like or easily over-normalized words.
5. `critical-content`: names, numbers, dates, money, email addresses, URLs, filenames, and identifiers.
6. `context-required`: only if production supplies context.
7. `long-form`: transcripts near the upper end of production length.

Report results for every slice. A single aggregate test number is insufficient.

### 21.7 Add dataset acceptance priorities

When choosing between adding more examples and improving existing examples, use this order:

1. Resolve incorrect or unsupported targets.
2. Remove conflicting policies and ambiguous gold outputs.
3. Prevent leakage and near-duplicate families across splits.
4. Fill missing safety-critical categories.
5. Fill missing common category combinations.
6. Improve domain, speaker-style, and length diversity.
7. Add more examples to already well-covered categories.

This order reflects the reviewed evidence that data quality, diversity, and task fit are more important than raw volume.

### 21.8 Final verified version-1 recommendation

Proceed with the following implementation target:

- One narrow task: `clean transcript`.
- Approximately 2B instruction-capable model.
- LoRA or QLoRA SFT.
- Conversational or prompt-completion records rendered with the model's official template.
- Loss applied only to cleaned output tokens.
- Initial pool of 6,000 human-verified pairs: 5,000 train, 500 validation, 500 locked test.
- Balanced 40/40/20 training mixture as the first candidate, not as an untested permanent rule.
- A controlled mixture comparison and nested data-scaling comparison before expanding collection.
- Conservative exclusion of edits not inferable from text or supplied context.
- Explicit no-change and hard-negative coverage.
- Separate single-segment, context-required, critical-content, in-domain, and out-of-domain evaluations.
- Reviewed synthetic augmentation only for measured coverage gaps.
- Runtime glossary or retrieval considered separately for changing names and terminology.

### 21.9 Sources reviewed

- [Hugging Face TRL: SFT Trainer](https://huggingface.co/docs/trl/main/sft_trainer)
- [Hugging Face TRL: Dataset formats and types](https://huggingface.co/docs/trl/dataset_formats)
- [Empirical Analysis of Task Mixture Effects in Small-scale Instruction Tuning](https://aclanthology.org/2026.findings-acl.643/)
- [From Quantity to Quality: Boosting LLM Performance with Self-Guided Data Selection](https://aclanthology.org/2024.naacl-long.421/)
- [Data Diversity Matters for Robust Instruction Tuning](https://aclanthology.org/2024.findings-emnlp.195/)
- [Robust ASR Error Correction with Conservative Data Filtering](https://aclanthology.org/2024.emnlp-industry.20/)
- [Failing Forward: Improving Generative Error Correction for ASR](https://aclanthology.org/2025.findings-acl.125/)
- [MultiTurnCleanup](https://aclanthology.org/2023.emnlp-main.613/)
- [DISCO: A Large Scale Human Annotated Corpus for Disfluency Correction](https://aclanthology.org/2023.findings-emnlp.855/)
- [Mind the Pause: Disfluency-Aware Objective Tuning](https://arxiv.org/abs/2605.12242)
- [Post-ASR Correction in Hindi](https://aclanthology.org/2026.eacl-short.45/)
- [CRAFT Your Dataset](https://aclanthology.org/2025.tacl-1.76/)

## 22. Review checklist before data collection

- [ ] Approve the `clean-v1` behavior and non-goals.
- [ ] Approve number, date, time, currency, measurement, email, and URL conventions.
- [ ] Decide whether context will exist at inference.
- [ ] Decide which languages and code-switching patterns version 1 supports.
- [ ] Decide whether data represents one user or a wider speaker population.
- [ ] Approve privacy, consent, retention, and deletion rules.
- [ ] Approve the error taxonomy and `edit_support` policy.
- [ ] Create 50-100 adjudicated gold examples as an annotator calibration set.
- [ ] Validate the selected model's chat template and completion mask.
- [ ] Establish the locked evaluation suite before large-scale training collection.
- [ ] Run mixture and scaling ablations before treating any dataset ratio or pair count as final.

## 23. User-approved version-1 decisions and 50-pair sample set

Decision date: 2026-08-30

This section records the product decisions made after reviewing the initial plan and verification addendum. These decisions supersede earlier alternatives when the dataset is implemented, while the earlier sections remain visible for comparison.

### 23.1 One cleanup style only

Version 1 has one behavior named `polished-clean-v1`.

"Polished" means the finest final written form of the same dictated content. It includes punctuation, capitalization, removal of unintentional speech artifacts, safe grammatical cleanup, and appropriate document formatting. It does not mean summarization, creative rewriting, adding content, changing tone, or replacing the speaker's wording without need.

The target should look ready to paste into its destination while preserving the original meaning, information, order, and voice.

### 23.2 Natural dictation and automatic formatting are part of the task

The model should infer formatting from meaning and discourse structure. Raw ASR must resemble something a person would naturally say, not a written annotation recipe. In particular, authors must not manufacture structure by prefixing content with phrases such as `heading`, `bullet list`, `unordered list`, `numbered list`, `recipe`, `travel plan`, `question`, or `answer` merely to force a target layout.

Natural dictation must remain linguistically complete enough to be credible. Authors must not convert “On Monday, my flight departs at 6:05 AM and arrives at 9:40 AM” into an artificial keyword stream such as “Monday depart six oh five arrive nine forty.” Missing punctuation and capitalization are common ASR conditions; systematic removal of subjects, verbs, articles, and connective language is not a substitute for realistic ASR noise. Real source fragments may be retained when they genuinely occur, but synthetic examples must not create fragmentary input solely to justify aggressive formatting.

Self-correction coverage is deliberately conservative in version 1. Valid patterns include “Tuesday, no, Thursday,” “three thirty, sorry, four,” a corrected name, or a brief abandoned opening such as “Could you—please send the report.” Invalid patterns include retracting a full paragraph, replacing one multi-step request with a different request, or using “let me start again” to erase several complete claims. If resolving the correction would require interpreting a major intent change rather than applying the speaker's explicit nearby replacement, the pair must not be generated for this policy.

The model should apply formatting when it is structurally implied, including:

- Paragraph breaks and new lines.
- Ordered lists.
- Unordered or bulleted lists.
- Greetings and sign-offs.
- Headings only when a genuinely title-like standalone phrase is present; do not teach a spoken `heading` command.
- Quotation marks.
- Commas, periods, colons, semicolons, question marks, and exclamation marks.
- Parentheses and dashes when clearly dictated.
- Naturally spoken controls such as `new paragraph`, `new line`, `open quote`, `close quote`, `comma`, `period`, `full stop`, `colon`, `question mark`, and `exclamation mark`.

Most list examples must contain no spoken list or line-break instruction. Unordered lists should be inferred from a natural enumeration. Ordered lists should normally be signaled by the speaker's own sequence words—`first`, `second`, `third`, and so on—and may follow an introductory sentence. Email greetings, body paragraphs, and sign-offs should likewise receive conventional line breaks without requiring the speaker to say `new paragraph` or `new line`.

Long-form examples must also teach implicit paragraphing. When an extended dictation moves from context to findings, from findings to a decision, or from a decision to next steps, the polished target should use separate coherent paragraphs even if the raw input is one uninterrupted ASR block and contains no formatting command. Paragraph boundaries must follow semantic transitions, not a fixed sentence count or word threshold. Closely related sentences should remain in the same paragraph, and short passages should not be fragmented unnecessarily.

Formatting is presentation, not compression. When prose is converted into paragraphs, headings, notes, or lists, the target must retain the speaker's complete substantive statements. Authors must not shorten “The morning session starts at 9:15 and covers safety” to “9:15 AM: Safety,” because that deletes the stated subject, action, and relationship. Concision is acceptable only when it removes an eligible speech artifact or performs an unambiguous normalization, not when it summarizes content.

Literal punctuation and paragraph commands remain valuable, but they are a distinct behavior and should also appear naturally inside mixed examples. Formatting words used as content must be preserved. Prosodic or lexical emphasis—repetition for emphasis, contrastive wording, a stressed name or number, or a specifically named function or variable—must survive cleanup when it is intentional rather than a disfluency.

The model must distinguish a formatting command from a literal use of the same word. For example, the word `period` in "the trial period ends tomorrow" remains a word, while `period` at the end of a dictated sentence becomes punctuation when used as a command.

### 23.3 Approved shared system instruction

Every version-1 record uses the same system instruction:

```text
You are a transcript cleanup editor. Return only the polished transcript. Faithfully preserve the speaker's meaning, information, tone, order, and intentional emphasis. Restore punctuation, capitalization, and natural document structure. Infer paragraphs, email layout, greetings, sign-offs, quotations, and ordered or unordered lists from the content without requiring spoken labels such as heading, bullet list, or numbered list. In longer passages, create coherent paragraphs at genuine topic or discourse shifts even when no new-line or new-paragraph command is spoken; keep closely related sentences together and do not split text arbitrarily by length. Formatting must not compress or summarize the content: retain complete substantive statements, including their subjects, actions, qualifiers, relationships, and useful detail, rather than replacing them with shorter labels or telegraphic bullets. Apply naturally spoken punctuation, new-line, and new-paragraph commands when present. Normalize unambiguous dates, times, numbers, currency, measurements, identifiers, email addresses, URLs, and filenames. Remove unintentional fillers, repetitions, stutters, and brief abandoned openings; resolve only explicit, local self-corrections to a word or short phrase. Do not discard complete sentences or paragraphs, infer a broad change of intent, or replace one substantive request with another. Correct obvious ASR errors. Do not summarize, creatively rewrite, add facts, reorder ideas, erase intentional emphasis, or explain edits. Preserve formatting words when they are used literally. Return only the polished transcript.
```

### 23.4 Approved production mixture

The production target is:

| Record type | Target share | Count in a 5,000-pair training set |
|---|---:|---:|
| One principal error category | 50% | 2,500 |
| Natural combination of two or more categories | 45% | 2,250 |
| Correct input requiring no change | 5% | 250 |

Because 50 examples cannot represent 45% and 5% exactly with whole records, the sample file uses the nearest distribution that does not exceed the requested no-change share:

| Record type | Sample count | Actual sample share |
|---|---:|---:|
| One principal error category | 25 | 50% |
| Natural combination of two or more categories | 23 | 46% |
| Correct input requiring no change | 2 | 4% |

This rounding applies only to the 50-pair demonstration. The full dataset should use the exact 50/45/5 allocation.

The additional batch in `data/sample-50-additional.jsonl` contains 100 records, retaining its historical filename. It uses the exact allocation: 50 single-principal-error, 45 natural multi-error, and 5 no-change records. The appended half contributes 25, 22, and 3 records respectively to balance the original 25/23/2 batch.

### Combined curated collection

`data/curated-180.jsonl` combines the original 50, additional 30, and additional 100 records in that order. IDs are sequential across the entire collection: `sample_001` through `sample_180`. The component files use the same IDs: `sample-50.jsonl` has 001–050, `sample-30.jsonl` has 051–080, and `sample-50-additional.jsonl` has 081–180. Their historical filenames describe batches, not ID prefixes. The viewer loads the matching repository-root `public/data/curated-180.jsonl` directly. Keep it synchronized when editing component records. Benchmark artifacts retain their own existing identifiers.

### 23.5 No-change input policy

No-change records must look like natural ASR output that already happens to be correct. They should not be artificial formatting demonstrations or inputs that still contain spoken formatting commands requiring conversion.

The raw ASR input may already contain proper punctuation and capitalization because some recognizers produce them correctly. It may also be plain natural text whose existing presentation is already acceptable. For a genuine no-change record, the assistant output must be identical to the input.

Correct or partially correct punctuation and capitalization are not limited to no-change records. A transcript can contain a filler, repetition, self-correction, normalization issue, or ASR substitution while its sentence boundaries, commas, question marks, and capitalization are already correct. Authors must preserve those correct features in the target and must not systematically lowercase or strip punctuation from raw inputs. Across each split, examples should include fully punctuated, partially punctuated, and unpunctuated ASR output in proportions informed by production traffic.

### 23.6 Approved sample schema

The 50-pair demonstration is stored in `sample-50.jsonl`. Every line is an independent JSON object with:

- `id`: unique stable sample ID.
- `messages`: the shared system instruction, raw ASR user input, and polished assistant output.
- `metadata.language`: language code.
- `metadata.record_type`: `single_principal_error`, `natural_multi_error`, or `no_change`.
- `metadata.primary_category`: the principal behavior being demonstrated.
- `metadata.error_types`: every cleanup category present in the input.
- `metadata.formatting_features`: formatting applied in the target.
- `metadata.edit_support`: whether the target is directly inferable from the text.
- `metadata.source`: source classification for the sample.
- `metadata.policy_version`: `polished-clean-v1`.

There is no `speaker_id` field.

### 23.7 Demonstration coverage

#### Current authoring priorities

The historical coverage list below describes existing samples, not a requirement to generate equal amounts of every niche transformation. Future generation should emphasize representative everyday dictation, including emails, messages, work updates, and conversational technical explanations. These are scenarios in which errors occur, not additional error categories.

Use a small set of main authoring groups: filler removal; repetition and stutter cleanup; brief false starts and local self-corrections; punctuation, capitalization, and natural dictated formatting; and entity/technical normalization (names, numbers, dates, times, acronyms, technical terms, and addresses). Preserve no-change examples separately. Detailed error labels may remain for diagnostics without each becoming a generation quota.

Prioritize fillers, repetitions, and short local false starts. Within formatting, favor ordinary punctuation and naturally spoken comma, colon, new-line, and new-paragraph commands. Do not deliberately generate open/close-quote command examples as a focus area. Filename formatting is incidental only, not a primary category to target or fill a quota for. Preserve clearly supported incidental filenames or quotations without manufacturing examples around them.

Long context is a length/structure dimension across the main groups, not another error type. Keep extended passages a minority and avoid manufacturing lengthy inputs solely to exercise formatting. A smaller long-context share and revised category percentages are pending user agreement; the historical distributions below do not establish new quotas for these priorities.

The sample set covers:

- Punctuation and capitalization.
- Fillers, repetitions, stutters, and false starts.
- Explicit self-corrections.
- Obvious spelling and ASR substitutions.
- Numbers, dates, times, currency, percentages, and measurements.
- Email addresses, URLs, filenames, versions, and identifiers.
- Dictated commas, periods, colons, semicolons, question marks, and exclamation marks.
- New lines and new paragraphs.
- Open and close quotation commands.
- Headings.
- Ordered and unordered lists.
- Greetings and sign-offs.
- Multi-paragraph messages and emails.
- Literal uses of words that can otherwise be formatting commands.
- Natural correct ASR outputs requiring no change.

At least 20% of the examples in each sufficiently populated record type are 30 words or longer. These longer records are distributed across categories rather than isolated in a single long-form bucket. Dates, times, numbers, currency, and measurements use forms a speaker would naturally dictate. List, heading, and email examples are driven primarily by content cues, with explicit line or punctuation commands retained only where a person might plausibly say them.

## 24. Local JSONL visualizer

`jsonl-viewer.html` is a private, standalone dataset reader. It processes the selected JSONL file entirely inside the browser and does not upload its contents.

### 24.1 Quick use

1. Open `jsonl-viewer.html` in a web browser.
2. Choose or drag in `sample-50.jsonl`.
3. Filter or sort the record table, then select a row to review the raw ASR and polished output.

When the folder is served through a local web server, the viewer automatically loads the nearby `sample-50.jsonl`. When the HTML file is opened directly, browser security prevents that automatic read, so use the file picker or drag-and-drop area.

### 24.2 Review features

- Search across transcript content, outputs, identifiers, and metadata.
- Filter by record type, primary category, language, and error type.
- Sort each table column and hide optional columns.
- Render paragraphs, headings, ordered lists, unordered lists, and quotations as rich text.
- Switch to token-level change highlighting.
- Browse metadata, the system instruction, and raw JSON on demand.
- Navigate records with the interface or the Up/Down and J/K keyboard shortcuts.

## 25. Static project website and repository

The dataset folder is also a dependency-free static website:

- `index.html` is the project overview and entry point.
- `jsonl-viewer.html` is the integrated local JSONL review application.
- `PROJECT_SUMMARY.md` records the work completed and the main decisions.
- `PRODUCT.md` and `DESIGN.md` preserve the product and interface direction.
- `.gitignore` excludes local model directories, model weights, checkpoints, caches, temporary files, and common generated output.

The local project is associated with [Beingpax/Dataset-VoiceInk-Cleanup](https://github.com/Beingpax/Dataset-VoiceInk-Cleanup).

No framework, package installation, or build step is required. Open `index.html` directly to browse the project. For automatic loading of the nearby sample in the viewer, serve the folder through any local static file server.

Models are intentionally outside the repository scope. The repository should contain only dataset files, documentation, and website/viewer source.

## 26. Repository reorganization

The dataset authoring work now lives under `dataset-generator/`, separate from the model-comparison application under `comparison/`.

The JSONL viewer is no longer maintained as a standalone `jsonl-viewer.html` file. Its functionality is implemented as `comparison/site/jsonl-viewer.js` and rendered inside the comparison website. The built-in generator sample points to `dataset-generator/data/sample-50.jsonl`, and any later generated JSONL file can be opened with the same browser file picker.

This separation keeps the responsibilities clear:

- `dataset-generator/` defines and stores training-pair authoring work.
- `comparison/` benchmarks model behavior and provides the evidence browser.
- `comparison/site/` presents benchmark results and JSONL dataset inspection in one application.
