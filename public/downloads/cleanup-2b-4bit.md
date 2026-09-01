# Cleanup Qwen3.5 2B — text-only MLX 4-bit

Completed 2026-08-31T06:27:00.507251+00:00. All 100 cases attempted once; no retries or output post-processing.

| Measurement | Result |
| --- | ---: |
| Completed normally | 100/100 |
| Failed/token-limited | 0/100 |
| Exact reference matches | 24/100 |
| Mean edit similarity | 95.23% |
| Mean chrF++ | 88.88% |
| Mean word error rate (lower is better) | 18.88% |
| Mean latency | 0.641 s |
| Median throughput | 43.2 tokens/s |
| Peak process RSS | 1.593 GiB |

Completion is not correctness. String similarity is not a semantic accuracy percentage. Means are conditional on successful cases; exact-match and completion totals include all 100.

## Conversion

Used the installed official `mlx_lm.convert.convert` with affine quantization, 4 bits and group size 64. Its native Qwen3.5 sanitizer omitted vision and auxiliary MTP tensors. No calibration, retraining, activation quantization or KV-cache quantization was performed. Nonquantized parameters retain the converter's BF16/FP32 handling, including protected A_log tensors.

Text parameter count: 1,881,825,088. Text tensor storage: 3.764 GB before quantization; 1.059 GB after. Vision omitted: 662.8 MB; MTP omitted: 121.7 MB. Sizes use decimal units. Packed 4-bit weights also require scales/biases and floating tensors.

Strict reload; all quantized modules are affine 4-bit/group64; no vision/MTP tensors; identical prompt token IDs on 100 cases and identical EOS IDs; source hashes unchanged.

Text-only MLX weights. Floating norms, scales/biases and sensitive tensors are not all 4-bit. Original multimodal config/tokenizer metadata is retained by the official converter but no vision parameters are saved.

Official implementation references:

- https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/convert.py
- https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/models/qwen3_5.py

## Benchmark protocol and limitations

The existing frozen corpus, stored system instructions, greedy decoding, thinking disabled, seed 0, input-length token budget, no warmup and no cross-case cache match the earlier cleanup runs. References and error labels are never supplied to inference. Latency covers prompt processing and generation, including first-case cold start; it excludes loading, tokenization and evidence writes. Throughput uses retokenized output counts to match the existing benchmark convention.

No full-precision 2B benchmark was run. Consequently these results do not measure the quality loss caused by quantization alone. Differences from 0.8B include the base model, training and quantization. The user identifies the same training data; exact archive training provenance and overlap remain unverified. Timing reflects one local session, not repeated controlled trials.

## Dataset breakdown

- curated-sample-50: 50/50 completed; 21 exact; edit similarity 95.86%.
- voiceink-validation: 50/50 completed; 3 exact; edit similarity 94.60%.

## Files

Model directory: `comparison/models/cleanup-2b-4bit/` (ignored by Git).
Source archive: `ft-30b873e1-16c9-2026-08-31-06-15-24.tar.zst`; original untouched.
Source SHA-256: `7a0b2c10e289f7b640b37b6cf8287bf0a7c737e5260e37504bfda10d3d79260f`.
Frozen corpus SHA-256: `ab445a000fb5908a8ad57bd24b74530ce4071387537126eaef154d56c25f0f70`.

The JSONL/CSV exports contain all 100 inputs, references, raw outputs and scores. The evidence ZIP includes the raw run, conversion manifest, frozen corpus, logs and reproduction scripts; it excludes model weights. Dashboard and aggregate downloads include this new configuration alongside unchanged baselines.
