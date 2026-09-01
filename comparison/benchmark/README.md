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

## Supplied older 0.8B cleanup checkpoint

`run_old_cleanup.py` evaluates the user-supplied `ft-6eba5e4b-6bba-2026-08-01-04-18-33.tar.zst` archive on the same frozen 100 cases. Its configuration identifies Qwen3.5, with 752,393,024 text parameters at original mixed BF16/FP32 precision. The archive does not identify its training dataset; “Old Cleanup 0.8B” is a descriptive label. The built-in MLX sanitizer strictly loads the text model and omits vision/MTP weights. No quantization is applied.

The completed run attempted each case exactly once: 95 stopped normally and five reached the token budget. Failed partial outputs are preserved, excluded from conditional quality means, and prevent ranking the configuration. The older checkpoint is distinct from the existing VoiceInk Refine V1 baseline; no baseline inference was repeated.

From the repository root, after extracting the archive into the ignored `comparison/models/old-cleanup-0.8b/` directory:

```sh
comparison/.venv/bin/python comparison/benchmark/run_old_cleanup.py --archive /path/to/ft-6eba5e4b-6bba-2026-08-01-04-18-33.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_old_cleanup.py
```

The inference runner refuses to overwrite an existing run. It uses the stored dataset system prompt and raw input, the bundled chat template with thinking disabled, greedy decoding, and the existing local token-budget rule. No retries, warmup or cross-case prompt cache are used. Archive/model/corpus hashes, actual prompts, token IDs, outputs, stop reasons, timestamps and versions are recorded in `artifacts/results-old-cleanup-0.8b.json`. The report and dedicated 100-case JSONL/CSV exports are under `artifacts/old-cleanup-0.8b.*` and copied to the public downloads folder.

## New-dataset 0.8B checkpoint comparison

The user-supplied `ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst` is recorded separately as **New Cleanup 0.8B (Aug 31 checkpoint)**. Its config, parameter counts/dtypes, tokenizer and chat template match the older checkpoint; weight hashes differ. The user identifies it as trained on a new dataset, but the archive contains no training manifest to confirm dataset identity or benchmark overlap.

`run_new_cleanup.py` reuses the older checkpoint's inference implementation with a separate identity, model directory and result path. All 100 prompts, token budgets, precision and generation settings are identical. Every case was attempted once: 100 stopped normally, with 18 exact matches. The older model and all existing baselines are preserved without rerunning inference.

From the repository root, after extraction to `comparison/models/new-cleanup-0.8b/`:

```sh
comparison/.venv/bin/python comparison/benchmark/run_new_cleanup.py --archive /path/to/ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_new_cleanup.py
```

`artifacts/new-cleanup-0.8b.md` documents the comparison. Dedicated JSONL/CSV exports contain all 100 scored cases; `cleanup-old-vs-new.json` and `.csv` include paired outputs, errors and metric deltas. Paired quality summaries use the 95 cases both models completed, while headline exact-match rates include all 100 expected cases. The complete ZIP includes raw evidence, corpus, baseline results, logs and reproduction scripts, excluding weights. New exports are also copied to `public/downloads/`. The old report, ZIP and raw evidence remain unchanged.

## New Cleanup 0.8B 4-bit

`quantize_new_cleanup.py` creates `models/new-cleanup-0.8b-4bit/` from the evaluated Aug 31 checkpoint using the installed MLX quantizer directly: affine 4-bit weights, group size 64, no calibration, activation quantization or KV-cache quantization. It preserves the original model, copies tokenizer files unchanged, and avoids a global dtype cast. The 187 eligible linear/embedding modules are quantized; 133 other tensors retain their exact loaded values and dtypes. Vision/MTP tensors are omitted, just as they are unused in baseline text inference. Strict reloading checks every saved tensor.

The 752,393,024-parameter text model uses 423,942,848 bytes of tensor storage after conversion versus 1,504,791,232 bytes before (71.83% smaller). Scales/biases and remaining floating tensors give 4.508 effective bits per text parameter. These sizes exclude vision/MTP tensors on both sides.

From the repository root:

```sh
comparison/.venv/bin/python comparison/benchmark/quantize_new_cleanup.py
comparison/.venv/bin/python comparison/benchmark/run_new_cleanup_4bit.py --archive /path/to/ft-bc3f05f0-41ba-2026-08-31-05-31-47.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_cleanup_4bit.py
```

The conversion script and inference runner refuse existing destinations/results. The quantized model completed all 100 unchanged cases once, with 12 exact matches. `artifacts/new-cleanup-0.8b-4bit.md` reports quality, timing, RSS and storage; `cleanup-full-vs-4bit.json`/`.csv` preserve every paired output and score. The reusable model ZIP is kept in ignored `models/`, and the evidence ZIP in `artifacts/` and public downloads excludes weights. All earlier outputs and reports remain unchanged. This is MLX text-model quantization, not a GGUF or multimodal export.

## Supplied Qwen3.5 2B — text-only 4-bit

The supplied `ft-30b873e1-16c9-2026-08-31-06-15-24.tar.zst` is preserved unchanged. Its merged checkpoint is extracted to ignored `models/cleanup-2b-source/`. `quantize_cleanup_2b.py` uses the official `mlx_lm.convert.convert` implementation (MLX-LM 0.31.3, MLX 0.32.2), with affine 4-bit weights and group size 64. The native Qwen3.5 sanitizer removes vision and auxiliary MTP tensors; no hand-selected language layers are removed. See the official [converter](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/convert.py) and [Qwen3.5 implementation](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/models/qwen3_5.py).

The text model has 1,881,825,088 parameters. Text tensor storage drops from 3.764 GB to 1.059 GB; 662.8 MB of vision and 121.7 MB of MTP tensors are separately omitted. These are decimal units. Quantization metadata and floating tensors make effective storage 4.503 bits per text parameter. The official converter retains multimodal config/tokenizer metadata, but the saved checkpoint contains no vision/MTP tensors and is intended for MLX-LM text inference. Conversion checks strict reload, 4-bit/group64 modules, unchanged original files, and identical prompt token IDs on all 100 cases.

`run_cleanup_2b_4bit.py` reuses the unchanged cleanup inference protocol. It attempted all 100 frozen cases once: all stopped normally, with 24 exact matches, 95.23% mean edit similarity, 88.88% mean chrF++, and 18.88% mean WER. Mean latency was 0.641 seconds, median throughput 43.2 tokens/s, and peak process RSS 1.593 GiB. Completion is not correctness; these are string metrics, not human accuracy scores. No full-precision 2B evaluation was requested/run, so quantization-only quality impact remains unknown.

From the repository root, after safe extraction into the source directory:

```sh
comparison/.venv/bin/python comparison/benchmark/quantize_cleanup_2b.py --archive /path/to/ft-30b873e1-16c9-2026-08-31-06-15-24.tar.zst
comparison/.venv/bin/python comparison/benchmark/run_cleanup_2b_4bit.py --archive /path/to/ft-30b873e1-16c9-2026-08-31-06-15-24.tar.zst
comparison/.venv/bin/python comparison/benchmark/score_results.py
comparison/.venv/bin/python comparison/benchmark/report_cleanup_2b.py
```

Conversion and inference refuse existing destinations/results. The text-only model is in `models/cleanup-2b-4bit/`; report, 100-case JSONL/CSV, raw run, conversion manifest and evidence ZIP are under `artifacts/cleanup-2b-4bit*` and public downloads. The evidence ZIP excludes weights. Existing baselines are not rerun; the scorer updates the dashboard, case browser, and aggregate downloads with the additional configuration.

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
