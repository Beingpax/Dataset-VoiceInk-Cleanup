#!/usr/bin/env python3
"""Score all completed model outputs and publish site-ready JSON."""

import csv
import hashlib
import json
import math
import platform
import shutil
from pathlib import Path

import jiwer
from rapidfuzz.fuzz import ratio
from sacrebleu.metrics import CHRF

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
SITE_DATA = ROOT / "site" / "data"
PUBLIC_DATA = ROOT.parent / "public" / "data"
PUBLIC_DOWNLOADS = ROOT.parent / "public" / "downloads"
CHRF = CHRF(word_order=2)

METRIC_KEYS = ("exact_match", "edit_similarity", "chrf", "wer", "length_ratio")
REFERENCE_BLIND_MODELS = {"gpt-5.6-sol-low", "voiceink-refine-v1", "speakoflow-mini"}
DATASET_SYSTEM_PROMPT_MODELS = {"fluid-1-mini-2b-6bit", "old-cleanup-0.8b", "new-cleanup-0.8b", "new-cleanup-0.8b-4bit", "cleanup-2b-4bit"}


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def safe_wer(reference: str, output: str) -> float:
    if not reference.strip():
        return 0.0 if not output.strip() else 1.0
    return float(jiwer.wer(reference, output))


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return ordered[lo]
    return ordered[lo] * (hi - pos) + ordered[hi] * (pos - lo)


def score_case(case: dict) -> dict:
    if not isinstance(case.get("output"), str):
        case["error"] = case.get("error") or "No text output was recorded."
    if case.get("error"):
        # Failure is not a measured text score, even if a partial output exists.
        case["metrics"] = {key: False if key == "exact_match" else None for key in METRIC_KEYS}
        return case
    reference = case["reference"].strip()
    output = case["output"].strip()
    case["metrics"] = {
        "exact_match": output == reference,
        "edit_similarity": ratio(reference, output) / 100.0,
        "chrf": CHRF.sentence_score(output, [reference]).score / 100.0,
        "wer": safe_wer(reference, output),
        "length_ratio": len(output) / len(reference) if reference else (1.0 if not output else None),
    }
    return case


def summarize_cases(cases: list[dict]) -> dict:
    measured = [case for case in cases if not case.get("error")]
    per_case_tps = [(case.get("performance") or {}).get("tokens_per_second") for case in measured]
    per_case_tps = [value for value in per_case_tps if isinstance(value, (int, float))]
    latencies = [(case.get("performance") or {}).get("generation_seconds") for case in measured]
    latencies = [value for value in latencies if isinstance(value, (int, float))]
    exact_matches = sum(case["metrics"]["exact_match"] for case in measured)
    return {
        "case_count": len(cases),
        "successful_cases": len(measured),
        "failed_cases": len(cases) - len(measured),
        "success_rate": len(measured) / len(cases) if cases else None,
        "exact_matches": exact_matches,
        "exact_match_rate": exact_matches / len(cases) if cases else None,
        "mean_edit_similarity": sum(case["metrics"]["edit_similarity"] for case in measured) / len(measured) if measured else None,
        "mean_chrf": sum(case["metrics"]["chrf"] for case in measured) / len(measured) if measured else None,
        "mean_wer": sum(case["metrics"]["wer"] for case in measured) / len(measured) if measured else None,
        "median_tokens_per_second": percentile(per_case_tps, 0.5),
        "mean_generation_seconds": sum(latencies) / len(latencies) if latencies else None,
        "median_generation_seconds": percentile(latencies, 0.5),
    }


def comparison_context(model: dict) -> dict:
    if model["id"] in DATASET_SYSTEM_PROMPT_MODELS:
        known = model.get("prompt_policy") == "dataset-system-input-only-v1"
        return {
            "reference_blind": known,
            "context_source": "dataset_system_prompt" if known else "unverified",
            "note": None if known else "Dataset system-prompt provenance must be recorded before ranking.",
        }
    known = model["id"] in REFERENCE_BLIND_MODELS
    return {
        "reference_blind": known,
        "context_source": "native_prompt" if known else "unverified",
        "note": None if known else "Inference context provenance must be recorded before ranking.",
    }


def summarize(model: dict) -> dict:
    cases = [score_case(case) for case in model["cases"]]
    generation = model.get("generation", {})
    model["cases"] = cases
    model["summary"] = {
        **summarize_cases(cases),
        "peak_memory_gib": generation.get("peak_memory_gib"),
        "memory_scope": generation.get("memory_scope", "unavailable"),
    }
    model["dataset_summaries"] = {
        dataset_id: summarize_cases([case for case in cases if case["dataset_id"] == dataset_id])
        for dataset_id in sorted({case["dataset_id"] for case in cases})
    }
    model["comparison"] = comparison_context(model)
    return model


def main() -> None:
    # Freeze the displayed benchmark's case content, not merely its IDs.
    # Sampling/integration may change sample.jsonl without rerunning baselines.
    corpus_path = ARTIFACTS / "benchmark-corpus.jsonl"
    sample = load_jsonl(corpus_path)
    sample_sha256 = hashlib.sha256(corpus_path.read_bytes()).hexdigest()
    by_id = {case["id"]: case for case in sample}
    if len(by_id) != len(sample):
        raise ValueError("Benchmark sample contains duplicate case IDs.")
    result_paths = sorted(ARTIFACTS.glob("results-*.json"))
    models = []
    for path in result_paths:
        model = json.loads(path.read_text())
        if model.get("sample_sha256") and model["sample_sha256"] != sample_sha256:
            raise ValueError(f"Corpus fingerprint mismatch in {path.name}; do not score outputs against changed inputs.")
        recorded = {}
        for case in model.get("cases", []):
            if case["id"] not in by_id or case["id"] in recorded:
                raise ValueError(f"Unexpected or duplicate case ID in {path.name}: {case['id']}")
            recorded[case["id"]] = case
        model["cases"] = []
        for source in sample:
            case = recorded.get(source["id"], {"id": source["id"], "output": "", "error": "No result recorded for this expected case."})
            if any(key in case and case[key] != source[key] for key in ("input", "reference")):
                raise ValueError(f"Recorded source mismatch for {case['id']} in {path.name}; rerun the affected input instead of relabeling its output.")
            case.update({key: source.get(key) for key in (
                "source_index", "input", "reference", "selection_group",
                "input_words", "input_characters", "dataset_id", "dataset_name",
                "source_record_id", "metadata",
            )})
            # Run context belongs to the recorded run, never to a regenerated sample.
            model["cases"].append(case)
        models.append(summarize(model))
    payload = {
        "benchmark": {
            "scoring_version": "fairness-v1",
            "quality_scope": "successful_cases",
            "exact_match_scope": "all_expected_cases",
            "ranking_scope": "complete_reference_blind_configurations",
            "case_manifest": [{"id": case["id"], "dataset_id": case["dataset_id"]} for case in sample],
            "corpus_sha256": sample_sha256,
            "corpus_source": "comparison/artifacts/benchmark-corpus.jsonl",
            "name": "Transcript Cleanup: 100-case model comparison",
            "sample_seed": "20260830 + 20260831",
            "sample_count": len(sample),
            "datasets": [
                {"id": "voiceink-validation", "name": "VoiceInk validation sample", "count": sum(c.get("dataset_id") == "voiceink-validation" for c in sample)},
                {"id": "curated-sample-50", "name": "Curated transcript cleanup sample", "count": sum(c.get("dataset_id") == "curated-sample-50" for c in sample)},
            ],
            "selection": "VoiceInk validation: original 20-case fixed-seed random sample plus 30 fixed-seed random cases drawn from the longest 30% of remaining validation inputs. Curated sample: all 50 supplied input/reference pairs.",
            "validation_population": 1829,
            "hardware": "Apple M2 Pro, 10-core CPU, 16 GB unified memory",
            "platform": platform.platform(),
            "limitations": [
                "The two 50-case datasets have different construction and difficulty; combined scores are descriptive, not population-weighted estimates.",
                "String metrics penalize valid wording or punctuation variants even when meaning is preserved.",
                "Local peak memory is process RSS and is not comparable to provider-side hosted memory.",
                "Model-native prompts and settings differ; rankings compare configurations, not isolated model capability.",
                "Quality means use successful cases only. Exact-match and completion rates include every expected case, including failed or missing results.",
                "Fluid-1 Mini 2B 6-bit uses the existing dataset cleanup instructions and standard MLX target decoding without DFlash; these are not FluidVoice application or FluidDecode speed measurements.",
                "Old Cleanup 0.8B is the user-supplied Aug 1 checkpoint evaluated at original BF16/FP32 precision. Its training dataset and any benchmark overlap are not documented in the archive; original training-prompt compatibility is unverified.",
                "New Cleanup 0.8B is the user-supplied Aug 31 checkpoint, described by the user as trained on a new dataset. It uses the same evaluation protocol as Old Cleanup 0.8B; training-data overlap is unverified and differences cannot be attributed solely to the dataset without training records.",
                "New Cleanup 0.8B 4-bit uses local affine weight quantization with group size 64, without calibration, activation quantization or KV-cache quantization. It uses the same 100-case inference protocol as the original Aug 31 checkpoint; speed and RSS were measured in separate sessions.",
                "Cleanup Qwen3.5 2B 4-bit is the supplied ft-30b873e1 checkpoint converted with official MLX-LM affine 4-bit/group64 text-only conversion. Native sanitization omits vision/MTP tensors. It uses the fixed 100-case protocol without retries; no full-precision 2B benchmark was run, so quantization-only quality impact is unknown. Training overlap is unverified.",
            ],
        },
        "models": models,
    }
    for directory in (ARTIFACTS, SITE_DATA, PUBLIC_DATA, PUBLIC_DOWNLOADS):
        directory.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    for destination in (ARTIFACTS / "benchmark-results.json", SITE_DATA / "benchmark.json", PUBLIC_DATA / "benchmark.json", PUBLIC_DOWNLOADS / "benchmark-results.json"):
        destination.write_text(encoded)
    with (ARTIFACTS / "aggregate-results.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "model_id", "model_name", "runtime", "reference_blind", "context_source", "comparison_note", "rank_eligible",
            "case_count", "successful_cases", "failed_cases", "success_rate", "exact_matches", "exact_match_rate",
            "mean_edit_similarity", "mean_chrf", "mean_wer", "median_tokens_per_second",
            "mean_generation_seconds", "median_generation_seconds", "peak_memory_gib", "memory_scope",
        ])
        writer.writeheader()
        for model in models:
            summary = model["summary"]
            writer.writerow({
                "model_id": model["id"], "model_name": model["name"], "runtime": model["runtime"],
                "reference_blind": model["comparison"]["reference_blind"],
                "context_source": model["comparison"]["context_source"],
                "comparison_note": model["comparison"]["note"],
                "rank_eligible": model["comparison"]["reference_blind"] and summary["case_count"] > 0 and summary["successful_cases"] == summary["case_count"],
                **summary,
            })
    with (ARTIFACTS / "case-results.csv").open("w", newline="") as handle:
        fields = [
            "case_id", "dataset_id", "dataset_name", "source_record_id", "source_index", "model_id", "model_name", "input", "reference", "output",
            "error", "context_source", "exact_match", "edit_similarity", "chrf", "wer", "length_ratio", "input_tokens",
            "output_tokens", "generation_seconds", "tokens_per_second",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for model in models:
            for case in model["cases"]:
                writer.writerow({
                    "case_id": case["id"], "dataset_id": case["dataset_id"], "dataset_name": case["dataset_name"],
                    "source_record_id": case["source_record_id"], "source_index": case["source_index"],
                    "model_id": model["id"], "model_name": model["name"],
                    "input": case["input"], "reference": case["reference"], "output": case.get("output", ""),
                    "error": case.get("error"), "context_source": model["comparison"]["context_source"],
                    **case["metrics"], **(case.get("performance") or {}),
                })
    for filename in ("aggregate-results.csv", "case-results.csv"):
        shutil.copyfile(ARTIFACTS / filename, PUBLIC_DOWNLOADS / filename)
    shutil.copyfile(corpus_path, PUBLIC_DATA / "benchmark-sample.jsonl")
    print(json.dumps({model["id"]: model["summary"] for model in models}, indent=2))


if __name__ == "__main__":
    main()
