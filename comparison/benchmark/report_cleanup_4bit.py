#!/usr/bin/env python3
"""Export the 4-bit benchmark and its paired full-precision comparison."""

import csv
import json
import shutil
import zipfile
from collections import Counter

from run_old_cleanup import ROOT, sha256
from score_results import summarize_cases

ARTIFACTS = ROOT / "artifacts"
MODEL_ID = "new-cleanup-0.8b-4bit"


def main():
    payload = json.loads((ARTIFACTS / "benchmark-results.json").read_text())
    models = {m["id"]: m for m in payload["models"]}
    full, quant = models["new-cleanup-0.8b"], models[MODEL_ID]
    conversion = quant["provenance"]["conversion"]
    assert full["sample_sha256"] == quant["sample_sha256"]
    assert full["versions"] == quant["versions"] and full["platform"] == quant["platform"]
    assert conversion["source_files_sha256"] == full["provenance"]["model_file_sha256"]
    assert full["provenance"]["config"]["text_config"] == quant["provenance"]["config"]["text_config"]
    for key in ("decoding", "temperature", "thinking", "seed", "attempts_per_case", "warmup",
                "cross_case_prompt_cache", "speculative_decoding", "eos_token_ids", "token_budget"):
        assert full["generation"][key] == quant["generation"][key], key
    for model in (full, quant):
        assert model["status"] == "completed" and len(model["cases"]) == 100
        assert len({c["id"] for c in model["cases"]}) == 100
    pairs = []
    for before, after in zip(full["cases"], quant["cases"]):
        for key in ("id", "input", "reference", "messages", "prompt", "prompt_token_ids", "max_tokens"):
            assert before[key] == after[key], (after["id"], key)
        assert after["attempt"] == 1
        both = not before.get("error") and not after.get("error")
        pair = {"case_id": after["id"], "dataset_id": after["dataset_id"],
                "input": after["input"], "reference": after["reference"],
                "full_output": before["output"], "q4_output": after["output"],
                "full_error": before.get("error"), "q4_error": after.get("error"),
                "both_completed": both, "identical_raw_output": before["output"] == after["output"]}
        for metric in ("exact_match", "edit_similarity", "chrf", "wer"):
            pair[f"full_{metric}"] = before["metrics"][metric]
            pair[f"q4_{metric}"] = after["metrics"][metric]
            if metric != "exact_match":
                pair[f"delta_{metric}"] = after["metrics"][metric] - before["metrics"][metric] if both else None
        for label, case in (("full", before), ("q4", after)):
            pair[f"{label}_seconds"] = case["performance"]["generation_seconds"]
            pair[f"{label}_tokens_per_second"] = case["performance"]["tokens_per_second"]
            pair[f"{label}_finish_reason"] = case["finish_reason"]
        pairs.append(pair)
    common_ids = {p["case_id"] for p in pairs if p["both_completed"]}
    common = {label: summarize_cases([c for c in model["cases"] if c["id"] in common_ids])
              for label, model in (("full", full), ("q4", quant))}
    paired = {"both_completed": len(common_ids),
              "identical_raw_outputs": sum(p["identical_raw_output"] for p in pairs),
              "q4_higher_edit_similarity": sum(p["delta_edit_similarity"] > 1e-12 for p in pairs if p["both_completed"]),
              "same_edit_similarity": sum(abs(p["delta_edit_similarity"]) <= 1e-12 for p in pairs if p["both_completed"]),
              "q4_lower_edit_similarity": sum(p["delta_edit_similarity"] < -1e-12 for p in pairs if p["both_completed"]),
              "q4_failures": [p["case_id"] for p in pairs if p["q4_error"]]}
    path = lambda suffix: ARTIFACTS / f"{MODEL_ID}{suffix}"
    path(".jsonl").write_text("".join(json.dumps(c, ensure_ascii=False) + "\n" for c in quant["cases"]))
    with (ARTIFACTS / "case-results.csv").open(newline="") as handle:
        reader = csv.DictReader(handle)
        rows = [row for row in reader if row["model_id"] == MODEL_ID]
        with path(".csv").open("w", newline="") as out:
            writer = csv.DictWriter(out, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    paired_csv = ARTIFACTS / "cleanup-full-vs-4bit.csv"
    with paired_csv.open("w", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=list(pairs[0]))
        writer.writeheader()
        writer.writerows(pairs)
    paired_json = ARTIFACTS / "cleanup-full-vs-4bit.json"
    paired_json.write_text(json.dumps({"counts": paired, "common_case_summaries": common, "cases": pairs}, ensure_ascii=False, indent=2) + "\n")

    def pct(v):
        return "N/A" if v is None else f"{100 * v:.2f}%"

    def num(v, places=3):
        return "N/A" if v is None else f"{v:.{places}f}"

    def row(name, s):
        return (f"| {name} | {s['successful_cases']}/{s['case_count']} | {s['exact_matches']}/{s['case_count']} | "
                f"{pct(s['mean_edit_similarity'])} | {pct(s['mean_chrf'])} | {pct(s['mean_wer'])} | "
                f"{num(s['mean_generation_seconds'])} | {num(s['median_tokens_per_second'], 2)} |")

    heading = ["| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ | Mean seconds | Median tokens/s |",
               "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    size_reduction = 1 - conversion["quantized_text_tensor_bytes"] / conversion["source_text_tensor_bytes"]
    lines = ["# New Cleanup 0.8B: original precision versus 4-bit", "",
             f"Completed {quant['completed_at']}. Each quantized-model case was attempted once; no retries.", "",
             "## Benchmark results", "", *heading,
             row("Original BF16/FP32", full["summary"]), row("4-bit affine / group 64", quant["summary"]), "",
             "Quality and timing means use each run's successful cases; exact-match totals include all 100 expected cases. "
             "A normal EOS stop means completion, not correctness.", "",
             "## Common completed cases", "", *heading,
             row("Original, shared cases", common["full"]), row("4-bit, shared cases", common["q4"]), "",
             f"Across {len(common_ids)} shared completed cases, 4-bit edit similarity was higher on "
             f"{paired['q4_higher_edit_similarity']}, equal on {paired['same_edit_similarity']}, "
             f"and lower on {paired['q4_lower_edit_similarity']}. "
             f"Raw outputs were identical on {paired['identical_raw_outputs']} of all 100 cases.", "",
             f"Quantized-model failures: {', '.join(paired['q4_failures']) or 'none'}.", "",
             "## Dataset breakdown", "", *heading,
             *[row(f"{label}: {dataset}", model["dataset_summaries"][dataset]) for dataset in sorted(quant["dataset_summaries"])
               for label, model in (("Original", full), ("4-bit", quant))], "",
             "## Memory and storage", "",
             "| Measurement | Original | 4-bit |", "| --- | ---: | ---: |",
             f"| Text tensor storage | {conversion['source_text_tensor_bytes'] / 2**20:.2f} MiB | {conversion['quantized_text_tensor_bytes'] / 2**20:.2f} MiB |",
             f"| Inference peak process RSS | {num(full['summary']['peak_memory_gib'])} GiB | {num(quant['summary']['peak_memory_gib'])} GiB |", "",
             f"Text tensor storage fell by {size_reduction * 100:.2f}%. The saved 4-bit safetensors file is "
             f"{conversion['quantized_weight_file_bytes'] / 2**20:.2f} MiB including its header. "
             f"Effective storage is {conversion['effective_bits_per_text_parameter']:.3f} bits per original text parameter, "
             "because scales/biases and nonquantized tensors add overhead beyond packed 4-bit weights.", "",
             "The source archive also contains vision and MTP weights, omitted from this text-only export. "
             "The text-tensor comparison above excludes those components on both sides; comparing the full source file size "
             "with the text-only quantized file would overstate quantization savings. RSS is process memory, not total unified/GPU memory, "
             "and was measured in separate inference processes rather than the conversion process.", "",
             "## Conversion and controlled evaluation", "",
             f"Source: `{conversion['source_archive']}`; SHA-256 `{conversion['source_archive_sha256']}`. "
             f"Corpus SHA-256: `{quant['sample_sha256']}`.", "",
             f"The converter strictly loads the source text model ({conversion['text_parameter_count']:,} parameters), "
             f"then quantizes {conversion['quantized_module_count']} eligible linear/embedding modules using MLX affine 4-bit weights "
             f"and group size 64. {conversion['unchanged_tensor_count']} nonquantized tensors retain their exact loaded values and dtypes. "
             "The CLI converter's optional global dtype cast is deliberately avoided. No calibration, retraining, mixed-bit recipe, "
             "activation quantization or KV-cache quantization is used.", "",
             "The source is never overwritten. The saved artifact is strictly reloaded and every tensor checked for exact equality "
             "with its in-memory converted counterpart. Tokenizer files/chat template are copied byte-for-byte; EOS remains 248046. "
             "No inference is used to choose quantization settings.", "",
             "All 100 cases use identical input/reference records, system instructions, rendered prompts, prompt token IDs, token budgets "
             "and generation settings as the original-precision run. References are never fed to the model. "
             "Greedy decoding uses temperature zero, seed zero and thinking disabled. The token budget is "
             "max(96, floor(raw-input-token-count × 1.5) + 48). No warmup, cross-case prompt cache or speculative decoding is used.", "",
             "Raw outputs, prompts, token IDs, finish reasons, timestamps, versions and hashes are saved. "
             "The unchanged fairness-v1 scorer trims only outer whitespace for scoring, retaining failures and raw outputs. "
             "Latency includes prompt processing and generation, including first-case cold start, but excludes model load, tokenization "
             "and artifact writes. Throughput uses re-tokenized decoded output, matching the existing benchmark convention.", "",
             "This is one run per checkpoint in separate sessions. Timing differences are descriptive, not repeated-trial estimates. "
             "String metrics can penalize valid variants. Training overlap remains unverified, and these 100 cases do not establish general quality.", "",
             "## Other saved configurations", "", *heading,
             *[row(m["name"], m["summary"]) for m in sorted(models.values(), key=lambda m: m["summary"]["mean_edit_similarity"] or 0, reverse=True)], "",
             "This table is sorted by measured similarity for inspection. The viewer ranks only complete, reference-blind runs in the selected dataset.", ""]
    for title, direction in (("Largest improvements", 1), ("Largest regressions", -1)):
        lines.extend([f"## {title}", "", "Selected by paired edit-similarity change, not human error labels.", ""])
        selected = [p for p in pairs if p["both_completed"] and direction * p["delta_edit_similarity"] > 1e-12]
        for p in sorted(selected, key=lambda p: direction * p["delta_edit_similarity"], reverse=True)[:5]:
            lines.extend([f"### {p['case_id']}: {p['delta_edit_similarity'] * 100:+.2f} percentage points", "",
                          "**Input**", "", p["input"], "", "**Reference**", "", p["reference"], "",
                          "**Original output**", "", p["full_output"], "", "**4-bit output**", "", p["q4_output"], ""])
    lines.extend(["## Artifacts and reproduction", "",
                  "The reusable MLX model is in `comparison/models/new-cleanup-0.8b-4bit/`; "
                  "`comparison/models/new-cleanup-0.8b-4bit.zip` packages the same files. Both stay local and excluded from Git.", "",
                  "The complete evidence ZIP includes all 100 new records, paired comparisons, conversion manifest, source corpus, "
                  "existing baseline outputs, runtime logs and reproduction scripts. It excludes model weights.", "",
                  "From the repository root:", "", "```sh",
                  "comparison/.venv/bin/python comparison/benchmark/quantize_new_cleanup.py",
                  f"comparison/.venv/bin/python comparison/benchmark/run_new_cleanup_4bit.py --archive /path/to/{conversion['source_archive']}",
                  "comparison/.venv/bin/python comparison/benchmark/score_results.py",
                  "comparison/.venv/bin/python comparison/benchmark/report_cleanup_4bit.py", "```", "",
                  "Conversion and inference refuse existing destinations/results; use a separate project copy for a new run. "
                  "No existing baseline was rerun. No application build was run.", ""])
    path(".md").write_text("\n".join(lines))
    model_dir = ROOT / "models" / MODEL_ID
    package_path = ROOT / "models" / f"{MODEL_ID}.zip"
    expected_files = {**conversion["output_files_sha256"], "conversion.json": sha256(model_dir / "conversion.json")}
    for name, expected in expected_files.items():
        assert sha256(model_dir / name) == expected, name
    if not package_path.exists():
        # The reusable weights stay outside public exports and version control.
        with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_STORED) as archive:
            for name in sorted(expected_files):
                archive.write(model_dir / name, f"{MODEL_ID}/{name}")
    with zipfile.ZipFile(package_path) as archive:
        import hashlib
        assert set(archive.namelist()) == {f"{MODEL_ID}/{name}" for name in expected_files}
        for name, expected in expected_files.items():
            with archive.open(f"{MODEL_ID}/{name}") as handle:
                assert hashlib.file_digest(handle, "sha256").hexdigest() == expected, name
    outputs = [ARTIFACTS / f"results-{MODEL_ID}.json", *[path(s) for s in (".jsonl", ".csv", ".md", "-conversion.json")], paired_csv, paired_json]
    script_names = ("quantize_new_cleanup.py", "run_old_cleanup.py", "run_new_cleanup_4bit.py", "report_cleanup_4bit.py", "score_results.py", "requirements-fluid.txt", "README.md")
    scripts = [ROOT / "benchmark" / name for name in script_names]
    manifest = {"model_id": MODEL_ID, "corpus_sha256": quant["sample_sha256"],
                "summary": quant["summary"], "dataset_summaries": quant["dataset_summaries"],
                "case_count": 100, "attempts": dict(Counter(str(c["attempt"]) for c in quant["cases"])),
                "finish_reasons": dict(Counter(c["finish_reason"] for c in quant["cases"])),
                "paired_counts": paired, "common_case_summaries": common,
                "model_package": {"path": str(package_path.relative_to(ROOT.parent)),
                                  "bytes": package_path.stat().st_size, "sha256": sha256(package_path)},
                "files_sha256": {p.name: sha256(p) for p in outputs},
                "script_sha256": {p.name: sha256(p) for p in scripts}}
    path("-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    bundle = [*outputs, path("-manifest.json"), *scripts, ARTIFACTS / "benchmark-corpus.jsonl", ARTIFACTS / "benchmark-results.json",
              ROOT / "logs" / f"{MODEL_ID}.log", ROOT / "logs" / f"{MODEL_ID}-conversion.log",
              *[p for p in ARTIFACTS.glob("results-*.json") if p not in outputs]]
    with zipfile.ZipFile(path("-complete.zip"), "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for p in bundle:
            archive.write(p, p.relative_to(ROOT.parent))
    for p in [*outputs, path("-manifest.json"), path("-complete.zip")]:
        shutil.copyfile(p, ROOT.parent / "public" / "downloads" / p.name)
    print(json.dumps({"summary": quant["summary"], "paired": paired, "common": common,
                      "text_storage_reduction": size_reduction}, indent=2))


if __name__ == "__main__":
    main()
