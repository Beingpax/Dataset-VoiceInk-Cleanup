# Transcript Cleanup Benchmark

## Benchmark created

The benchmark compares four transcript-cleanup configurations across 100 cases:

1. VoiceInk Refine V1, running locally through MLX LM with 4-bit weights.
2. SpeakoFlow Mini, running locally as Q8_0 GGUF through a persistent llama.cpp server.
3. GPT-5.6 Sol at low reasoning as a hosted reference configuration.
4. Fluid-1 Mini 2B with 6-bit weights through MLX LM.

The Fluid run uses the existing dataset cleanup instructions, no reference-derived context, and greedy target-model decoding with thinking disabled. It does not use FluidVoice's private FluidDecode/DFlash engine. The model revision and environment versions are recorded, and ALTIC permission was confirmed by the user before execution.

## Datasets

The 100 cases remain divided into two explicitly labeled sources:

- `voiceink-validation`: 50 cases from the original 1,829-row validation set. The original 20-case fixed-seed random sample is preserved. Thirty additional cases were sampled with seed `20260831` from the longest 30 percent of the remaining inputs.
- `curated-sample-50`: the 50 curated pairs in the fixed `artifacts/benchmark-corpus.jsonl`, matching the original published baseline evidence with category metadata intact. The newer working snapshot in `artifacts/curated-sample-50.source.jsonl` is retained separately. Neither depends on the removed generator collection.

The separate working curated snapshot follows the natural-dictation revision: lists, titles, email layout, greetings, and sign-offs are inferred from content rather than artificial `heading`, `bullet list`, or `numbered list` prefixes. Its expanded length mix and later edits are not retroactively applied to historical benchmark outputs.

The datasets are not silently merged in reporting. The website can show combined results or either dataset independently.

The comparison is frozen to `artifacts/benchmark-corpus.jsonl`, matching the inputs and references of the original published baselines. The newer expanded working sample remains in `artifacts/sample.jsonl`. Its initial Fluid results are preserved separately in `artifacts/archive/fluid-expanded-corpus/`; only changed-input cases were rerun to align the final comparison. Source text and corpus fingerprints prevent future scoring against silently changed examples.

## Measurements and outputs

The project preserves:

- Exact-match rate.
- Normalized Levenshtein edit similarity.
- chrF++.
- Word error rate.
- Per-case and aggregate latency.
- Output tokens per second for local models.
- Approximate peak process or process-tree RSS for local models.
- Complete prompts, runtime configuration, raw inputs, human references, and model outputs.

Hosted-provider throughput, latency, and peak memory were not exposed and remain recorded as unavailable rather than estimated.

## Website

`site/` is a dependency-free modular website containing:

- Dataset-specific and combined rankings.
- A quality scatterplot.
- Model runtime and prompt dossiers.
- A 100-case evidence browser.
- Download links for JSONL, JSON, and CSV artifacts.
- An integrated JSONL dataset viewer implemented in `site/jsonl-viewer.js`.

The JSONL viewer understands both chat-message training records and benchmark-style `input` / `reference` records. It can load the curated generator sample, benchmark corpus, validation split, training split, or a local JSONL file.

## Reproduction assets

- `benchmark/prepare_sample.py`: deterministic validation sampling.
- `benchmark/integrate_curated_sample.py`: curated generator-sample integration.
- `benchmark/run_voiceink.py`: VoiceInk local inference.
- `benchmark/run_speakoflow.py`: SpeakoFlow local inference and process-tree memory monitoring.
- `benchmark/run_fluid.py`: pinned Fluid-1 Mini 2B 6-bit checkpoint, resumable inference, and recorded prompt/runtime provenance.
- `benchmark/score_results.py`: scoring and website-data generation.
- `artifacts/`: complete model results, combined benchmark JSON, sampled JSONL, and CSV exports.

Downloaded models and local environments are intentionally absent from the repository.
