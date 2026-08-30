#!/usr/bin/env python3
"""Run VoiceInk Refine V1 through MLX with deterministic decoding."""

import json
import os
import resource
import time
from pathlib import Path

from mlx_lm import generate, load

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "voiceink-refine-v1"
SAMPLE_PATH = ROOT / "artifacts" / "sample.jsonl"
OUT_PATH = ROOT / "artifacts" / "results-voiceink.json"


def main() -> None:
    sample = [json.loads(line) for line in SAMPLE_PATH.read_text().splitlines() if line.strip()]
    load_started = time.perf_counter()
    model, tokenizer = load(str(MODEL_PATH))
    load_seconds = time.perf_counter() - load_started
    results = []
    for case in sample:
        messages = [
            {"role": "system", "content": case["system"]},
            {"role": "user", "content": case["input"]},
        ]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        input_tokens = len(tokenizer.encode(prompt))
        max_tokens = max(96, int(len(tokenizer.encode(case["input"])) * 1.5) + 48)
        started = time.perf_counter()
        output = generate(model, tokenizer, prompt=prompt, max_tokens=max_tokens, verbose=False).strip()
        elapsed = time.perf_counter() - started
        output_tokens = len(tokenizer.encode(output))
        results.append({
            "id": case["id"],
            "output": output,
            "performance": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "generation_seconds": elapsed,
                "tokens_per_second": output_tokens / elapsed if elapsed else None,
            },
        })
        print(case["id"], f"{output_tokens / elapsed:.2f} tok/s", flush=True)
    peak_gib = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 ** 3)
    payload = {
        "id": "voiceink-refine-v1",
        "name": "VoiceInk Refine V1",
        "family": "Qwen3.5 task fine-tune",
        "runtime": "MLX LM 4-bit",
        "prompt_mode": "Dataset default cleanup system prompt",
        "source_url": "https://huggingface.co/beingpax/VoiceInk-Refine-V1",
        "generation": {"decoding": "greedy", "load_seconds": load_seconds, "peak_memory_gib": peak_gib, "memory_scope": "process peak RSS"},
        "cases": results,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    os.environ.setdefault("HF_HOME", str(ROOT / "models" / "hf-cache"))
    main()
