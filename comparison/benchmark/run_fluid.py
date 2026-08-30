#!/usr/bin/env python3
"""Run the authorized Fluid-1 Mini 2B 6-bit checkpoint over the 100-case corpus."""

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import resource
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = ROOT / "artifacts" / "benchmark-corpus.jsonl"
PROMPT_POLICY = "dataset-system-input-only-v1"
RUNNER_VERSION = "fluid-mlx-v1"
MODEL = {
    "id": "fluid-1-mini-2b-6bit",
    "name": "Fluid-1 Mini 2B 6-bit",
    "short_name": "Fluid Mini Q6",
    "repo_id": "altic-dev/Fluid-1-Mini-2B-MLX-6bit",
    "revision": "a2ab739606c1648dae526db12ec4b5f7bbf0bc9c",
    "base_model": "Qwen/Qwen3.5-2B",
    "quantization_label": "6-bit",
}


def save(path: Path, payload: dict) -> None:
    """Checkpoint atomically so interrupted runs retain completed cases."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def prepare_model(spec: dict, offline: bool) -> Path:
    from huggingface_hub import snapshot_download

    path = ROOT / "models" / spec["id"]
    if offline:
        return path
    snapshot_download(
        spec["repo_id"],
        revision=spec["revision"],
        local_dir=path,
        allow_patterns=["*.json", "*.jinja", "model*.safetensors", "*.md", "LICENSE*"],
        max_workers=3,
    )
    return path


def run_model(spec: dict, args: argparse.Namespace) -> None:
    model_path = prepare_model(spec, args.offline)
    if args.download_only:
        print(f"Downloaded {spec['id']}", flush=True)
        return

    import mlx.core as mx
    from mlx_lm import stream_generate
    from mlx_lm.models.qwen3_5 import Model, ModelArgs
    from mlx_lm.sample_utils import make_sampler
    from mlx_lm.utils import load_model, load_tokenizer

    class FluidTargetModel(Model):
        def sanitize(self, weights):
            # These are speculative draft tensors, not target-model parameters.
            # Keep strict target loading; never silently allow missing weights.
            self.excluded_draft_tensors = sum(key.startswith("language_model.dflash.") for key in weights)
            target_weights = {key: value for key, value in weights.items() if not key.startswith("language_model.dflash.")}
            return super().sanitize(target_weights)

    sample_bytes = SAMPLE_PATH.read_bytes()
    sample = [json.loads(line) for line in sample_bytes.decode().splitlines() if line.strip()]
    sample_sha256 = hashlib.sha256(sample_bytes).hexdigest()
    if len(sample) != 100 or len({case["id"] for case in sample}) != 100:
        raise ValueError("This run requires the existing 100 distinct benchmark cases.")
    output_path = ROOT / "artifacts" / f"results-{spec['id']}.json"
    payload = None
    if output_path.exists():
        payload = json.loads(output_path.read_text())
        expected = {"source_revision": spec["revision"], "sample_sha256": sample_sha256,
                    "runner_version": RUNNER_VERSION, "prompt_policy": PROMPT_POLICY}
        if any(payload.get(key) != value for key, value in expected.items()):
            raise ValueError(f"{output_path.name} belongs to a different run; move it aside before rerunning.")
        if payload.get("status") == "completed" and not args.retry_errors:
            print(f"Already completed {spec['id']}; preserving saved results.", flush=True)
            return

    print(f"Loading {spec['id']} for {len(sample)} cases", flush=True)
    load_started = time.perf_counter()
    model, config = load_model(model_path, strict=True, get_model_classes=lambda config: (FluidTargetModel, ModelArgs))
    tokenizer = load_tokenizer(model_path, tokenizer_config_extra={"trust_remote_code": False, "local_files_only": True},
                               eos_token_ids=config.get("eos_token_id"))
    mx.synchronize()
    load_seconds = time.perf_counter() - load_started
    print(f"Loaded in {load_seconds:.2f}s; DFlash disabled ({model.excluded_draft_tensors} draft tensors excluded)", flush=True)
    if payload is None:
        payload = {
            **{key: value for key, value in spec.items() if key not in ("revision", "quantization_label")},
            "family": f"{spec['base_model']} dictation-cleanup fine-tune",
            "runtime": f"MLX LM {spec['quantization_label']} (no DFlash)",
            "prompt_mode": "Dataset cleanup system prompt and raw input only; thinking disabled; greedy MLX target decoding without FluidDecode/DFlash",
            "prompt_policy": PROMPT_POLICY,
            "source_url": f"https://huggingface.co/{spec['repo_id']}",
            "source_revision": spec["revision"],
            "sample_sha256": sample_sha256,
            "runner_version": RUNNER_VERSION,
            "permission_confirmed_by_user": True,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "platform": platform.platform(),
            "versions": {name: importlib.metadata.version(name) for name in ("mlx", "mlx-lm", "transformers", "huggingface-hub")},
            "generation": {
                "decoding": "greedy", "temperature": 0, "thinking": False,
                "dflash": False, "cross_case_prompt_cache": False, "warmup": False,
                "token_budget": "max(96, floor(input_token_count * 1.5) + 48)",
                "load_seconds": load_seconds, "memory_scope": "process peak RSS",
                "excluded_draft_tensors": model.excluded_draft_tensors,
                "load_sessions": [],
            },
            "cases": [],
        }
    payload["generation"]["load_sessions"].append({"started_at": datetime.now(timezone.utc).isoformat(), "load_seconds": load_seconds})
    payload["status"] = "running"
    save(output_path, payload)
    recorded = {case["id"]: case for case in payload["cases"]}
    sampler = make_sampler(temp=0.0)
    for index, case in enumerate(sample, 1):
        previous = recorded.get(case["id"])
        if previous is not None and not (args.retry_errors and previous.get("error")):
            continue
        messages = [{"role": "system", "content": case["system"]}, {"role": "user", "content": case["input"]}]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        prompt_tokens = tokenizer.encode(prompt, add_special_tokens=False)
        input_tokens = tokenizer.encode(case["input"], add_special_tokens=False)
        max_tokens = max(96, int(len(input_tokens) * 1.5) + 48)
        result = {"id": case["id"], "input": case["input"], "reference": case["reference"],
                  "messages": messages, "prompt": prompt, "max_tokens": max_tokens}
        if previous:
            result["previous_attempts"] = [*previous.get("previous_attempts", []), {key: value for key, value in previous.items() if key != "previous_attempts"}]
        chunks = []
        last_response = None
        mx.synchronize()
        started = time.perf_counter()
        try:
            for response in stream_generate(model, tokenizer, prompt=prompt_tokens, max_tokens=max_tokens, sampler=sampler):
                chunks.append(response.text)
                last_response = response
            mx.synchronize()
            result["finish_reason"] = last_response.finish_reason if last_response else None
            if result["finish_reason"] != "stop":
                result["error"] = "Generation reached the token limit without an end-of-sequence token."
        except Exception as error:
            result["error"] = f"{type(error).__name__}: {error}"
        elapsed = time.perf_counter() - started
        result["output"] = "".join(chunks)
        output_tokens = len(tokenizer.encode(result["output"], add_special_tokens=False))
        result["performance"] = {"input_tokens": len(prompt_tokens), "output_tokens": output_tokens,
                                 "generation_seconds": elapsed, "tokens_per_second": output_tokens / elapsed if elapsed else None}
        recorded[case["id"]] = result
        payload["cases"] = [recorded[source["id"]] for source in sample if source["id"] in recorded]
        peak_gib = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 ** 3)
        payload["generation"]["peak_memory_gib"] = max(peak_gib, payload["generation"].get("peak_memory_gib", 0))
        save(output_path, payload)
        status = result.get("error") or f"{output_tokens} tokens; {elapsed:.2f}s; {output_tokens / elapsed:.1f} tok/s"
        print(f"{spec['id']} {index:03d}/{len(sample)} {case['id']}: {status}", flush=True)
        mx.clear_cache()
        if result.get("error") and result.get("finish_reason") != "length":
            # Stop a broken runtime so the remaining corpus is not wasted.
            raise RuntimeError(result["error"])
    payload["status"] = "completed"
    payload["completed_at"] = datetime.now(timezone.utc).isoformat()
    save(output_path, payload)
    failed = sum(bool(case.get("error")) for case in payload["cases"])
    print(f"Finished {spec['id']}: {len(payload['cases']) - failed}/100 successful; {failed} failed", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=["mini-6bit"], default="mini-6bit")
    parser.add_argument("--permission-confirmed", action="store_true", help="Confirm permission for use outside official FluidVoice apps.")
    parser.add_argument("--offline", action="store_true", help="Use checkpoints already downloaded to comparison/models.")
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--retry-errors", action="store_true", help="Resume failed cases, preserving their earlier attempts.")
    args = parser.parse_args()
    if not args.permission_confirmed:
        parser.error("ALTIC permission is required; supply --permission-confirmed only if authorized.")
    run_model(MODEL, args)


if __name__ == "__main__":
    os.environ.setdefault("HF_HOME", str(ROOT / "models" / "hf-cache"))
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
