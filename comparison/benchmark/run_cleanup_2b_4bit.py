#!/usr/bin/env python3
"""Run the supplied 2B text-only 4-bit model on the fixed 100-case corpus."""

import json
import os

from run_old_cleanup import ROOT, main, sha256


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    model_id = "cleanup-2b-4bit"
    path = ROOT / "models" / model_id
    conversion = json.loads((path / "conversion.json").read_text())
    for name, digest in conversion["output_files_sha256"].items():
        assert sha256(path / name) == digest, name
    main({
        "id": model_id, "name": "Cleanup Qwen3.5 2B 4-bit", "short_name": "Cleanup 2B Q4",
        "runner_version": "cleanup-2b-4bit-mlx-v1", "runtime": "MLX LM 4-bit affine (group size 64; text-only)",
        "training_dataset": "User identifies the same cleanup training dataset used previously; archive has no training manifest, so exact version/benchmark overlap is unverified.",
        "loading": "Strict loading of the official MLX-LM converted text-only 4-bit model. Vision and MTP omitted by native sanitizer; original download preserved.",
        "extra_provenance": {"conversion": conversion,
            "parameter_count_note": "Stored packed-tensor elements are not parameter count; see conversion.source_parameters.text."},
    })
