#!/usr/bin/env python3
"""Export scored evidence and a readable report for the older checkpoint."""

import csv
import hashlib
import json
import shutil
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
MODEL_ID = "old-cleanup-0.8b"


def main():
    payload = json.loads((ARTIFACTS / "benchmark-results.json").read_text())
    model = next(m for m in payload["models"] if m["id"] == MODEL_ID)
    cases, summary = model["cases"], model["summary"]
    if model.get("status") != "completed" or len(cases) != 100:
        raise ValueError("Report requires the completed 100-case run.")
    def export_path(suffix):
        return ARTIFACTS / f"{MODEL_ID}{suffix}"

    export_path(".jsonl").write_text("".join(json.dumps(c, ensure_ascii=False) + "\n" for c in cases))
    with (ARTIFACTS / "case-results.csv").open(newline="") as handle:
        reader = csv.DictReader(handle)
        rows = [row for row in reader if row["model_id"] == MODEL_ID]
        with export_path(".csv").open("w", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def pct(value):
        return "N/A" if value is None else f"{value * 100:.2f}%"

    def row(label, stats):
        return (f"| {label} | {stats['successful_cases']}/{stats['case_count']} | "
                f"{stats['exact_matches']}/{stats['case_count']} | {pct(stats['mean_edit_similarity'])} | "
                f"{pct(stats['mean_chrf'])} | {pct(stats['mean_wer'])} |")

    provenance = model["provenance"]
    total_seconds = sum(c["performance"]["generation_seconds"] for c in cases)
    output_tokens = sum(c["performance"]["output_tokens"] for c in cases)
    lines = [
        "# Old Cleanup 0.8B — complete 100-case evaluation", "",
        f"Completed: {model['completed_at']}. One attempt per case; no retries or output editing.", "",
        "## Results", "",
        "| Dataset | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        row("All cases", summary),
        *[row(key, stats) for key, stats in model["dataset_summaries"].items()], "",
        f"Mean latency: {summary['mean_generation_seconds']:.3f} s/case. "
        f"Median latency: {summary['median_generation_seconds']:.3f} s/case. "
        f"Median throughput: {summary['median_tokens_per_second']:.2f} output tokens/s.", "",
        f"Total measured inference time: {total_seconds:.3f} s for {output_tokens:,} decoded output tokens. "
        f"Overall throughput: {output_tokens / total_seconds:.2f} tokens/s. "
        f"Model load: {model['generation']['load_seconds']:.3f} s. "
        f"Peak process RSS: {summary['peak_memory_gib']:.3f} GiB.", "",
        "## Checkpoint identity", "",
        f"Source archive: `{provenance['archive_name']}`.", "",
        "The configuration identifies Qwen3.5. The text-model tensors contain 752,393,024 parameters; "
        "vision tensors contain 100,592,896 and auxiliary MTP tensors contain 20,452,864. "
        "The label Old Cleanup 0.8B is descriptive, not an archive-provided product name. "
        "The archive has no training manifest or dataset name, so the older dataset association and training overlap cannot be verified.", "",
        f"Archive SHA-256: `{provenance['archive_sha256']}`.", "",
        f"Corpus SHA-256: `{model['sample_sha256']}`.", "",
        f"Loading: {provenance['loading']}", "",
        "## Data processing and inference", "",
        "1. Extract the user-supplied archive to the ignored local model directory; preserve the original archive and weights.",
        "2. Read the frozen benchmark-corpus.jsonl: 50 VoiceInk validation cases and 50 curated cleanup pairs. Do not regenerate the sample.",
        "3. Send only each case's stored system instruction and raw input through the archive's chat template. References, categories and metadata are saved for evaluation but never supplied to the model.",
        "4. Disable thinking; use greedy decoding at temperature zero, seed zero and a fresh prompt cache per case. No warmup, batching, speculative decoding or retries.",
        "5. Use max(96, floor(raw input token count × 1.5) + 48) output tokens. Stop on the tokenizer's <|im_end|> token (248046). Treat token-limit termination as a failed case.",
        "6. Preserve raw decoded outputs, actual messages, rendered prompts, prompt/generated token IDs, timestamps, finish reasons, runtime versions, config, hashes and timings. Checkpoint after every case.",
        "7. Apply the existing fairness-v1 scorer. Only outer whitespace is stripped for scoring; raw outputs remain unchanged. Exact match includes all 100 expected cases. Quality means use successful cases only.",
        "8. Export combined benchmark JSON/CSV for the existing viewer, plus dedicated JSONL/CSV and this report. Other models are not rerun.", "",
        "Latency includes prompt processing and generation, including the first case's cold start. "
        "It excludes model loading, input tokenization and artifact writes. Throughput counts re-tokenized decoded output, "
        "matching the existing local benchmark convention. Peak memory is process RSS, not total unified-memory use.", "",
        "## Comparison with saved baselines", "",
        "| Configuration | Completed | Exact | Edit similarity ↑ | chrF++ ↑ | WER ↓ |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
        *[row(m["name"], m["summary"]) for m in sorted(payload["models"], key=lambda m: m["summary"]["mean_edit_similarity"] or 0, reverse=True)], "",
        "These are configuration comparisons. Prompts and precision differ, older baseline timings were collected in different sessions, "
        "and string metrics can penalize valid cleanup variants. Reference-blind inference does not establish that cases were absent from training. "
        "Original training-prompt compatibility is unverified. No application build was run.", "",
        "## Token-limit failures", "",
        "All five failures occurred in the curated dataset; their partial outputs remain in every case export. "
        "They are excluded from conditional quality/latency means and prevent this configuration from receiving a benchmark rank.", "",
        *[f"- {c['id']}: budget {c['max_tokens']} tokens; {c['performance']['generation_seconds']:.3f} s; {c['error']}" for c in cases if c.get("error")], "",
        "Inspection of the saved outputs shows repetitive text in all five token-limit failures. "
        "Other visible errors include leaving spoken punctuation as words (V01/V02), changing a name (V01: Mina → Minia), "
        "and answering the transcript instead of only cleaning it (C02 adds a refusal to move the review). "
        "These are examples from this run, not exhaustive human annotations.", "",
        "## Lowest edit-similarity cases", "",
        "The following are automatic metric diagnostics, not a human judgment that every difference is an error.", "",
    ]
    for case in sorted((c for c in cases if not c.get("error")), key=lambda c: c["metrics"]["edit_similarity"])[:10]:
        lines.extend([f"### {case['id']} — edit similarity {pct(case['metrics']['edit_similarity'])}", "",
                      "**Input**", "", case["input"], "", "**Reference**", "", case["reference"], "",
                      "**Model output**", "", case["output"], ""])
    lines.extend(["## Files and reproduction", "",
                  "- `results-old-cleanup-0.8b.json`: original inference evidence and model provenance.",
                  "- `old-cleanup-0.8b.jsonl`: all 100 scored records with prompts, inputs, references, outputs, tokens and metrics.",
                  "- `old-cleanup-0.8b.csv`: all 100 cases in the existing flat score schema.",
                  "- `old-cleanup-0.8b-manifest.json`: output hashes, corpus identity, coverage and finish reasons.",
                  "- `../logs/old-cleanup-0.8b.log`: the complete inference progress log.", "",
                  "`old-cleanup-0.8b-complete.zip` bundles these exports, the frozen corpus, combined scores, original baseline results, runtime log and reproduction scripts. Model weights are excluded.", "",
                  "From the repository root, after extracting the checkpoint into comparison/models/old-cleanup-0.8b:", "",
                  "```sh",
                  "comparison/.venv/bin/python comparison/benchmark/run_old_cleanup.py --archive /path/to/ft-6eba5e4b-6bba-2026-08-01-04-18-33.tar.zst",
                  "comparison/.venv/bin/python comparison/benchmark/score_results.py",
                  "comparison/.venv/bin/python comparison/benchmark/report_old_cleanup.py", "```", "",
                  "The inference runner refuses an existing result file to avoid accidental repeated attempts or overwritten evidence. "
                  "Use a separate copy of the project for a new run. Dependencies are the installed versions recorded in the raw result; "
                  "the existing requirements-fluid.txt pins the shared inference/scoring runtime.", ""])
    export_path(".md").write_text("\n".join(lines))
    outputs = [ARTIFACTS / f"results-{MODEL_ID}.json", *[export_path(s) for s in (".jsonl", ".csv", ".md")]]
    manifest = {
        "model_id": MODEL_ID, "corpus_sha256": model["sample_sha256"],
        "archive_sha256": provenance["archive_sha256"], "case_count": len(cases),
        "unique_case_count": len({c["id"] for c in cases}),
        "attempts": dict(Counter(str(c["attempt"]) for c in cases)),
        "finish_reasons": dict(Counter(c.get("finish_reason") for c in cases)),
        "summary": summary, "dataset_summaries": model["dataset_summaries"],
        "files_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs},
    }
    manifest_path = ARTIFACTS / f"{MODEL_ID}-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    for path in [*outputs, manifest_path]:
        shutil.copyfile(path, ROOT.parent / "public" / "downloads" / path.name)
    archive_path = ARTIFACTS / f"{MODEL_ID}-complete.zip"
    bundle = [*outputs, manifest_path, ARTIFACTS / "benchmark-corpus.jsonl",
              ARTIFACTS / "benchmark-results.json", ROOT / "logs" / f"{MODEL_ID}.log",
              *[ROOT / "benchmark" / name for name in (
                  "run_old_cleanup.py", "report_old_cleanup.py", "score_results.py",
                  "requirements-fluid.txt", "README.md",
              )],
              *[path for path in sorted(ARTIFACTS.glob("results-*.json")) if path not in outputs]]
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in bundle:
            archive.write(path, path.relative_to(ROOT.parent))
    shutil.copyfile(archive_path, ROOT.parent / "public" / "downloads" / archive_path.name)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
