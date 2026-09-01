#!/usr/bin/env python3
"""Convert the supplied Qwen3.5-2B using the official MLX-LM converter."""

import argparse
import importlib.metadata
import json
import math
import os
import struct
import time
from collections import Counter

from run_old_cleanup import ROOT, now, sha256

MODEL_ID = "cleanup-2b-4bit"
SOURCES = [
    "https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/convert.py",
    "https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/models/qwen3_5.py",
]


def tensor_info(directory):
    tensors = {}
    for path in directory.glob("*.safetensors"):
        with path.open("rb") as handle:
            header = json.loads(handle.read(struct.unpack("<Q", handle.read(8))[0]))
        tensors.update({key: value for key, value in header.items() if key != "__metadata__"})
    return tensors


def main():
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    args = parser.parse_args()
    source = ROOT / "models" / "cleanup-2b-source"
    destination = ROOT / "models" / MODEL_ID
    if destination.exists():
        raise FileExistsError(destination)
    hashes = {p.name: sha256(p) for p in source.iterdir() if p.is_file()}
    original = tensor_info(source)
    source_bytes, source_parameters = Counter(), Counter()
    for key, value in original.items():
        group = "vision" if key.startswith("model.visual.") else "mtp" if key.startswith("mtp.") else "text"
        source_bytes[group] += value["data_offsets"][1] - value["data_offsets"][0]
        source_parameters[group] += math.prod(value["shape"])
    started_at, started = now(), time.perf_counter()
    from mlx_lm.convert import convert
    # Native Qwen3.5 sanitization removes vision/MTP and adapts tensor layout.
    # The converter preserves sensitive A_log tensors through cast_predicate.
    convert(str(source), str(destination), quantize=True, q_bits=4,
            q_group_size=64, q_mode="affine", trust_remote_code=False)
    converted = tensor_info(destination)
    assert converted and not any("visual" in key or "vision" in key or "mtp." in key for key in converted)
    import mlx.core as mx
    from mlx_lm.utils import load_model, load_tokenizer
    model, config = load_model(destination, strict=True)
    mx.eval(model.parameters())
    modules = {name: {"bits": m.bits, "group_size": m.group_size, "mode": m.mode}
               for name, m in model.named_modules() if hasattr(m, "bits") and hasattr(m, "scales")}
    assert modules and all(v == {"bits": 4, "group_size": 64, "mode": "affine"} for v in modules.values())
    tokenizers = [load_tokenizer(p, tokenizer_config_extra={"trust_remote_code": False, "local_files_only": True})
                  for p in (source, destination)]
    assert tokenizers[0].eos_token_ids == tokenizers[1].eos_token_ids
    corpus = [json.loads(line) for line in (ROOT / "artifacts/benchmark-corpus.jsonl").read_text().splitlines()]
    for case in corpus:
        messages = [{"role": "system", "content": case["system"]}, {"role": "user", "content": case["input"]}]
        prompts = [t.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, enable_thinking=False) for t in tokenizers]
        assert prompts[0] == prompts[1], case["id"]
    assert all(sha256(source / name) == digest for name, digest in hashes.items())
    weight_bytes = sum(p.stat().st_size for p in destination.glob("*.safetensors"))
    storage = sum(t["data_offsets"][1] - t["data_offsets"][0] for t in converted.values())
    manifest = {
        "id": MODEL_ID, "source_archive": args.archive.name, "source_archive_sha256": sha256(args.archive),
        "source_files_sha256": hashes,
        "output_files_sha256": {p.name: sha256(p) for p in destination.iterdir() if p.is_file()},
        "versions": {p: importlib.metadata.version(p) for p in ("mlx", "mlx-lm", "transformers")},
        "official_sources": SOURCES, "method": "mlx_lm.convert.convert; native Qwen3.5 text-only sanitizer",
        "started_at": started_at, "completed_at": now(), "conversion_seconds": time.perf_counter() - started,
        "quantization": {"bits": 4, "group_size": 64, "mode": "affine", "calibration": False,
                         "activation_quantization": False, "kv_cache_quantization": False},
        "quantized_module_count": len(modules), "source_tensor_bytes": dict(source_bytes),
        "source_parameters": dict(source_parameters), "quantized_text_tensor_bytes": storage,
        "quantized_weight_file_bytes": weight_bytes,
        "effective_bits_per_text_parameter": storage * 8 / source_parameters["text"],
        "validation": "Strict reload; all quantized modules are affine 4-bit/group64; no vision/MTP tensors; identical prompt token IDs on 100 cases and identical EOS IDs; source hashes unchanged.",
        "scope": "Text-only MLX weights. Floating norms, scales/biases and sensitive tensors are not all 4-bit. Original multimodal config/tokenizer metadata is retained by the official converter but no vision parameters are saved.",
    }
    encoded = json.dumps(manifest, indent=2) + "\n"
    (destination / "conversion.json").write_text(encoded)
    (ROOT / "artifacts" / f"{MODEL_ID}-conversion.json").write_text(encoded)
    print(json.dumps({k: v for k, v in manifest.items() if "sha256" not in k}, indent=2), flush=True)


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    main()
