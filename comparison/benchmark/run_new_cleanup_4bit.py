#!/usr/bin/env python3
"""Evaluate the 4-bit copy using the unchanged 100-case cleanup protocol."""

import json
import os

from run_old_cleanup import ROOT, main, sha256


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    model_path = ROOT / "models" / "new-cleanup-0.8b-4bit"
    conversion = json.loads((model_path / "conversion.json").read_text())
    for name, digest in conversion["output_files_sha256"].items():
        if sha256(model_path / name) != digest:
            raise ValueError(f"Converted file fingerprint mismatch: {name}")
    main({
        "id": "new-cleanup-0.8b-4bit", "name": "New Cleanup 0.8B 4-bit",
        "short_name": "New Cleanup Q4", "runner_version": "new-cleanup-4bit-mlx-v1",
        "runtime": "MLX LM 4-bit affine (group size 64)",
        "training_dataset": "Quantized from the evaluated Aug 31 checkpoint. User identifies its training data as the new cleanup dataset; exact dataset/version and overlap remain unverified.",
        "loading": "Strict loading of the locally converted MLX 4-bit text checkpoint. Conversion performed once from original weights; no quantization during inference. See conversion provenance for tensor handling.",
        "extra_provenance": {
            "conversion": conversion,
            "parameter_count_note": "parameters_by_prefix counts stored tensor elements, including packed weights and quantization metadata; it is not the model parameter count. See conversion.text_parameter_count.",
        },
    })
