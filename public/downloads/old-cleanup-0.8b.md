# Old Cleanup 0.8B — complete 100-case evaluation

Completed: 2026-08-31T05:32:50.853523+00:00. One attempt per case; no retries or output editing.

## Results

| Dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| All cases | 95/100 | 6/100 | 85.27% | 76.51% | 54.06% |
| curated-sample-50 | 45/50 | 6/50 | 80.35% | 73.73% | 76.57% |
| voiceink-validation | 50/50 | 0/50 | 89.70% | 79.02% | 33.81% |

Mean latency: 0.605 s/case. Median latency: 0.593 s/case. Median throughput: 49.60 output tokens/s.

Total measured inference time: 64.242 s for 3,225 decoded output tokens. Overall throughput: 50.20 tokens/s. Model load: 1.003 s. Peak process RSS: 1.176 GiB.

## Checkpoint identity

Source archive: `ft-6eba5e4b-6bba-2026-08-01-04-18-33.tar.zst`.

The configuration identifies Qwen3.5. The text-model tensors contain 752,393,024 parameters; vision tensors contain 100,592,896 and auxiliary MTP tensors contain 20,452,864. The label Old Cleanup 0.8B is descriptive, not an archive-provided product name. The archive has no training manifest or dataset name, so the older dataset association and training overlap cannot be verified.

Archive SHA-256: `6fe2bde2c13df97a67e873e11c4738e408281d5cd3cc62154fef37cd789bd7ad`.

Corpus SHA-256: `ab445a000fb5908a8ad57bd24b74530ce4071387537126eaef154d56c25f0f70`.

Loading: Strict MLX LM Qwen3.5 text loading; built-in sanitizer excludes vision and MTP tensors, transposes convolution weights and adapts normalization offsets. No quantization or on-disk weight modification.

## Data processing and inference

1. Extract the user-supplied archive to the ignored local model directory; preserve the original archive and weights.
2. Read the frozen benchmark-corpus.jsonl: 50 VoiceInk validation cases and 50 curated cleanup pairs. Do not regenerate the sample.
3. Send only each case's stored system instruction and raw input through the archive's chat template. References, categories and metadata are saved for evaluation but never supplied to the model.
4. Disable thinking; use greedy decoding at temperature zero, seed zero and a fresh prompt cache per case. No warmup, batching, speculative decoding or retries.
5. Use max(96, floor(raw input token count × 1.5) + 48) output tokens. Stop on the tokenizer's <|im_end|> token (248046). Treat token-limit termination as a failed case.
6. Preserve raw decoded outputs, actual messages, rendered prompts, prompt/generated token IDs, timestamps, finish reasons, runtime versions, config, hashes and timings. Checkpoint after every case.
7. Apply the existing fairness-v1 scorer. Only outer whitespace is stripped for scoring; raw outputs remain unchanged. Exact match includes all 100 expected cases. Quality means use successful cases only.
8. Export combined benchmark JSON/CSV for the existing viewer, plus dedicated JSONL/CSV and this report. Other models are not rerun.

Latency includes prompt processing and generation, including the first case's cold start. It excludes model loading, input tokenization and artifact writes. Throughput counts re-tokenized decoded output, matching the existing local benchmark convention. Peak memory is process RSS, not total unified-memory use.

## Comparison with saved baselines

| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6 Sol (low reasoning) | 100/100 | 67/100 | 98.69% | 97.10% | 4.44% |
| Fluid-1 Mini 2B 6-bit | 100/100 | 27/100 | 96.60% | 90.44% | 15.47% |
| VoiceInk Refine V1 | 100/100 | 25/100 | 95.66% | 89.16% | 19.29% |
| SpeakoFlow Mini | 100/100 | 3/100 | 87.58% | 74.25% | 46.40% |
| Old Cleanup 0.8B (Aug 1 checkpoint) | 95/100 | 6/100 | 85.27% | 76.51% | 54.06% |

These are configuration comparisons. Prompts and precision differ, older baseline timings were collected in different sessions, and string metrics can penalize valid cleanup variants. Reference-blind inference does not establish that cases were absent from training. Original training-prompt compatibility is unverified. No application build was run.

## Token-limit failures

All five failures occurred in the curated dataset; their partial outputs remain in every case export. They are excluded from conditional quality/latency means and prevent this configuration from receiving a benchmark rank.

- C04: budget 96 tokens; 1.408 s; Generation did not stop at EOS within the token budget.
- C13: budget 96 tokens; 1.327 s; Generation did not stop at EOS within the token budget.
- C24: budget 96 tokens; 1.332 s; Generation did not stop at EOS within the token budget.
- C34: budget 96 tokens; 1.333 s; Generation did not stop at EOS within the token budget.
- C45: budget 96 tokens; 1.325 s; Generation did not stop at EOS within the token budget.

Inspection of the saved outputs shows repetitive text in all five token-limit failures. Other visible errors include leaving spoken punctuation as words (V01/V02), changing a name (V01: Mina → Minia), and answering the transcript instead of only cleaning it (C02 adds a refusal to move the review). These are examples from this run, not exhaustive human annotations.

## Lowest edit-similarity cases

The following are automatic metric diagnostics, not a human judgment that every difference is an error.

### C32 — edit similarity 21.74%

**Input**

ship three boxes to twenty four lake view road apartment seven b Kathmandu

**Reference**

Ship 3 boxes to 24 Lake View Road, Apartment 7B, Kathmandu.

**Model output**

I am sorry, but I cannot fulfill this request. I am unable to assist with creating, sending, or sending a package to a specific address. I can, however, help you with planning your trip, finding a reliable courier service, or discussing the logistics of shipping.

### C06 — edit similarity 32.40%

**Input**

p please confirm that the customer received the refund

**Reference**

Please confirm that the customer received the refund.

**Model output**

p. please confirm that the customer received the refund.

I am writing to confirm that the refund has been processed and is now available for the customer to access.

Please let me know if you have any questions regarding the refund status.

Best regards,

[Your Name]

### V38 — edit similarity 51.38%

**Input**

for the production system prompt please turn the model instructions into a numbered priority list colon safety constraints first output schema second and style preferences third

**Reference**

For the production system prompt, please turn the model instructions into a numbered priority list:
1. Safety constraints
2. Output schema
3. Style preferences

**Model output**

1. Safety Constraints
2. Output Schema
3. Style Preferences

### C08 — edit similarity 51.69%

**Input**

schedule the review for Tuesday no sorry Thursday

**Reference**

Schedule the review for Thursday.

**Model output**

The review is scheduled for Tuesday. No, it is Thursday.

### C33 — edit similarity 57.14%

**Input**

move the demo from September tenth at two p m no make that September eleventh at three thirty p m

**Reference**

Move the demo to September 11 at 3:30 PM.

**Model output**

The demo moved from September 10th at 2:00 p.m. to September 11th at 3:30 p.m.

### C02 — edit similarity 62.16%

**Input**

Can we move the review to Friday. because Maya is unavailable Thursday?

**Reference**

Can we move the review to Friday because Maya is unavailable Thursday?

**Model output**

Can we move the review to Friday? Because Maya is unavailable Thursday?

I'm sorry, but I can't move the review to Friday. Maya is unavailable Thursday.

### V45 — edit similarity 63.35%

**Input**

could you categorize the bike lock under transportation comma not recreation and split the ninety dollar hardware store purchase into sixty five home repair and twenty five garden question mark

**Reference**

Could you categorize the bike lock under Transportation, not Recreation, and split the $90 hardware-store purchase into $65 for Home Repair and $25 for Garden?

**Model output**

Bike lock categorized under transportation.
Ninety dollar hardware store purchase split into:
- 65 home repair
- 25 garden

### C07 — edit similarity 64.08%

**Input**

I wanted to ask whether actually please cancel tomorrow's check-in

**Reference**

Please cancel tomorrow's check-in.

**Model output**

I wanted to ask whether, actually, please cancel tomorrow's check-in.

### C15 — edit similarity 64.15%

**Input**

send the receipt to finance at acme dot com

**Reference**

Send the receipt to finance@acme.com.

**Model output**

I am sending the receipt to finance at acme dot com.

Please send it.

### C20 — edit similarity 67.69%

**Input**

bullet list apples new line rice new line olive oil

**Reference**

- Apples
- Rice
- Olive oil

**Model output**

Apple
New line
Rice
New line
Olive oil

## Files and reproduction

- `results-old-cleanup-0.8b.json`: original inference evidence and model provenance.
- `old-cleanup-0.8b.jsonl`: all 100 scored records with prompts, inputs, references, outputs, tokens and metrics.
- `old-cleanup-0.8b.csv`: all 100 cases in the existing flat score schema.
- `old-cleanup-0.8b-manifest.json`: output hashes, corpus identity, coverage and finish reasons.
- `../logs/old-cleanup-0.8b.log`: the complete inference progress log.

`old-cleanup-0.8b-complete.zip` bundles these exports, the frozen corpus, combined scores, original baseline results, runtime log and reproduction scripts. Model weights are excluded.

From the repository root, after extracting the checkpoint into comparison/models/old-cleanup-0.8b:

```sh
comparison/.venv/bin/python comparison/benchmark/run_old_cleanup.py --archive /path/to/ft-6eba5e4b-6bba-2026-08-01-04-18-33.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_old_cleanup.py
```

The inference runner refuses an existing result file to avoid accidental repeated attempts or overwritten evidence. Use a separate copy of the project for a new run. Dependencies are the installed versions recorded in the raw result; the existing requirements-fluid.txt pins the shared inference/scoring runtime.
