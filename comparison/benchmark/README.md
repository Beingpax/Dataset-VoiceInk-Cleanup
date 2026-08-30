# Reproducing the benchmark

All paths remain inside `comparison/`. The sample is deterministic and records the original validation row index. It contains the preserved original 20-case sample plus 30 cases sampled with seed `20260831` from the longest 30% of the remaining validation inputs.

The second dataset uses the preserved benchmark snapshot at `artifacts/curated-sample-50.source.jsonl`. `benchmark/integrate_curated_sample.py` reads that snapshot, preserves its metadata, and appends normalized cases `C01`–`C50` to the benchmark corpus. The separate generator collection has been removed; reproduction does not depend on it.

```sh
export HF_HOME="$PWD/models/hf-cache"
.venv/bin/python benchmark/prepare_sample.py
.venv/bin/python benchmark/integrate_curated_sample.py
.venv/bin/python benchmark/run_voiceink.py
.venv/bin/python benchmark/run_speakoflow.py
.venv/bin/python benchmark/score_results.py
```

Run these commands from the `comparison/` directory. Model directories and weights are intentionally excluded from Git and must be supplied locally at the paths expected by the runner scripts.

The hosted GPT-5.6 Sol low-reasoning result is stored in `artifacts/results-gpt-5.6-sol-low.json`. Provider-side peak memory and generation throughput are not exposed to this benchmark and are recorded as unavailable.

## Measurement notes

- All local models run sequentially on an Apple M2 Pro with 16 GB unified memory.
- VoiceInk uses its native 4-bit MLX repository.
- SpeakoFlow uses the Q8_0 GGUF identified by its model card and a persistent llama.cpp server.
- Per-case speed is decoded output tokens divided by wall-clock request/generation time. Tokenizers differ by model, so rates are operational throughput, not a normalized linguistic measure.
- Peak local memory is macOS peak RSS for the inference process or server process tree. Unified-memory accounting and framework allocation strategies make it an approximate footprint, not a model-weight-only measurement.

## Comparison fairness

- Complete runs with no known reference-derived hints are ranked within the selected dataset. Eligibility concerns recorded inference settings, not human-review provenance or training-data contamination.
- The native prompts differ across systems. These are configuration comparisons, not controlled measurements of model capability under an identical prompt.

## Failure-aware summaries

Scoring version `fairness-v1` uses the benchmark sample as the complete expected case roster for every model. A missing result becomes an explicit failed case; duplicate or unknown result IDs are rejected rather than silently changing the denominator.

- `case_count` includes all expected cases, for both combined and dataset-specific summaries.
- `successful_cases`, `failed_cases`, and `success_rate` expose completion separately from text quality.
- `exact_matches` is the integer count of successful exact outputs. `exact_match_rate` divides that count by all expected cases, not just successful ones.
- Edit similarity, chrF++, WER, and runtime statistics remain conditional on successful cases. Their formulas are unchanged. Failed cases have unavailable text metrics; an all-failed dataset remains present with null quality means and zero completion/exact rates.
- Incomplete runs retain their measured scores in the table but receive no rank or chart point. This prevents a run measured on an easier surviving subset from competing against complete runs.

The React application derives failure-aware counts from saved per-case records, including older snapshots, and flags unverified inference context without rewriting the stored outputs. Case review shows failed and missing results explicitly.

## Publishing updated artifacts

When explicitly run, `benchmark/score_results.py` publishes the same JSON payload to `artifacts/benchmark-results.json`, `site/data/benchmark.json`, `../public/data/benchmark.json`, and `../public/downloads/benchmark-results.json`. It also updates the public aggregate and per-case CSV downloads with failure and context fields.

Code changes alone do not rerun models or republish saved downloads.
