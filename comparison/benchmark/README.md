# Reproducing the benchmark

All paths remain inside `comparison/`. The sample is deterministic and records the original validation row index. It contains the preserved original 20-case sample plus 30 cases sampled with seed `20260831` from the longest 30% of the remaining validation inputs.

The second dataset is `../dataset-generator/data/sample-50.jsonl`. `benchmark/integrate_curated_sample.py` copies it to `artifacts/curated-sample-50.source.jsonl`, preserves its metadata, and appends normalized cases `C01`–`C50` to the benchmark corpus.

```sh
export HF_HOME="$PWD/models/hf-cache"
.venv/bin/python benchmark/prepare_sample.py
.venv/bin/python benchmark/integrate_curated_sample.py
.venv/bin/python benchmark/run_voiceink.py
.venv/bin/python benchmark/run_speakoflow.py
.venv/bin/python benchmark/run_s1.py
.venv/bin/python benchmark/score_results.py
```

Run these commands from the `comparison/` directory. Model directories and weights are intentionally excluded from Git and must be supplied locally at the paths expected by the runner scripts.

The hosted GPT-5.6 Sol low-reasoning result is stored in `artifacts/results-gpt-5.6-sol-low.json`. Provider-side peak memory and generation throughput are not exposed to this benchmark and are recorded as unavailable.

## Measurement notes

- All local models run sequentially on an Apple M2 Pro with 16 GB unified memory.
- VoiceInk uses its native 4-bit MLX repository.
- SpeakoFlow uses the Q8_0 GGUF identified by its model card and a persistent llama.cpp server.
- S1-mini uses the BF16 weights and the exact README system prompt, control line, and thinking-disabled chat template.
- Per-case speed is decoded output tokens divided by wall-clock request/generation time. Tokenizers differ by model, so rates are operational throughput, not a normalized linguistic measure.
- Peak local memory is macOS peak RSS for the inference process or server process tree. Unified-memory accounting and framework allocation strategies make it an approximate footprint, not a model-weight-only measurement.
