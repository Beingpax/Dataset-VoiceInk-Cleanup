# Reproducing the benchmark

## Fixed comparison corpus

All inference runners and the scorer use `artifacts/benchmark-corpus.jsonl`, the exact 100 inputs/references used by the previously published baselines. Case IDs alone are not sufficient to identify an evaluation: 27 curated inputs had been expanded in `sample.jsonl` after the existing baselines were run. Sampling/integration scripts continue to produce that separate working sample; they do not silently replace the fixed comparison corpus.

The initial Fluid-1 Mini 2B 6-bit evaluation on the expanded working sample is preserved under `artifacts/archive/fluid-expanded-corpus/`, together with its source corpus. For the final comparison, 73 unchanged prompts retain their original outputs and 27 changed-input cases are regenerated on the fixed corpus. The Fluid artifact records this alignment and its inference sessions. Baseline inputs and references are preserved from their original published evidence. The scorer rejects recorded-source or corpus-fingerprint mismatches instead of pairing old outputs with new inputs.

To benchmark a deliberately revised corpus, create a separately versioned comparison and rerun affected models. Do not overwrite the fixed corpus and reuse old results merely because the IDs still match. The scorer publishes the fixed corpus to the React viewer's `benchmark-sample.jsonl` as well as recording its fingerprint in the result exports.

## Working sample preparation

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

## Fluid checkpoint evaluation

The fixed comparison corpus contains 100 cases: 50 VoiceInk validation cases and 50 curated cleanup pairs. Fluid-1 Mini 2B 6-bit is evaluated on all 100, producing 100 final outputs. The other benchmark models' outputs are retained.

ALTIC restricts this checkpoint to official FluidVoice applications unless separately authorized. The user confirmed written permission for this evaluation. Only run the following commands with the appropriate permission; the weights stay in the ignored `models/` directory and are not redistributed with the artifacts.

From `comparison/`, with a Python 3.12 virtual environment at `.venv/`:

```sh
uv pip install --python .venv/bin/python --only-binary :all: -r benchmark/requirements-fluid.txt
.venv/bin/python benchmark/run_fluid.py --model mini-6bit --permission-confirmed
.venv/bin/python benchmark/score_results.py
```

The runner pins the repository revision and runs only the Mini 2B 6-bit configuration. `--download-only` fetches the checkpoint without inference; `--offline` uses downloaded files. Interrupted runs resume from saved cases, while `--retry-errors` explicitly retries failed cases and preserves previous attempts.

- Mini 6-bit: `altic-dev/Fluid-1-Mini-2B-MLX-6bit`, revision `a2ab739606c1648dae526db12ec4b5f7bbf0bc9c`.

The model uses the stored dataset system instruction plus raw ASR input through its bundled chat template, with thinking disabled, temperature zero, and the same input-length token-budget rule used by the VoiceInk runner. References and category labels are never supplied to inference. Outputs are saved without text cleanup; the existing scorer trims outer whitespace for its existing string metrics. Token-limit terminations are retained as failed cases rather than silently scored as complete responses.

The public checkpoint includes DFlash draft tensors. The runner excludes only those auxiliary tensors in memory and strictly loads the target model, preserving its published quantization. DFlash, cross-case prompt caching, and warmup are disabled. Latency includes prompt processing and generation, excludes download/load/tokenization/checkpoint writes, and includes first-case cold-start costs. Throughput uses output token count divided by that same interval; peak memory is process RSS. These timings describe standard MLX LM, not FluidVoice's private FluidDecode/DFlash implementation or its application-level formatting.

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
