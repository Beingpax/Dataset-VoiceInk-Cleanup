#!/usr/bin/env python3
"""Local Granite 4.2-3B non-thinking speed experiment; no quality ranking."""

import argparse
import gc
import hashlib
import importlib.metadata
import json
import platform
import re
import resource
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import mlx.core as mx
import psutil
from mlx_lm import load, stream_generate
from mlx_lm.sample_utils import make_sampler

ROOT = Path(__file__).resolve().parents[1]


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def make_cases(sample_path):
    rows = [json.loads(line) for line in sample_path.read_text().splitlines() if line]
    ordered = sorted(rows, key=lambda row: (len(row["input"].split()), row["id"]))
    groups = [("short", [ordered[len(ordered) // 2]]),
              ("medium", ordered[-5:]), ("long", ordered[-15:])]
    return [{"id": name, "source_ids": [row["id"] for row in group],
             "system": rows[0]["system"],
             "input": "\n\n".join(row["input"] for row in group),
             "construction": "original case" if len(group) == 1 else
             "independent corpus inputs joined by blank lines for a length stress test"}
            for name, group in groups]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, default=ROOT / "models/granite-4.2-3b-4bit")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/granite-4.2-3b-speed.json")
    parser.add_argument("--repetitions", type=int, default=3)
    args = parser.parse_args()
    if args.repetitions < 1:
        parser.error("repetitions must be positive")
    config = json.loads((args.model / "config.json").read_text())
    assert config["model_type"] == "granite", config["model_type"]
    assert config["quantization"]["bits"] == 4, config["quantization"]
    provenance = json.loads((args.model / "download-provenance.json").read_text())
    cases = make_cases(ROOT / "artifacts/sample.jsonl")
    package_names = ["mlx", "mlx-metal", "mlx-lm", "transformers", "huggingface-hub"]
    payload = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "model": provenance, "model_config": config,
        "weight_bytes": sum(p.stat().st_size for p in args.model.glob("*.safetensors")),
        "hardware": {"chip": command("sysctl", "-n", "machdep.cpu.brand_string"),
                     "physical_memory_bytes": int(command("sysctl", "-n", "hw.memsize")),
                     "macos": platform.mac_ver()[0], "architecture": platform.machine(),
                     "power": command("pmset", "-g", "batt"),
                     "mlx_device": str(mx.default_device()),
                     "metal": mx.metal.device_info()},
        "versions": {p: importlib.metadata.version(p) for p in package_names},
        "settings": {"thinking": False, "temperature": 1.0, "top_p": 0.95,
                     "seed_per_request": 20260831, "batch_size": 1,
                     "repetitions": args.repetitions, "warmup_requests": 2,
                     "prompt_cache_reuse": False, "kv_quantization": None},
        "measurement_notes": [
            "Prebuilt Python MLX runtime; this does not benchmark the Swift integration.",
            "IBM recommended temperature=1.0 and top_p=0.95; RNG reset per request.",
            "The actual chat template must end in a closed, empty thinking block.",
            "Generation timing excludes model load, template rendering and tokenization.",
            "MLX generation_tps excludes prompt processing and follows mlx-lm's token counting.",
            "End-to-end throughput uses generated tokens excluding the final EOS divided by wall time.",
            "TTFT is the first streamed token event; first visible text is recorded separately.",
            "Each request starts with a fresh KV cache. Warmups are not included in summaries.",
            "MLX peak measures active allocator bytes; process peak RSS is cumulative and separate.",
            "This is a speed experiment, not IFEval/IFBench or a transcript-quality evaluation.",
            "Medium and long inputs concatenate independent corpus cases for length stress testing.",
        ],
        "cases": cases, "warmups": [], "runs": [], "status": "running",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)

    def save():
        temp = args.output.with_suffix(".json.tmp")
        temp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        temp.replace(args.output)

    started = time.perf_counter()
    model, tokenizer = load(str(args.model), tokenizer_config={"trust_remote_code": False})
    mx.eval(model.parameters())
    mx.synchronize()
    payload["load_seconds"] = time.perf_counter() - started
    payload["mlx_active_after_load_bytes"] = mx.get_active_memory()
    save()
    print(json.dumps({"event": "loaded", "seconds": payload["load_seconds"],
                      "active_gb": mx.get_active_memory() / 1e9}), flush=True)

    def run(case, repetition, warmup=False):
        prompt = tokenizer.apply_chat_template(
            [{"role": "system", "content": case["system"]},
             {"role": "user", "content": case["input"]}],
            tokenize=False, add_generation_prompt=True, enable_thinking=False)
        if not re.search(r"<think>\s*</think>\s*$", prompt):
            raise RuntimeError("The rendered prompt does not disable thinking")
        tokens = tokenizer.encode(prompt, add_special_tokens=False)
        max_tokens = max(128, int(len(tokenizer.encode(case["input"])) * 1.8) + 128)
        gc.collect()
        mx.clear_cache()
        mx.synchronize()
        mx.reset_peak_memory()
        mx.random.seed(20260831)
        rss_before = psutil.Process().memory_info().rss
        started = time.perf_counter()
        first_token_seconds = None
        first_text_seconds = None
        pieces = []
        for response in stream_generate(model, tokenizer, prompt=tokens,
                                        max_tokens=max_tokens,
                                        sampler=make_sampler(temp=1.0, top_p=0.95)):
            now = time.perf_counter()
            if first_token_seconds is None:
                first_token_seconds = now - started
            if response.text and first_text_seconds is None:
                first_text_seconds = now - started
            pieces.append(response.text)
        mx.synchronize()
        elapsed = time.perf_counter() - started
        output = "".join(pieces)
        output_tokens = response.generation_tokens - int(response.finish_reason == "stop")
        record = {
            "case_id": case["id"], "repetition": repetition, "warmup": warmup,
            "input_words": len(case["input"].split()), "prompt_tokens": len(tokens),
            "rendered_prompt_suffix": prompt[-100:],
            "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
            "max_tokens": max_tokens, "output": output, "output_tokens": output_tokens,
            "mlx_generation_tokens": response.generation_tokens,
            "finish_reason": response.finish_reason,
            "thinking_markers_in_output": "<think>" in output or "</think>" in output,
            "generation_seconds": elapsed, "ttft_seconds": first_token_seconds,
            "first_visible_text_seconds": first_text_seconds,
            "decode_tokens_per_second": response.generation_tps,
            "prefill_tokens_per_second": response.prompt_tps,
            "end_to_end_tokens_per_second": output_tokens / elapsed,
            "mlx_peak_bytes": mx.get_peak_memory(),
            "mlx_cache_bytes_after_request": mx.get_cache_memory(),
            "process_rss_before_bytes": rss_before,
            "process_rss_after_bytes": psutil.Process().memory_info().rss,
            "process_peak_rss_so_far_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        }
        payload["warmups" if warmup else "runs"].append(record)
        save()
        print(json.dumps({"event": "warmup" if warmup else "measured",
                          **{k: record[k] for k in ["case_id", "repetition", "prompt_tokens",
                            "output_tokens", "generation_seconds", "ttft_seconds",
                            "decode_tokens_per_second", "mlx_peak_bytes", "finish_reason",
                            "thinking_markers_in_output"]}}), flush=True)

    for repetition in range(2):
        run(cases[0], repetition + 1, warmup=True)
    for repetition in range(args.repetitions):
        for case in cases:
            run(case, repetition + 1)

    summaries = []
    for case in cases:
        rows = [r for r in payload["runs"] if r["case_id"] == case["id"]]
        summary = {"case_id": case["id"], "runs": len(rows),
                   "input_words": rows[0]["input_words"], "prompt_tokens": rows[0]["prompt_tokens"],
                   "output_tokens_median": statistics.median(r["output_tokens"] for r in rows),
                   "mlx_peak_bytes_max": max(r["mlx_peak_bytes"] for r in rows),
                   "all_completed": all(r["finish_reason"] == "stop" for r in rows),
                   "all_without_thinking_markers": all(not r["thinking_markers_in_output"] for r in rows)}
        for key in ["generation_seconds", "ttft_seconds", "first_visible_text_seconds",
                    "decode_tokens_per_second", "prefill_tokens_per_second",
                    "end_to_end_tokens_per_second"]:
            values = [r[key] for r in rows if r[key] is not None]
            summary[key] = {"median": statistics.median(values), "min": min(values), "max": max(values)}
        summaries.append(summary)
    payload["summary"] = summaries
    payload["process_peak_rss_bytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    payload["status"] = "complete"
    payload["completed_at"] = datetime.now(timezone.utc).isoformat()
    save()
    print(json.dumps({"event": "complete", "summary": summaries,
                      "process_peak_rss_gib": payload["process_peak_rss_bytes"] / 1024**3}, indent=2), flush=True)


if __name__ == "__main__":
    main()
