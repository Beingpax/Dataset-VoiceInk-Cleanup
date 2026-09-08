#!/usr/bin/env python3
"""Run the upstream Qwen3.5 2B MLX 4-bit model on the fixed corpus."""

import os
import sys

from mlx_benchmark_runner import ROOT, main


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    model_id = "qwen3.5-2b-original-4bit"
    model_path = ROOT / "models" / model_id
    if "--archive" not in sys.argv:
        sys.argv += ["--archive", str(model_path / "config.json")]
    main({
        "id": model_id,
        "name": "Qwen3.5 2B Original 4-bit",
        "short_name": "Qwen3.5 2B Original Q4",
        "runner_version": "qwen3.5-2b-original-mlx-v1",
        "runtime": "MLX 4-bit affine (group size 64; upstream post-trained model)",
        "source_url": "https://huggingface.co/mlx-community/Qwen3.5-2B-4bit",
        "training_dataset": "Upstream Qwen3.5 post-training; no cleanup fine-tuning. Benchmark overlap is unknown.",
        "loading": "Strict MLX-LM text loading of the mlx-community Qwen3.5-2B-4bit checkpoint; native sanitizer omits vision and auxiliary MTP tensors for text inference.",
        "extra_provenance": {
            "source_repo": "mlx-community/Qwen3.5-2B-4bit",
            "source_revision": "674aaa7240b91e8012fcad5d791b7dfe5ba90207",
            "upstream_model": "Qwen/Qwen3.5-2B",
            "configuration_note": "Original upstream post-trained configuration, not Qwen/Qwen3.5-2B-Base and not cleanup fine-tuned.",
        },
    })
