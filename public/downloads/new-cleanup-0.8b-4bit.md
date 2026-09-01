# New Cleanup 0.8B: original precision versus 4-bit

Completed 2026-08-31T05:49:15.256621+00:00. Each quantized-model case was attempted once; no retries.

## Benchmark results

| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds | Median tokens/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original BF16/FP32 | 100/100 | 18/100 | 93.46% | 86.24% | 23.90% | 0.627 | 44.30 |
| 4-bit affine / group 64 | 100/100 | 12/100 | 92.80% | 83.69% | 25.80% | 0.457 | 60.58 |

Quality and timing means use each run's successful cases; exact-match totals include all 100 expected cases. A normal EOS stop means completion, not correctness.

## Common completed cases

| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds | Median tokens/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original, shared cases | 100/100 | 18/100 | 93.46% | 86.24% | 23.90% | 0.627 | 44.30 |
| 4-bit, shared cases | 100/100 | 12/100 | 92.80% | 83.69% | 25.80% | 0.457 | 60.58 |

Across 100 shared completed cases, 4-bit edit similarity was higher on 29, equal on 31, and lower on 40. Raw outputs were identical on 28 of all 100 cases.

Quantized-model failures: none.

## Dataset breakdown

| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds | Median tokens/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Original: curated-sample-50 | 50/50 | 18/50 | 94.09% | 88.78% | 22.17% | 0.553 | 33.91 |
| 4-bit: curated-sample-50 | 50/50 | 12/50 | 92.73% | 84.31% | 26.97% | 0.486 | 35.90 |
| Original: voiceink-validation | 50/50 | 0/50 | 92.83% | 83.70% | 25.63% | 0.701 | 47.32 |
| 4-bit: voiceink-validation | 50/50 | 0/50 | 92.86% | 83.07% | 24.62% | 0.428 | 74.19 |

## Memory and storage

| Measurement | Original | 4-bit |
| --- | ---: | ---: |
| Text tensor storage | 1435.08 MiB | 404.30 MiB |
| Inference peak process RSS | 1.398 GiB | 0.784 GiB |

Text tensor storage fell by 71.83%. The saved 4-bit safetensors file is 404.39 MiB including its header. Effective storage is 4.508 bits per original text parameter, because scales/biases and nonquantized tensors add overhead beyond packed 4-bit weights.

The source archive also contains vision and MTP weights, omitted from this text-only export. The text-tensor comparison above excludes those components on both sides; comparing the full source file size with the text-only quantized file would overstate quantization savings. RSS is process memory, not total unified/GPU memory, and was measured in separate inference processes rather than the conversion process.

## Conversion and controlled evaluation

Source: `ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst`; SHA-256 `422fc5eb8e3d1a4cc778a328c5ea0c4ccc6d763119574492d37f3dfe43e28f6b`. Corpus SHA-256: `ab445a000fb5908a8ad57bd24b74530ce4071387537126eaef154d56c25f0f70`.

The converter strictly loads the source text model (752,393,024 parameters), then quantizes 187 eligible linear/embedding modules using MLX affine 4-bit weights and group size 64. 133 nonquantized tensors retain their exact loaded values and dtypes. The CLI converter's optional global dtype cast is deliberately avoided. No calibration, retraining, mixed-bit recipe, activation quantization or KV-cache quantization is used.

The source is never overwritten. The saved artifact is strictly reloaded and every tensor checked for exact equality with its in-memory converted counterpart. Tokenizer files/chat template are copied byte-for-byte; EOS remains 248046. No inference is used to choose quantization settings.

All 100 cases use identical input/reference records, system instructions, rendered prompts, prompt token IDs, token budgets and generation settings as the original-precision run. References are never fed to the model. Greedy decoding uses temperature zero, seed zero and thinking disabled. The token budget is max(96, floor(raw-input-token-count × 1.5) + 48). No warmup, cross-case prompt cache or speculative decoding is used.

Raw outputs, prompts, token IDs, finish reasons, timestamps, versions and hashes are saved. The unchanged fairness-v1 scorer trims only outer whitespace for scoring, retaining failures and raw outputs. Latency includes prompt processing and generation, including first-case cold start, but excludes model load, tokenization and artifact writes. Throughput uses re-tokenized decoded output, matching the existing benchmark convention.

This is one run per checkpoint in separate sessions. Timing differences are descriptive, not repeated-trial estimates. String metrics can penalize valid variants. Training overlap remains unverified, and these 100 cases do not establish general quality.

## Other saved configurations

| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds | Median tokens/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6 Sol (low reasoning) | 100/100 | 67/100 | 98.69% | 97.10% | 4.44% | N/A | N/A |
| Fluid-1 Mini 2B 6-bit | 100/100 | 27/100 | 96.60% | 90.44% | 15.47% | 0.679 | 34.52 |
| VoiceInk Refine V1 | 100/100 | 25/100 | 95.66% | 89.16% | 19.29% | 0.609 | 48.34 |
| New Cleanup 0.8B (Aug 31 checkpoint) | 100/100 | 18/100 | 93.46% | 86.24% | 23.90% | 0.627 | 44.30 |
| New Cleanup 0.8B 4-bit | 100/100 | 12/100 | 92.80% | 83.69% | 25.80% | 0.457 | 60.58 |
| SpeakoFlow Mini | 100/100 | 3/100 | 87.58% | 74.25% | 46.40% | 0.370 | 69.14 |
| Old Cleanup 0.8B (Aug 1 checkpoint) | 95/100 | 6/100 | 85.27% | 76.51% | 54.06% | 0.605 | 49.60 |

This table is sorted by measured similarity for inspection. The viewer ranks only complete, reference-blind runs in the selected dataset.

## Largest improvements

Selected by paired edit-similarity change, not human error labels.

### V15: +20.99 percentage points

**Input**

thirty minute discharge test reading colon battery bank voltage was twenty five point six at rest comma then dropped to twenty two point nine under inverter load

**Reference**

30-minute discharge-test reading: Battery-bank voltage was 25.6 at rest, then dropped to 22.9 under inverter load.

**Original output**

Thirty-minute discharge test reading:
- Battery bank voltage at rest: 25.6 V
- Battery bank voltage under inverter load: 22.9 V

**4-bit output**

Thirty-minute discharge test reading: Battery bank voltage was 25.6V at rest, then dropped to 22.9V under inverter load.

### C47: +17.39 percentage points

**Input**

heading launch checklist new paragraph bullet list open quote release approved close quote from Maya new line deploy version three point two new line email status at acme dot com after launch

**Reference**

# Launch Checklist

- “Release approved,” from Maya.
- Deploy version 3.2.
- Email status@acme.com after launch.

**Original output**

Launch Checklist

- Open quote release approved close quote from Maya
- New line
- deploy version 3.2
- New line
- email status at acme.com after launch

**4-bit output**

Launch checklist:
- Release approved: from Maya
- Deploy version 3.2
- Email status: @acme.com after launch

### C33: +16.60 percentage points

**Input**

move the demo from September tenth at two p m no make that September eleventh at three thirty p m

**Reference**

Move the demo to September 11 at 3:30 PM.

**Original output**

Move the demo from September 10 at 2:00 PM to September 11 at 3:30 PM.

**4-bit output**

Move the demo from September 10 at 2:30 PM.

### C40: +11.03 percentage points

**Input**

open quote good writing is clear writing close quote new line dash Maya Chen

**Reference**

“Good writing is clear writing.”
—Maya Chen

**Original output**

Good writing is clear.

Maya Chen

**4-bit output**

Good writing is clear writing.

Maya Chen

### C37: +9.22 percentage points

**Input**

hello Marcus comma new paragraph please send the invoice to billing at north star dot io no sorry accounts at north star dot io new paragraph kind regards comma new line Lena

**Reference**

Hello Marcus,

Please send the invoice to accounts@northstar.io.

Kind regards,
Lena

**Original output**

Hello Marcus,

Please send the invoice to billing@northstar.io.

No sorry, accounts@northstar.io

Kind regards,
Lena

**4-bit output**

Hello Marcus,

Please send the invoice to billing@northstar.io.

Kind regards,
Lena

## Largest regressions

Selected by paired edit-similarity change, not human error labels.

### C20: -20.83 percentage points

**Input**

bullet list apples new line rice new line olive oil

**Reference**

- Apples
- Rice
- Olive oil

**Original output**

Apples
Rice
Olive oil

**4-bit output**

Apple, rice, and olive oil.

### C38: -20.55 percentage points

**Input**

bug report colon the app crashes when opening settings dot j son period attach crash log dash two zero two six zero eight three zero dot text and reference issue v o i dash nine one eight

**Reference**

Bug report: The app crashes when opening settings.json. Attach crash-log-20260830.txt and reference issue VOI-918.

**Original output**

Bug report: The app crashes when opening settings.

Attach crash log:
- Two-02-60830.txt
- reference issue: v9.1.8

**4-bit output**

Bug report: The app crashes when opening settings.
- Attach crash log:
  - Two zero two six zero eight three zero dot text and reference issue v o i dash nine one eight

### C21: -20.00 percentage points

**Input**

numbered list first back up the database second deploy the service third run the smoke tests

**Reference**

1. Back up the database.
2. Deploy the service.
3. Run the smoke tests.

**Original output**

1. Back up the database.
2. Deploy the service.
3. Run the smoke tests.

**4-bit output**

First, back up the database.
Second, deploy the service.
Third, run the smoke tests.

### V27: -14.11 percentage points

**Input**

following the latest litigation update the controller approved a two hundred fifty thousand reserve comma subject to receiving counsels final estimate before close by noon tomorrow

**Reference**

Following the latest litigation update, the Controller approved a $250,000 reserve, subject to receiving counsel’s final estimate before close. Counsel’s estimate is due by noon tomorrow.

**Original output**

Following the latest litigation update, the controller approved a $250,000 reserve, subject to receiving counsel. Final estimate before close by noon tomorrow.

**4-bit output**

The controller approved a $250,000 reserve, subject to receiving counsel final estimate before close by noon tomorrow.

### C27: -13.67 percentage points

**Input**

numbered list first archive the last thirty days of logs second increase the time out to forty five seconds third restart the a p i gateway

**Reference**

1. Archive the last 30 days of logs.
2. Increase the timeout to 45 seconds.
3. Restart the API gateway.

**Original output**

1. Archive the last 30 days of logs.
2. Increase the time-out to 45 seconds.
3. Restart the API gateway.

**4-bit output**

First, archive the last 30 days of logs.
Second, increase the timeout to 45 seconds.
Third, restart the API gateway.

## Artifacts and reproduction

The reusable MLX model is in `comparison/models/new-cleanup-0.8b-4bit/`; `comparison/models/new-cleanup-0.8b-4bit.zip` packages the same files. Both stay local and excluded from Git.

The complete evidence ZIP includes all 100 new records, paired comparisons, conversion manifest, source corpus, existing baseline outputs, runtime logs and reproduction scripts. It excludes model weights.

From the repository root:

```sh
comparison/.venv/bin/python comparison/benchmark/quantize_new_cleanup.py
comparison/.venv/bin/python comparison/benchmark/run_new_cleanup_4bit.py --archive /path/to/ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_cleanup_4bit.py
```

Conversion and inference refuse existing destinations/results; use a separate project copy for a new run. No existing baseline was rerun. No application build was run.
