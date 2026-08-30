#!/usr/bin/env python3
"""Score all completed model outputs and publish site-ready JSON."""

import csv
import json
import math
import platform
from pathlib import Path

import jiwer
from rapidfuzz.fuzz import ratio
from sacrebleu.metrics import CHRF

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
SITE_DATA = ROOT / "site" / "data"
CHRF = CHRF(word_order=2)


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
    reference = case["reference"].strip()
    output = case.get("output", "").strip()
    case["metrics"] = {
        "exact_match": output == reference,
        "edit_similarity": ratio(reference, output) / 100.0,
        "chrf": CHRF.sentence_score(output, [reference]).score / 100.0,
        "wer": safe_wer(reference, output),
        "length_ratio": len(output) / len(reference) if reference else (1.0 if not output else None),
    }
    return case


def summarize(model: dict) -> dict:
    cases = [score_case(case) for case in model["cases"]]
    measured = [case for case in cases if not case.get("error")]
    generation = model.get("generation", {})
    per_case_tps = [case.get("performance", {}).get("tokens_per_second") for case in measured]
    per_case_tps = [value for value in per_case_tps if isinstance(value, (int, float))]
    latencies = [case.get("performance", {}).get("generation_seconds") for case in measured]
    latencies = [value for value in latencies if isinstance(value, (int, float))]
    summary = {
        "case_count": len(cases),
        "successful_cases": len(measured),
        "exact_match_rate": sum(case["metrics"]["exact_match"] for case in measured) / len(measured),
        "mean_edit_similarity": sum(case["metrics"]["edit_similarity"] for case in measured) / len(measured),
        "mean_chrf": sum(case["metrics"]["chrf"] for case in measured) / len(measured),
        "mean_wer": sum(case["metrics"]["wer"] for case in measured) / len(measured),
        "median_tokens_per_second": percentile(per_case_tps, 0.5),
        "mean_generation_seconds": sum(latencies) / len(latencies) if latencies else None,
        "median_generation_seconds": percentile(latencies, 0.5),
        "peak_memory_gib": generation.get("peak_memory_gib"),
        "memory_scope": generation.get("memory_scope", "unavailable"),
    }
    model["cases"] = cases
    model["summary"] = summary
    dataset_summaries = {}
    for dataset_id in sorted({case["dataset_id"] for case in measured}):
        subset = [case for case in measured if case["dataset_id"] == dataset_id]
        subset_tps = [case.get("performance", {}).get("tokens_per_second") for case in subset]
        subset_tps = [value for value in subset_tps if isinstance(value, (int, float))]
        subset_latency = [case.get("performance", {}).get("generation_seconds") for case in subset]
        subset_latency = [value for value in subset_latency if isinstance(value, (int, float))]
        dataset_summaries[dataset_id] = {
            "case_count": len(subset),
            "exact_match_rate": sum(case["metrics"]["exact_match"] for case in subset) / len(subset),
            "mean_edit_similarity": sum(case["metrics"]["edit_similarity"] for case in subset) / len(subset),
            "mean_chrf": sum(case["metrics"]["chrf"] for case in subset) / len(subset),
            "mean_wer": sum(case["metrics"]["wer"] for case in subset) / len(subset),
            "median_tokens_per_second": percentile(subset_tps, 0.5),
            "mean_generation_seconds": sum(subset_latency) / len(subset_latency) if subset_latency else None,
            "median_generation_seconds": percentile(subset_latency, 0.5),
        }
    model["dataset_summaries"] = dataset_summaries
    return model


def main() -> None:
    sample = load_jsonl(ARTIFACTS / "sample.jsonl")
    by_id = {case["id"]: case for case in sample}
    result_paths = sorted(ARTIFACTS.glob("results-*.json"))
    models = []
    for path in result_paths:
        model = json.loads(path.read_text())
        for case in model["cases"]:
            source = by_id[case["id"]]
            case.update({key: source.get(key) for key in (
                "source_index", "input", "reference", "s1_context", "selection_group",
                "input_words", "input_characters", "dataset_id", "dataset_name",
                "source_record_id", "metadata",
            )})
        models.append(summarize(model))
    payload = {
        "benchmark": {
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
            ],
        },
        "models": models,
    }
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / "benchmark-results.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    (SITE_DATA / "benchmark.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    with (ARTIFACTS / "aggregate-results.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "model_id", "model_name", "runtime", "case_count", "successful_cases", "exact_match_rate",
            "mean_edit_similarity", "mean_chrf", "mean_wer", "median_tokens_per_second",
            "mean_generation_seconds", "median_generation_seconds", "peak_memory_gib", "memory_scope",
        ])
        writer.writeheader()
        for model in models:
            writer.writerow({"model_id": model["id"], "model_name": model["name"], "runtime": model["runtime"], **model["summary"]})
    with (ARTIFACTS / "case-results.csv").open("w", newline="") as handle:
        fields = [
            "case_id", "dataset_id", "dataset_name", "source_record_id", "source_index", "model_id", "model_name", "input", "reference", "output",
            "exact_match", "edit_similarity", "chrf", "wer", "length_ratio", "input_tokens",
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
                    "input": case["input"], "reference": case["reference"], "output": case["output"],
                    **case["metrics"], **case.get("performance", {}),
                })
    print(json.dumps({model["id"]: model["summary"] for model in models}, indent=2))


if __name__ == "__main__":
    main()
