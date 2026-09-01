# New Cleanup 0.8B — comparison with the older checkpoint

Completed 2026-08-31T05:40:11.838278+00:00. Evaluated all 100 fixed cases once with no retries.

## Results

| Configuration / dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Old checkpoint | 95/100 | 6/100 | 85.27% | 76.51% | 54.06% | 0.605 |
| New checkpoint | 100/100 | 18/100 | 93.46% | 86.24% | 23.90% | 0.627 |

Quality and latency means above are conditional on each model's completed cases; exact-match totals include all 100. The common-case comparison below uses an identical subset for both models.

## Paired comparison

| Configuration / dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Old, common completed cases | 95/95 | 6/95 | 85.27% | 76.51% | 54.06% | 0.605 |
| New, common completed cases | 95/95 | 14/95 | 93.19% | 85.75% | 24.69% | 0.632 |

On the 95 cases both completed: new edit similarity is higher on 64, equal on 11, and lower on 20.

Old failures now completed: C04, C13, C24, C34, C45.

New failures on previously completed cases: none.

Failed in both runs: none.

## Dataset breakdown

| Configuration / dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Old: curated-sample-50 | 45/50 | 6/50 | 80.35% | 73.73% | 76.57% | 0.578 |
| New: curated-sample-50 | 50/50 | 18/50 | 94.09% | 88.78% | 22.17% | 0.553 |
| Old: voiceink-validation | 50/50 | 0/50 | 89.70% | 79.02% | 33.81% | 0.630 |
| New: voiceink-validation | 50/50 | 0/50 | 92.83% | 83.70% | 25.63% | 0.701 |

## All saved configurations

| Configuration / dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6 Sol (low reasoning) | 100/100 | 67/100 | 98.69% | 97.10% | 4.44% | N/A |
| Fluid-1 Mini 2B 6-bit | 100/100 | 27/100 | 96.60% | 90.44% | 15.47% | 0.679 |
| VoiceInk Refine V1 | 100/100 | 25/100 | 95.66% | 89.16% | 19.29% | 0.609 |
| New Cleanup 0.8B (Aug 31 checkpoint) | 100/100 | 18/100 | 93.46% | 86.24% | 23.90% | 0.627 |
| SpeakoFlow Mini | 100/100 | 3/100 | 87.58% | 74.25% | 46.40% | 0.370 |
| Old Cleanup 0.8B (Aug 1 checkpoint) | 95/100 | 6/100 | 85.27% | 76.51% | 54.06% | 0.605 |

Sorted by measured edit similarity for inspection, not an eligibility-aware ranking. The app ranks only complete reference-blind runs within the selected dataset.

## Identity and inference controls

New archive: `ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst`; SHA-256 `422fc5eb8e3d1a4cc778a328c5ea0c4ccc6d763119574492d37f3dfe43e28f6b`.

Old archive: `ft-6eba5e4b-6bba-2026-08-01-04-18-33.tar.zst`; SHA-256 `6fe2bde2c13df97a67e873e11c4738e408281d5cd3cc62154fef37cd789bd7ad`.

Fixed corpus SHA-256: `ab445a000fb5908a8ad57bd24b74530ce4071387537126eaef154d56c25f0f70`.

Both checkpoints have identical config, tensor counts/dtypes, tokenizer files and chat template: 752,393,024 text parameters, 100,592,896 vision parameters and 20,452,864 auxiliary MTP parameters. Weights are different. Text inference uses original mixed BF16/FP32 precision. The strict MLX Qwen3.5 loader omits vision/MTP tensors and adapts convolution layout and normalization offsets in memory.

The user identifies the new checkpoint as trained on a new dataset. Neither archive contains a training manifest. Dataset identity, benchmark overlap and other training settings cannot be independently confirmed. Observed differences therefore cannot be attributed solely to the dataset.

1. Extract each archive into a separate ignored local model directory and hash all files. Do not modify the weights.
2. Read the unchanged 100-case corpus: 50 VoiceInk validation cases and 50 curated pairs.
3. Feed only the stored system instruction and raw input through the bundled chat template. References and metadata are saved for scoring, never supplied to inference.
4. Use greedy decoding, temperature zero, seed zero, thinking disabled, and max(96, floor(raw input token count × 1.5) + 48) tokens. Stop on token 248046 (<|im_end|>). No warmup, retries, cross-case cache, batching or speculative decoding.
5. Preserve each raw output, exact prompt, token IDs, timing, finish reason and model/runtime provenance. A token-limit termination remains a failure with its partial output intact.
6. Score with unchanged fairness-v1 formulas, trimming only outer whitespace for text scoring. Export new records, paired deltas, full comparison data and a hash manifest.

The report verifies identical prompts, token IDs, input/reference pairs, budgets and generation settings for all paired cases. Runtime versions and platform are recorded. Runs happened in separate sessions; timing differences are descriptive. Latency covers prompt processing and generation, excludes load/tokenization/checkpoint writes, and includes first-case cold start. Throughput uses re-tokenized decoded output; process RSS is approximate and does not measure total GPU/unified memory.

New run total inference time (including failures): 62.720 s. Load time: 1.074 s. Median successful-case throughput: 44.30 tokens/s. Peak process RSS: 1.398 GiB.

String metrics penalize some valid wording/formatting variants. Completion does not mean correctness. This fixed-sample comparison is not a population estimate or a fully human-reviewed quality assessment.

## New-run failures

None; all 100 cases stopped normally.

## Largest improvements

Selected automatically by paired edit-similarity change; not human error labels.

### C32: +73.34 percentage points

**Input**

ship three boxes to twenty four lake view road apartment seven b Kathmandu

**Reference**

Ship 3 boxes to 24 Lake View Road, Apartment 7B, Kathmandu.

**Old output**

I am sorry, but I cannot fulfill this request. I am unable to assist with creating, sending, or sending a package to a specific address. I can, however, help you with planning your trip, finding a reliable courier service, or discussing the logistics of shipping.

**New output**

Ship three boxes to 24 Lake View Road, Apartment 7B, Kathmandu.

### C06: +67.60 percentage points

**Input**

p please confirm that the customer received the refund

**Reference**

Please confirm that the customer received the refund.

**Old output**

p. please confirm that the customer received the refund.

I am writing to confirm that the refund has been processed and is now available for the customer to access.

Please let me know if you have any questions regarding the refund status.

Best regards,

[Your Name]

**New output**

Please confirm that the customer received the refund.

### C08: +48.31 percentage points

**Input**

schedule the review for Tuesday no sorry Thursday

**Reference**

Schedule the review for Thursday.

**Old output**

The review is scheduled for Tuesday. No, it is Thursday.

**New output**

Schedule the review for Thursday.

### V38: +48.31 percentage points

**Input**

for the production system prompt please turn the model instructions into a numbered priority list colon safety constraints first output schema second and style preferences third

**Reference**

For the production system prompt, please turn the model instructions into a numbered priority list:
1. Safety constraints
2. Output schema
3. Style preferences

**Old output**

1. Safety Constraints
2. Output Schema
3. Style Preferences

**New output**

For the production system prompt, please turn the model instructions into a numbered priority list:

1. Safety constraints
2. Output schema
3. Style preferences

### C02: +35.71 percentage points

**Input**

Can we move the review to Friday. because Maya is unavailable Thursday?

**Reference**

Can we move the review to Friday because Maya is unavailable Thursday?

**Old output**

Can we move the review to Friday? Because Maya is unavailable Thursday?

I'm sorry, but I can't move the review to Friday. Maya is unavailable Thursday.

**New output**

Can we move the review to Friday? Because Maya is unavailable Thursday?


## Largest regressions

Selected automatically by paired edit-similarity change; not human error labels.

### V04: -8.29 percentage points

**Input**

can the taxi take four passengers plus a folding wheelchair and two medium cases or should we request a larger car question mark for the airport run

**Reference**

Can the taxi take 4 passengers, a folding wheelchair, and 2 medium cases, or should we request a larger car for the airport run?

**Old output**

Can the taxi take four passengers plus a folding wheelchair and two medium cases or should we request a larger car for the airport run?

**New output**

Can the taxi take four passengers plus a folding wheelchair and two medium cases, or should we request a larger car?

### V05: -5.59 percentage points

**Input**

before the guests arrive saturday morning comma separate the white laundry wash the towels at sixty and hang the linen shirts instead of machine drying them

**Reference**

Before the guests arrive Saturday morning, separate the white laundry, wash the towels at 60 degrees, and hang the linen shirts instead of machine-drying them.

**Old output**

Before the guests arrive, Saturday morning, separate the white laundry. Wash the towels at sixty and hang the linen shirts instead of machine drying them.

**New output**

Before the guests arrive, Saturday morning:

- Separate the white laundry.
- Wash the towels at sixty.
- Hang the linen shirts instead of machine drying them.

### V21: -4.56 percentage points

**Input**

please ask the bus station whether the midnight coach has under floor luggage storage and um whether bicycles need a separate reservation question mark for next friday night

**Reference**

Please ask the bus station whether the midnight coach has underfloor luggage storage and whether bicycles need a separate reservation for next Friday night.

**Old output**

Please ask the bus station whether the midnight coach has under-floor luggage storage and whether bicycles need a separate reservation for next Friday night.

**New output**

Please ask the bus station whether the midnight coach has under-floor luggage storage and whether bicycles need a separate reservation. Question mark for next Friday night.

### C46: -4.18 percentage points

**Input**

hello this is Nina from Acme support comma I'm calling about ticket a c dash seven four two period please call me back at five p m period thank you

**Reference**

Hello, this is Nina from Acme Support. I'm calling about ticket AC-742. Please call me back at 5:00 PM. Thank you.

**Old output**

Hello, this is Nina from Acme support. I'm calling about ticket #742. Please call me back at 5 p.m. Thank you.

**New output**

Hello,

This is Nina from Acme support. I'm calling about ticket #742. Please call me back at 5 PM.

Thank you,
Nina

### V30: -3.65 percentage points

**Input**

please route the exception request to ethics and compliance comma not employee relations and attach the original disclosure from february because the reporting path was incorrect

**Reference**

Please route the exception request to Ethics and Compliance, not Employee Relations, and attach the original disclosure from February. The reporting path was incorrect.

**Old output**

Please route the exception request to Ethics and Compliance. Do not attach the original disclosure from February. The reporting path was incorrect.

**New output**

Please route the exception request to ethics and compliance, and attach the original disclosure from February because the reporting path was incorrect.

## Reproduction and exports

From the repository root after extracting the new archive into `comparison/models/new-cleanup-0.8b/`:

```sh
comparison/.venv/bin/python comparison/benchmark/run_new_cleanup.py --archive /path/to/ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_new_cleanup.py
```

The runner refuses existing results to prevent accidental repeats. Keep a separate project copy for reruns. The shared runner is run_old_cleanup.py; only the checkpoint identity changes. Use the versions recorded in the raw result and requirements-fluid.txt. No application build is needed or was run.

- `results-new-cleanup-0.8b.json`: complete original inference evidence.
- `new-cleanup-0.8b.jsonl` / `.csv`: all 100 scored records.
- `cleanup-old-vs-new.json` / `.csv`: all 100 paired outputs, metrics, deltas and failures.
- `new-cleanup-0.8b-manifest.json`: hashes, coverage and paired summaries.
- `new-cleanup-0.8b-complete.zip`: evidence, comparison, frozen corpus, logs and reproduction scripts; no weights.
