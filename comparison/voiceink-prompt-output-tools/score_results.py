#!/usr/bin/env python3
"""Apply the benchmark's reference-based string metrics to VoiceInk outputs."""

import json
import math
from pathlib import Path

import jiwer
from rapidfuzz.fuzz import ratio
from sacrebleu.metrics import CHRF


RESULTS_PATH = Path(__file__).resolve().parent.parent / "artifacts" / "voiceink-prompt-output.json"
CHRF_METRIC = CHRF(word_order=2)


def safe_wer(reference: str, output: str) -> float:
    if not reference.strip():
        return 0.0 if not output.strip() else 1.0
    return float(jiwer.wer(reference, output))


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    low, high = math.floor(position), math.ceil(position)
    if low == high:
        return ordered[low]
    return ordered[low] * (high - position) + ordered[high] * (position - low)


def main() -> None:
    payload = json.loads(RESULTS_PATH.read_text())
    measured = []
    for case in payload["cases"]:
        if case.get("error"):
            case["metrics"] = {
                "exact_match": False,
                "edit_similarity": None,
                "chrf": None,
                "wer": None,
                "length_ratio": None,
            }
            continue

        reference = case["reference"].strip()
        output = case["voiceink_output"].strip()
        case["metrics"] = {
            "exact_match": output == reference,
            "edit_similarity": ratio(reference, output) / 100.0,
            "chrf": CHRF_METRIC.sentence_score(output, [reference]).score / 100.0,
            "wer": safe_wer(reference, output),
            "length_ratio": len(output) / len(reference) if reference else (1.0 if not output else None),
        }
        measured.append(case)

    similarities = [case["metrics"]["edit_similarity"] for case in measured]
    chrf_scores = [case["metrics"]["chrf"] for case in measured]
    word_error_rates = [case["metrics"]["wer"] for case in measured]
    latencies = [case["latency_ms"] / 1000 for case in measured if case.get("latency_ms") is not None]
    payload["summary"] = {
        "case_count": len(payload["cases"]),
        "successful_cases": len(measured),
        "failed_cases": len(payload["cases"]) - len(measured),
        "exact_matches": sum(case["metrics"]["exact_match"] for case in measured),
        "mean_edit_similarity": sum(similarities) / len(similarities) if similarities else None,
        "mean_chrf": sum(chrf_scores) / len(chrf_scores) if chrf_scores else None,
        "mean_wer": sum(word_error_rates) / len(word_error_rates) if word_error_rates else None,
        "mean_generation_seconds": sum(latencies) / len(latencies) if latencies else None,
        "median_generation_seconds": percentile(latencies, 0.5),
    }
    RESULTS_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    main()
