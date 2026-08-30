# Granite 4.2-3B: local 4-bit, non-thinking speed test

Measured on 31 August 2026 on this Mac. This is a Python MLX speed experiment, not a Swift integration test or an instruction-following benchmark.

## Configuration

- Hardware: Apple M2 Pro, 16 GiB unified memory, 10 CPU cores, macOS 26.6.2, AC power.
- Model: `Orvena/granite-4.2-3b-MLX-4bit`, revision `ae69a9d2d362ab7d8b1ccd457bdb784f2a4f3360`.
- Quantization: 4-bit affine, group size 64. Weight file: 2,059,005,406 bytes (2.059 GB).
- Runtime: MLX 0.32.2, MLX LM 0.31.3, Transformers 5.16.1, Python 3.10.20, Metal GPU.
- Thinking: explicitly disabled with `enable_thinking=False`. The rendered prompt was checked for a closed, empty thinking block.
- Sampling: IBM's recommended temperature 1.0 and top-p 0.95; seed 20260831 reset for each request.
- One request at a time, fresh KV cache for every request, no prompt-cache reuse, no KV quantization.
- Two short warm-up requests excluded from results; three repetitions per input length, interleaved short/medium/long.
- Model loading took 1.81 seconds, excluding Python startup and imports. This is one observation, not a controlled cold-disk measurement.

## Measured results

Values are medians of three runs unless identified as a maximum or range. Input words count only the transcript; prompt tokens include the system prompt and chat template.

| Transcript words | Prompt tokens | Generated output tokens | Generation speed | Time to first visible text | Complete response | Peak MLX allocation |
|---:|---:|---:|---:|---:|---:|---:|
| 28 | 102 | 28 | 69.65 tokens/s | 0.391 s | 0.822 s | 2.302 GB |
| 193 | 281 | 207 | 60.61 tokens/s | 0.765 s | 4.230 s | 2.613 GB |
| 537 | 653 | 574 | 58.71 tokens/s | 1.548 s | 11.345 s | 2.826 GB |

| Transcript length | Generation-speed range | Complete-response range | Median end-to-end throughput |
|---|---:|---:|---:|
| Short | 65.46–70.57 tokens/s | 0.815–0.844 s | 34.06 tokens/s |
| Medium | 55.22–64.27 tokens/s | 3.990–4.548 s | 48.94 tokens/s |
| Long | 46.47–59.57 tokens/s | 11.218–14.057 s | 50.60 tokens/s |

Generation speed is MLX LM's reported decode throughput after prompt processing, using its native token-counting convention. End-to-end throughput divides generated non-EOS output tokens by measured generation wall time, including prompt processing. Complete-response times exclude model loading, template rendering, and tokenization. Time to first visible text happened to equal time to first streamed token in these runs.

The first warm-up needed 3.42 seconds in total, including 2.95 seconds before the first token. The second warm-up needed 0.83 seconds. A newly started application can therefore have additional first-request overhead beyond model loading.

## Memory interpretation

The maximum active allocation reported by MLX was **2.826 GB (2.632 GiB)**. Loaded model allocations before generation were 2.062 GB. These measurements include MLX model and inference allocations; they are not a complete application RAM measurement or a guarantee for longer contexts.

macOS reported a cumulative process peak RSS of 0.626 GB. That number does not capture the full Metal/unified-memory footprint in this run and must not be presented as the model's total RAM use. The JSON records both measurements separately; do not add them as if they were disjoint.

## Scope and output observations

All nine measured requests ended normally at EOS, without reaching their token caps or emitting thinking tags. The seeded output was identical across the three repetitions of each input.

The short test uses one case from the existing 100-case cleanup corpus. The medium and long tests concatenate five and fifteen independent corpus inputs, respectively, separated by blank lines. They exercise longer prompts and outputs, but do not represent one coherent recorded conversation. The JSON preserves the input, source case IDs, prompt suffix, and full generated output for inspection.

This is not an IFEval/IFBench score or a formal cleanup-quality evaluation. Spot checking showed imperfect instruction following: the short response began in lowercase, and the medium response retained spoken formatting such as `new paragraph` and `six p m`. Throughput alone does not demonstrate suitability as a cleanup-model replacement.

Measurements were made during a normal desktop session, not under a controlled exclusive-use or thermal protocol. The slowest long run is retained, not discarded. No Qwen model was run in this experiment, so these results establish no speed ranking against Qwen.

## Files and reproduction

- Full raw outputs, settings, provenance, weight hash, per-run measurements, and summaries: `granite-4.2-3b-speed.json` beside this report.
- Runner: `../benchmark/run_granite_speed.py`.
- Exact installed Python packages: `../benchmark/granite-speed-requirements.txt`.
- Downloaded model: `../models/granite-4.2-3b-4bit/` (excluded from Git).

From the repository root, using the installed environment:

```sh
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HOME="$PWD/comparison/models/hf-cache" TOKENIZERS_PARALLELISM=false .venv/bin/python -u comparison/benchmark/run_granite_speed.py --output comparison/artifacts/granite-4.2-3b-speed-rerun.json
```

The environment was installed entirely from prebuilt wheels, without running build commands. The runner requires normal Metal GPU and hardware-information access. In a sandbox, the same access used for this run may be required.

The SHA-256 digest of `model.safetensors` is `56595f3deb2b08e240a6f56f495d3b81259d8c94ae751226d345c72cc682c629`.
