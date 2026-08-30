#!/usr/bin/env python3
"""Run S1-mini exactly as documented in its model card."""

import json
import os
import resource
import time
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "s1-mini"
SAMPLE_PATH = ROOT / "artifacts" / "sample.jsonl"
OUT_PATH = ROOT / "artifacts" / "results-s1-mini.json"
SYSTEM = (
    "You are a text normalizer for speech-to-text transcripts. The input begins "
    "with a control line specifying the styling, structure, and context settings; "
    "clean the transcript to match those settings and output only the cleaned text."
)


def main() -> None:
    sample = [json.loads(line) for line in SAMPLE_PATH.read_text().splitlines() if line.strip()]
    load_started = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, torch_dtype="auto", local_files_only=True).to("mps")
    load_seconds = time.perf_counter() - load_started
    results = []
    for case in sample:
        control = f"[Styling: semi-formal] [Structure: prose] [Context: {case['s1_context']}]"
        messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"{control}\n{case['input']}"}]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        encoded = tokenizer(prompt, return_tensors="pt")
        input_ids = encoded.input_ids.to("mps")
        attention_mask = encoded.attention_mask.to("mps")
        max_new_tokens = int(len(tokenizer.encode(case["input"])) * 1.3) + 32
        torch.mps.synchronize()
        started = time.perf_counter()
        with torch.inference_mode():
            generated = model.generate(input_ids=input_ids, attention_mask=attention_mask, max_new_tokens=max_new_tokens, do_sample=False)
        torch.mps.synchronize()
        elapsed = time.perf_counter() - started
        output_ids = generated[0][input_ids.shape[1]:]
        output = tokenizer.decode(output_ids, skip_special_tokens=True).strip()
        output_tokens = int(output_ids.shape[0])
        results.append({
            "id": case["id"],
            "output": output,
            "control": control,
            "performance": {
                "input_tokens": int(input_ids.shape[1]),
                "output_tokens": output_tokens,
                "generation_seconds": elapsed,
                "tokens_per_second": output_tokens / elapsed if elapsed else None,
            },
        })
        print(case["id"], f"{output_tokens / elapsed:.2f} tok/s", flush=True)
    peak_gib = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 ** 3)
    payload = {
        "id": "s1-mini",
        "name": "S1-mini by Superwhisper",
        "family": "Qwen3 0.6B task fine-tune",
        "runtime": "Transformers BF16 on MPS",
        "prompt_mode": "Exact README prompt; semi-formal / prose; email context when reference layout is email-shaped; thinking disabled",
        "source_url": "https://huggingface.co/superwhisper/s1-mini",
        "generation": {"decoding": "greedy", "load_seconds": load_seconds, "peak_memory_gib": peak_gib, "memory_scope": "process peak RSS"},
        "cases": results,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    os.environ.setdefault("HF_HOME", str(ROOT / "models" / "hf-cache"))
    main()
