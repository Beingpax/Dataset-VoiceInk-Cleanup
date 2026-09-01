#!/usr/bin/env python3
"""Create a separate MLX affine 4-bit text checkpoint from New Cleanup 0.8B."""

import argparse
import importlib.metadata
import json
import os
import shutil
import time
from pathlib import Path

from run_old_cleanup import ROOT, now, sha256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "models" / "new-cleanup-0.8b")
    parser.add_argument("--destination", type=Path, default=ROOT / "models" / "new-cleanup-0.8b-4bit")
    args = parser.parse_args()
    if args.destination.exists():
        raise FileExistsError(f"Preserving existing destination: {args.destination}")
    source_files = {p.name: sha256(p) for p in sorted(args.source.iterdir()) if p.is_file()}
    baseline = json.loads((ROOT / "artifacts" / "results-new-cleanup-0.8b.json").read_text())
    if source_files != baseline["provenance"]["model_file_sha256"]:
        raise ValueError("Source files differ from the evaluated full-precision checkpoint.")

    import mlx.core as mx
    from mlx.utils import tree_flatten
    from mlx_lm.utils import load_model, load_tokenizer, quantize_model, save_config, save_model

    started_at, started = now(), time.perf_counter()
    model, config = load_model(args.source, strict=True)
    mx.synchronize()
    original = dict(tree_flatten(model.parameters()))
    text_bytes = sum(t.nbytes for t in original.values())
    text_parameters = sum(t.size for t in original.values())
    # Use the installed quantizer directly, avoiding a global dtype cast by the
    # CLI converter. Non-quantized FP32/BF16 tensors retain their loaded values.
    model, config = quantize_model(model, config, group_size=64, bits=4, mode="affine")
    mx.eval(model.parameters())
    modules = {name: {"bits": m.bits, "group_size": m.group_size, "mode": m.mode}
               for name, m in model.named_modules() if hasattr(m, "bits") and hasattr(m, "scales")}
    if not modules or any(value != {"bits": 4, "group_size": 64, "mode": "affine"} for value in modules.values()):
        raise ValueError("Expected uniformly 4-bit affine quantization on all quantized modules.")
    quantized = dict(tree_flatten(model.parameters()))
    unchanged_names = [key for key in original if key in quantized and original[key].shape == quantized[key].shape]
    for key in unchanged_names:
        if original[key].dtype != quantized[key].dtype or not mx.array_equal(original[key], quantized[key]).item():
            raise ValueError(f"An unquantized tensor changed: {key}")
    quantized_bytes = sum(t.nbytes for t in quantized.values())
    save_model(args.destination, model)
    save_config(config, args.destination / "config.json")
    for name in ("tokenizer.json", "tokenizer_config.json", "chat_template.jinja", "merges.txt", "vocab.json"):
        shutil.copyfile(args.source / name, args.destination / name)

    # Reload the actual saved artifact strictly; no generated benchmark output
    # is used to validate or choose the quantization settings.
    reloaded, _ = load_model(args.destination, strict=True)
    mx.eval(reloaded.parameters())
    actual = dict(tree_flatten(reloaded.parameters()))
    if actual.keys() != quantized.keys():
        raise ValueError("Reloaded tensor roster differs.")
    for key in actual:
        if actual[key].dtype != quantized[key].dtype or not mx.array_equal(actual[key], quantized[key]).item():
            raise ValueError(f"Saved/reloaded tensor differs: {key}")
    tokenizer = load_tokenizer(args.destination, tokenizer_config_extra={"trust_remote_code": False, "local_files_only": True})
    if sorted(tokenizer.eos_token_ids) != baseline["generation"]["eos_token_ids"]:
        raise ValueError("Tokenizer EOS changed.")
    for name, digest in source_files.items():
        if sha256(args.source / name) != digest:
            raise ValueError(f"Source modified: {name}")
    output_files = {p.name: sha256(p) for p in sorted(args.destination.iterdir()) if p.is_file()}
    weight_bytes = sum(p.stat().st_size for p in args.destination.glob("*.safetensors"))
    manifest = {
        "id": "new-cleanup-0.8b-4bit", "source_model_id": baseline["id"],
        "source_archive": baseline["provenance"]["archive_name"],
        "source_archive_sha256": baseline["provenance"]["archive_sha256"],
        "source_files_sha256": source_files, "output_files_sha256": output_files,
        "started_at": started_at, "completed_at": now(), "conversion_seconds": time.perf_counter() - started,
        "versions": {p: importlib.metadata.version(p) for p in ("mlx", "mlx-lm", "transformers")},
        "quantization": {"bits": 4, "group_size": 64, "mode": "affine", "calibration": False,
                         "activation_quantization": False, "kv_cache_quantization": False},
        "quantized_module_count": len(modules), "quantized_modules": modules,
        "unchanged_tensor_count": len(unchanged_names),
        "text_parameter_count": text_parameters, "source_text_tensor_bytes": text_bytes,
        "quantized_text_tensor_bytes": quantized_bytes, "quantized_weight_file_bytes": weight_bytes,
        "effective_bits_per_text_parameter": quantized_bytes * 8 / text_parameters,
        "source_all_weight_file_bytes": sum(p.stat().st_size for p in args.source.glob("*.safetensors")),
        "validation": "Strict reload; exact equality of every saved/reloaded tensor; unchanged nonquantized tensors; tokenizer bytes and EOS preserved; source hashes unchanged. No inference or calibration during conversion.",
        "scope": "Text-only MLX checkpoint. Eligible linear/embedding weights use 4-bit affine groups of 64; scales, biases, norms and other nonquantized tensors retain floating precision. Vision/MTP tensors are omitted, as in the baseline text inference.",
    }
    encoded = json.dumps(manifest, indent=2) + "\n"
    (args.destination / "conversion.json").write_text(encoded)
    (ROOT / "artifacts" / "new-cleanup-0.8b-4bit-conversion.json").write_text(encoded)
    print(json.dumps({k: v for k, v in manifest.items() if k not in (
        "source_files_sha256", "output_files_sha256", "quantized_modules")}, indent=2))


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    main()
