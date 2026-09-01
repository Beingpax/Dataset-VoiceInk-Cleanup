#!/usr/bin/env python3
"""Evaluate the supplied older cleanup checkpoint exactly once per fixed case."""

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import resource
import struct
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_ID = "old-cleanup-0.8b"
CORPUS = ROOT / "artifacts" / "benchmark-corpus.jsonl"


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, payload):
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def main(spec=None):
    spec = spec or {
        "id": MODEL_ID, "name": "Old Cleanup 0.8B (Aug 1 checkpoint)",
        "short_name": "Old Cleanup 0.8B", "runner_version": "old-cleanup-mlx-v1",
        "training_dataset": "Not recorded in the supplied archive; old-dataset association supplied by user, unverified.",
    }
    model_id = spec["id"]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--model-path", type=Path, default=ROOT / "models" / model_id)
    args = parser.parse_args()
    output_path = ROOT / "artifacts" / f"results-{model_id}.json"
    if output_path.exists():
        raise FileExistsError(f"Preserving existing run: {output_path}. No automatic retries or overwrites.")
    sample = [json.loads(line) for line in CORPUS.read_text().splitlines() if line.strip()]
    if len(sample) != 100 or len({case["id"] for case in sample}) != 100:
        raise ValueError("Expected exactly 100 distinct fixed benchmark cases.")
    files = {p.name: sha256(p) for p in sorted(args.model_path.iterdir()) if p.is_file()}
    parameters, dtypes = Counter(), Counter()
    for path in args.model_path.glob("*.safetensors"):
        with path.open("rb") as handle:
            size = struct.unpack("<Q", handle.read(8))[0]
            header = json.loads(handle.read(size))
        for key, tensor in header.items():
            if key == "__metadata__":
                continue
            parameters[".".join(key.split(".")[:2])] += math.prod(tensor["shape"])
            dtypes[tensor["dtype"]] += 1

    import mlx.core as mx
    from mlx_lm import stream_generate
    from mlx_lm.sample_utils import make_sampler
    from mlx_lm.utils import load_model, load_tokenizer

    print(f"Loading {model_id} at its stored precision", flush=True)
    started = time.perf_counter()
    model, config = load_model(args.model_path, strict=True)
    tokenizer = load_tokenizer(args.model_path, tokenizer_config_extra={
        "trust_remote_code": False, "local_files_only": True,
    })
    mx.synchronize()
    load_seconds = time.perf_counter() - started
    payload = {
        "id": model_id, "name": spec["name"],
        "short_name": spec["short_name"], "family": "Qwen3.5 local cleanup checkpoint",
        "runtime": spec.get("runtime", "MLX LM BF16 (original mixed BF16/FP32 weights)"),
        "source_url": None,
        "prompt_mode": "Dataset cleanup system prompt and raw input only; bundled chat template; thinking disabled; greedy decoding",
        "prompt_policy": "dataset-system-input-only-v1", "runner_version": spec["runner_version"],
        "sample_sha256": sha256(CORPUS), "started_at": now(), "status": "running",
        "platform": platform.platform(),
        "versions": {p: importlib.metadata.version(p) for p in (
            "mlx", "mlx-lm", "transformers", "huggingface-hub", "safetensors",
        )},
        "provenance": {
            "archive_name": args.archive.name, "archive_sha256": sha256(args.archive),
            "model_file_sha256": files, "config": config,
            "parameters_by_prefix": dict(parameters), "tensor_dtypes": dict(dtypes),
            "training_dataset": spec["training_dataset"],
            "loading": spec.get("loading", "Strict MLX LM Qwen3.5 text loading; built-in sanitizer excludes vision and MTP tensors, transposes convolution weights and adapts normalization offsets. No quantization or on-disk weight modification."),
            **spec.get("extra_provenance", {}),
        },
        "generation": {
            "decoding": "greedy", "temperature": 0, "thinking": False, "seed": 0,
            "attempts_per_case": 1, "warmup": False, "cross_case_prompt_cache": False,
            "speculative_decoding": False, "load_seconds": load_seconds,
            "eos_token_ids": sorted(tokenizer.eos_token_ids),
            "token_budget": "max(96, floor(input_token_count * 1.5) + 48)",
            "memory_scope": "process peak RSS",
            "latency_scope": "Prompt processing and generation; excludes load, tokenization and checkpoint writes; includes first-case cold start.",
        },
        "cases": [],
    }
    mx.random.seed(0)
    sampler = make_sampler(temp=0.0)
    save(output_path, payload)
    for index, case in enumerate(sample, 1):
        messages = [{"role": "system", "content": case["system"]},
                    {"role": "user", "content": case["input"]}]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False,
                                               add_generation_prompt=True, enable_thinking=False)
        prompt_tokens = tokenizer.encode(prompt, add_special_tokens=False)
        raw_input_tokens = tokenizer.encode(case["input"], add_special_tokens=False)
        max_tokens = max(96, int(len(raw_input_tokens) * 1.5) + 48)
        result = {**case, "messages": messages, "prompt": prompt, "prompt_token_ids": prompt_tokens,
                  "max_tokens": max_tokens, "attempt": 1, "started_at": now()}
        payload["active_case"] = case["id"]
        save(output_path, payload)
        chunks, generated_ids, last = [], [], None
        mx.synchronize()
        started = time.perf_counter()
        try:
            for response in stream_generate(model, tokenizer, prompt=prompt_tokens,
                                            max_tokens=max_tokens, sampler=sampler):
                chunks.append(response.text)
                generated_ids.append(int(response.token))
                last = response
            mx.synchronize()
            result["finish_reason"] = last.finish_reason if last else None
            if result["finish_reason"] != "stop":
                result["error"] = "Generation did not stop at EOS within the token budget."
        except Exception as error:
            result["error"] = f"{type(error).__name__}: {error}"
        elapsed = time.perf_counter() - started
        result["output"] = "".join(chunks)
        result["generated_token_ids"] = generated_ids
        result["completed_at"] = now()
        output_tokens = len(tokenizer.encode(result["output"], add_special_tokens=False))
        result["performance"] = {
            "input_tokens": len(prompt_tokens), "output_tokens": output_tokens,
            "generation_seconds": elapsed, "tokens_per_second": output_tokens / elapsed,
        }
        payload["cases"].append(result)
        payload["active_case"] = None
        payload["generation"]["peak_memory_gib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024**3
        save(output_path, payload)
        status = result.get("error", f"{output_tokens} tokens; {elapsed:.2f}s; {output_tokens / elapsed:.1f} tok/s")
        print(f"{index:03d}/100 {case['id']}: {status}", flush=True)
        mx.clear_cache()
        if result.get("error") and result.get("finish_reason") != "length":
            raise RuntimeError(result["error"])
    payload["status"] = "completed"
    payload["completed_at"] = now()
    save(output_path, payload)
    print(f"Completed all 100 attempts; {sum(bool(c.get('error')) for c in payload['cases'])} failures", flush=True)


if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
