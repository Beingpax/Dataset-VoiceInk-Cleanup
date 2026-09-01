#!/usr/bin/env python3
"""Export the new checkpoint's full evidence and paired older/newer comparison."""

import csv
import hashlib
import json
import shutil
import zipfile
from collections import Counter
from pathlib import Path

from score_results import summarize_cases

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
MODEL_ID = "new-cleanup-0.8b"
OLD_ID = "old-cleanup-0.8b"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    payload = json.loads((ARTIFACTS / "benchmark-results.json").read_text())
    models = {model["id"]: model for model in payload["models"]}
    new, old = models[MODEL_ID], models[OLD_ID]
    corpus = [json.loads(line) for line in (ARTIFACTS / "benchmark-corpus.jsonl").read_text().splitlines()]
    ids = [case["id"] for case in corpus]
    for model in (old, new):
        if model.get("status") != "completed" or [c["id"] for c in model["cases"]] != ids or len(set(ids)) != 100:
            raise ValueError("Both runs must contain the same 100 distinct fixed cases in order.")
    if old["sample_sha256"] != new["sample_sha256"]:
        raise ValueError("Corpus fingerprints differ.")
    if old["versions"] != new["versions"] or old["platform"] != new["platform"]:
        raise ValueError("Runtime versions or platform differ.")
    for name in ("config.json", "tokenizer.json", "tokenizer_config.json", "chat_template.jinja"):
        if old["provenance"]["model_file_sha256"][name] != new["provenance"]["model_file_sha256"][name]:
            raise ValueError(f"Checkpoint metadata differs: {name}")
    weights = "model.safetensors-00001-of-00001.safetensors"
    if old["provenance"]["model_file_sha256"][weights] == new["provenance"]["model_file_sha256"][weights]:
        raise ValueError("The supplied checkpoints have identical weights.")
    for key in ("config", "parameters_by_prefix", "tensor_dtypes"):
        if old["provenance"][key] != new["provenance"][key]:
            raise ValueError(f"Checkpoint compatibility differs: {key}")
    for key in ("decoding", "temperature", "thinking", "seed", "attempts_per_case", "warmup",
                "cross_case_prompt_cache", "speculative_decoding", "eos_token_ids", "token_budget"):
        if old["generation"][key] != new["generation"][key]:
            raise ValueError(f"Generation settings differ: {key}")
    for before, after in zip(old["cases"], new["cases"]):
        for key in ("input", "reference", "messages", "prompt", "prompt_token_ids", "max_tokens"):
            if before[key] != after[key]:
                raise ValueError(f"Inference context differs: {before['id']} / {key}")

    def path(suffix):
        return ARTIFACTS / f"{MODEL_ID}{suffix}"

    path(".jsonl").write_text("".join(json.dumps(c, ensure_ascii=False) + "\n" for c in new["cases"]))
    with (ARTIFACTS / "case-results.csv").open(newline="") as handle:
        reader = csv.DictReader(handle)
        rows = [row for row in reader if row["model_id"] == MODEL_ID]
        with path(".csv").open("w", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    pairs = []
    for before, after in zip(old["cases"], new["cases"]):
        both = not before.get("error") and not after.get("error")
        row = {
            "case_id": after["id"], "dataset_id": after["dataset_id"],
            "input": after["input"], "reference": after["reference"],
            "old_output": before["output"], "new_output": after["output"],
            "old_error": before.get("error"), "new_error": after.get("error"),
            "old_finish_reason": before["finish_reason"], "new_finish_reason": after["finish_reason"],
            "both_completed": both,
        }
        for metric in ("exact_match", "edit_similarity", "chrf", "wer"):
            row[f"old_{metric}"] = before["metrics"][metric]
            row[f"new_{metric}"] = after["metrics"][metric]
            if metric != "exact_match":
                row[f"delta_{metric}"] = after["metrics"][metric] - before["metrics"][metric] if both else None
        row["old_seconds"] = before["performance"]["generation_seconds"]
        row["new_seconds"] = after["performance"]["generation_seconds"]
        pairs.append(row)
    pair_path = ARTIFACTS / "cleanup-old-vs-new.csv"
    with pair_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(pairs[0]))
        writer.writeheader()
        writer.writerows(pairs)

    common_ids = {p["case_id"] for p in pairs if p["both_completed"]}
    paired_summaries = {label: summarize_cases([c for c in model["cases"] if c["id"] in common_ids])
                        for label, model in (("old", old), ("new", new))}
    paired_counts = {
        "both_completed": len(common_ids),
        "new_higher_edit_similarity": sum(p["delta_edit_similarity"] > 1e-12 for p in pairs if p["both_completed"]),
        "same_edit_similarity": sum(abs(p["delta_edit_similarity"]) <= 1e-12 for p in pairs if p["both_completed"]),
        "new_lower_edit_similarity": sum(p["delta_edit_similarity"] < -1e-12 for p in pairs if p["both_completed"]),
        "old_failures_now_completed": [p["case_id"] for p in pairs if p["old_error"] and not p["new_error"]],
        "new_failures_previously_completed": [p["case_id"] for p in pairs if p["new_error"] and not p["old_error"]],
        "both_failed": [p["case_id"] for p in pairs if p["new_error"] and p["old_error"]],
    }
    pair_json = ARTIFACTS / "cleanup-old-vs-new.json"
    pair_json.write_text(json.dumps({"corpus_sha256": new["sample_sha256"], "counts": paired_counts,
                                    "common_case_summaries": paired_summaries, "cases": pairs}, ensure_ascii=False, indent=2) + "\n")

    def pct(value):
        return "N/A" if value is None else f"{value * 100:.2f}%"

    def number(value, digits=3):
        return "N/A" if value is None else f"{value:.{digits}f}"

    def table_row(label, summary):
        return (f"| {label} | {summary['successful_cases']}/{summary['case_count']} | "
                f"{summary['exact_matches']}/{summary['case_count']} | {pct(summary['mean_edit_similarity'])} | "
                f"{pct(summary['mean_chrf'])} | {pct(summary['mean_wer'])} | {number(summary['mean_generation_seconds'])} |")

    heading = ["| Configuration / dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds |",
               "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    lines = ["# New Cleanup 0.8B — comparison with the older checkpoint", "",
             f"Completed {new['completed_at']}. Evaluated all 100 fixed cases once with no retries.", "",
             "## Results", "", *heading, table_row("Old checkpoint", old["summary"]),
             table_row("New checkpoint", new["summary"]), "",
             "Quality and latency means above are conditional on each model's completed cases; exact-match totals include all 100. "
             "The common-case comparison below uses an identical subset for both models.", "",
             "## Paired comparison", "", *heading,
             table_row("Old, common completed cases", paired_summaries["old"]),
             table_row("New, common completed cases", paired_summaries["new"]), "",
             f"On the {len(common_ids)} cases both completed: new edit similarity is higher on "
             f"{paired_counts['new_higher_edit_similarity']}, equal on {paired_counts['same_edit_similarity']}, "
             f"and lower on {paired_counts['new_lower_edit_similarity']}.", "",
             f"Old failures now completed: {', '.join(paired_counts['old_failures_now_completed']) or 'none'}.", "",
             f"New failures on previously completed cases: {', '.join(paired_counts['new_failures_previously_completed']) or 'none'}.", "",
             f"Failed in both runs: {', '.join(paired_counts['both_failed']) or 'none'}.", "",
             "## Dataset breakdown", "", *heading,
             *[table_row(f"{label}: {dataset}", model["dataset_summaries"][dataset])
               for dataset in sorted(new["dataset_summaries"]) for label, model in (("Old", old), ("New", new))], "",
             "## All saved configurations", "", *heading,
             *[table_row(m["name"], m["summary"]) for m in sorted(models.values(), key=lambda m: m["summary"]["mean_edit_similarity"] or 0, reverse=True)], "",
             "Sorted by measured edit similarity for inspection, not an eligibility-aware ranking. "
             "The app ranks only complete reference-blind runs within the selected dataset.", "",
             "## Identity and inference controls", "",
             f"New archive: `{new['provenance']['archive_name']}`; SHA-256 `{new['provenance']['archive_sha256']}`.", "",
             f"Old archive: `{old['provenance']['archive_name']}`; SHA-256 `{old['provenance']['archive_sha256']}`.", "",
             f"Fixed corpus SHA-256: `{new['sample_sha256']}`.", "",
             "Both checkpoints have identical config, tensor counts/dtypes, tokenizer files and chat template: "
             "752,393,024 text parameters, 100,592,896 vision parameters and 20,452,864 auxiliary MTP parameters. "
             "Weights are different. Text inference uses original mixed BF16/FP32 precision. "
             "The strict MLX Qwen3.5 loader omits vision/MTP tensors and adapts convolution layout and normalization offsets in memory.", "",
             "The user identifies the new checkpoint as trained on a new dataset. Neither archive contains a training manifest. "
             "Dataset identity, benchmark overlap and other training settings cannot be independently confirmed. "
             "Observed differences therefore cannot be attributed solely to the dataset.", "",
             "1. Extract each archive into a separate ignored local model directory and hash all files. Do not modify the weights.",
             "2. Read the unchanged 100-case corpus: 50 VoiceInk validation cases and 50 curated pairs.",
             "3. Feed only the stored system instruction and raw input through the bundled chat template. References and metadata are saved for scoring, never supplied to inference.",
             "4. Use greedy decoding, temperature zero, seed zero, thinking disabled, and max(96, floor(raw input token count × 1.5) + 48) tokens. Stop on token 248046 (<|im_end|>). No warmup, retries, cross-case cache, batching or speculative decoding.",
             "5. Preserve each raw output, exact prompt, token IDs, timing, finish reason and model/runtime provenance. A token-limit termination remains a failure with its partial output intact.",
             "6. Score with unchanged fairness-v1 formulas, trimming only outer whitespace for text scoring. Export new records, paired deltas, full comparison data and a hash manifest.", "",
             "The report verifies identical prompts, token IDs, input/reference pairs, budgets and generation settings for all paired cases. "
             "Runtime versions and platform are recorded. Runs happened in separate sessions; timing differences are descriptive. "
             "Latency covers prompt processing and generation, excludes load/tokenization/checkpoint writes, and includes first-case cold start. "
             "Throughput uses re-tokenized decoded output; process RSS is approximate and does not measure total GPU/unified memory.", "",
             f"New run total inference time (including failures): {sum(c['performance']['generation_seconds'] for c in new['cases']):.3f} s. "
             f"Load time: {new['generation']['load_seconds']:.3f} s. "
             f"Median successful-case throughput: {number(new['summary']['median_tokens_per_second'], 2)} tokens/s. "
             f"Peak process RSS: {number(new['summary']['peak_memory_gib'])} GiB.", "",
             "String metrics penalize some valid wording/formatting variants. Completion does not mean correctness. "
             "This fixed-sample comparison is not a population estimate or a fully human-reviewed quality assessment.", "",
             "## New-run failures", ""]
    failures = [c for c in new["cases"] if c.get("error")]
    lines.extend([f"- {c['id']}: {c['error']}" for c in failures] or ["None; all 100 cases stopped normally."])
    for title, reverse in (("Largest improvements", True), ("Largest regressions", False)):
        lines.extend(["", f"## {title}", "", "Selected automatically by paired edit-similarity change; not human error labels.", ""])
        selected = [p for p in pairs if p["both_completed"] and (p["delta_edit_similarity"] > 1e-12 if reverse else p["delta_edit_similarity"] < -1e-12)]
        for pair in sorted(selected, key=lambda p: p["delta_edit_similarity"], reverse=reverse)[:5]:
            lines.extend([f"### {pair['case_id']}: {pair['delta_edit_similarity'] * 100:+.2f} percentage points", "",
                          "**Input**", "", pair["input"], "", "**Reference**", "", pair["reference"], "",
                          "**Old output**", "", pair["old_output"], "", "**New output**", "", pair["new_output"], ""])
    lines.extend(["## Reproduction and exports", "",
                  "From the repository root after extracting the new archive into `comparison/models/new-cleanup-0.8b/`:", "",
                  "```sh",
                  f"comparison/.venv/bin/python comparison/benchmark/run_new_cleanup.py --archive /path/to/{new['provenance']['archive_name']}",
                  "comparison/.venv/bin/python comparison/benchmark/score_results.py",
                  "comparison/.venv/bin/python comparison/benchmark/report_new_cleanup.py", "```", "",
                  "The runner refuses existing results to prevent accidental repeats. Keep a separate project copy for reruns. "
                  "The shared runner is run_old_cleanup.py; only the checkpoint identity changes. "
                  "Use the versions recorded in the raw result and requirements-fluid.txt. No application build is needed or was run.", "",
                  "- `results-new-cleanup-0.8b.json`: complete original inference evidence.",
                  "- `new-cleanup-0.8b.jsonl` / `.csv`: all 100 scored records.",
                  "- `cleanup-old-vs-new.json` / `.csv`: all 100 paired outputs, metrics, deltas and failures.",
                  "- `new-cleanup-0.8b-manifest.json`: hashes, coverage and paired summaries.",
                  "- `new-cleanup-0.8b-complete.zip`: evidence, comparison, frozen corpus, logs and reproduction scripts; no weights.", ""])
    path(".md").write_text("\n".join(lines))
    outputs = [ARTIFACTS / f"results-{MODEL_ID}.json", *[path(s) for s in (".jsonl", ".csv", ".md")], pair_path, pair_json]
    scripts = [ROOT / "benchmark" / name for name in (
        "run_old_cleanup.py", "run_new_cleanup.py", "report_new_cleanup.py", "score_results.py", "requirements-fluid.txt", "README.md")]
    manifest = {"model_id": MODEL_ID, "archive_sha256": new["provenance"]["archive_sha256"],
                "corpus_sha256": new["sample_sha256"], "case_count": 100,
                "attempts": dict(Counter(str(c["attempt"]) for c in new["cases"])),
                "finish_reasons": dict(Counter(c["finish_reason"] for c in new["cases"])),
                "summary": new["summary"], "dataset_summaries": new["dataset_summaries"],
                "paired_counts": paired_counts, "common_case_summaries": paired_summaries,
                "files_sha256": {p.name: digest(p) for p in outputs},
                "script_sha256": {p.name: digest(p) for p in scripts}}
    manifest_path = path("-manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    bundle = [*outputs, manifest_path, *scripts, ARTIFACTS / "benchmark-corpus.jsonl",
              ARTIFACTS / "benchmark-results.json", ROOT / "logs" / f"{MODEL_ID}.log",
              ROOT / "logs" / f"{OLD_ID}.log",
              *[p for p in sorted(ARTIFACTS.glob("results-*.json")) if p not in outputs]]
    archive_path = path("-complete.zip")
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for p in bundle:
            archive.write(p, p.relative_to(ROOT.parent))
    for p in [*outputs, manifest_path, archive_path]:
        shutil.copyfile(p, ROOT.parent / "public" / "downloads" / p.name)
    print(json.dumps({"summary": new["summary"], "paired": paired_counts,
                      "common_case_summaries": paired_summaries}, indent=2))


if __name__ == "__main__":
    main()
