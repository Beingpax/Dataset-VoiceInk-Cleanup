#!/usr/bin/env python3
"""Evaluate the new-dataset checkpoint using the identical older-model protocol."""

import os

from run_old_cleanup import main


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main({
        "id": "new-cleanup-0.8b",
        "name": "New Cleanup 0.8B (Aug 31 checkpoint)",
        "short_name": "New Cleanup 0.8B",
        "runner_version": "new-cleanup-mlx-v1",
        "training_dataset": "User identifies this as the same model fine-tuned on a new dataset. Exact dataset/version and training overlap are not recorded in the supplied archive.",
    })
