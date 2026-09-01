#!/usr/bin/env python3
"""Publish the 2B 4-bit run's full case evidence and concise report."""

import csv
import json
import shutil
import zipfile

from run_old_cleanup import ROOT, sha256

MODEL_ID = "cleanup-2b-4bit"


def main():
    artifacts = ROOT / "artifacts"
    payload = json.loads((artifacts / "benchmark-results.json").read_text())
    model = next(m for m in payload["models"] if m["id"] == MODEL_ID)
    assert model["status"] == "completed" and len(model["cases"]) == 100
    assert len({c["id"] for c in model["cases"]}) == 100
    conversion = model["provenance"]["conversion"]
    s = model["summary"]
    paths = [artifacts / f"{MODEL_ID}{suffix}" for suffix in (".jsonl", ".csv", ".md")]
    paths[0].write_text("".join(json.dumps(c, ensure_ascii=False) + "\n" for c in model["cases"]))
    with (artifacts / "case-results.csv").open(newline="") as source, paths[1].open("w", newline="") as out:
        reader = csv.DictReader(source)
        writer = csv.DictWriter(out, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(row for row in reader if row["model_id"] == MODEL_ID)
    lines = ["# Cleanup Qwen3.5 2B — text-only MLX 4-bit", "",
             f"Completed {model['completed_at']}. All 100 cases attempted once; no retries or output post-processing.", "",
             "| Measurement | Result |", "| --- | ---: |",
             f"| Completed normally | {s['successful_cases']}/100 |",
             f"| Failed/token-limited | {s['failed_cases']}/100 |",
             f"| Exact reference matches | {s['exact_matches']}/100 |",
             f"| Mean edit similarity | {s['mean_edit_similarity']:.2%} |",
             f"| Mean chrF++ | {s['mean_chrf']:.2%} |",
             f"| Mean word error rate (lower is better) | {s['mean_wer']:.2%} |",
             f"| Mean latency | {s['mean_generation_seconds']:.3f} s |",
             f"| Median throughput | {s['median_tokens_per_second']:.1f} tokens/s |",
             f"| Peak process RSS | {s['peak_memory_gib']:.3f} GiB |", "",
             "Completion is not correctness. String similarity is not a semantic accuracy percentage. "
             "Means are conditional on successful cases; exact-match and completion totals include all 100.", "",
             "## Conversion", "",
             "Used the installed official `mlx_lm.convert.convert` with affine quantization, 4 bits and group size 64. "
             "Its native Qwen3.5 sanitizer omitted vision and auxiliary MTP tensors. No calibration, retraining, "
             "activation quantization or KV-cache quantization was performed. Nonquantized parameters retain "
             "the converter's BF16/FP32 handling, including protected A_log tensors.", "",
             f"Text parameter count: {conversion['source_parameters']['text']:,}. "
             f"Text tensor storage: {conversion['source_tensor_bytes']['text'] / 1e9:.3f} GB before quantization; "
             f"{conversion['quantized_text_tensor_bytes'] / 1e9:.3f} GB after. "
             f"Vision omitted: {conversion['source_tensor_bytes']['vision'] / 1e6:.1f} MB; "
             f"MTP omitted: {conversion['source_tensor_bytes']['mtp'] / 1e6:.1f} MB. "
             "Sizes use decimal units. Packed 4-bit weights also require scales/biases and floating tensors.", "",
             conversion["validation"], "", conversion["scope"], "",
             "Official implementation references:", "",
             *[f"- {url}" for url in conversion["official_sources"]], "",
             "## Benchmark protocol and limitations", "",
             "The existing frozen corpus, stored system instructions, greedy decoding, thinking disabled, "
             "seed 0, input-length token budget, no warmup and no cross-case cache match the earlier cleanup runs. "
             "References and error labels are never supplied to inference. Latency covers prompt processing "
             "and generation, including first-case cold start; it excludes loading, tokenization and evidence writes. "
             "Throughput uses retokenized output counts to match the existing benchmark convention.", "",
             "No full-precision 2B benchmark was run. Consequently these results do not measure the quality loss "
             "caused by quantization alone. Differences from 0.8B include the base model, training and quantization. "
             "The user identifies the same training data; exact archive training provenance and overlap remain unverified. "
             "Timing reflects one local session, not repeated controlled trials.", "",
             "## Dataset breakdown", ""]
    for dataset, summary in model["dataset_summaries"].items():
        lines.append(f"- {dataset}: {summary['successful_cases']}/{summary['case_count']} completed; "
                     f"{summary['exact_matches']} exact; edit similarity {summary['mean_edit_similarity']:.2%}.")
    lines += ["", "## Files", "", f"Model directory: `comparison/models/{MODEL_ID}/` (ignored by Git).",
              f"Source archive: `{conversion['source_archive']}`; original untouched.",
              f"Source SHA-256: `{conversion['source_archive_sha256']}`.",
              f"Frozen corpus SHA-256: `{model['sample_sha256']}`.", "",
              "The JSONL/CSV exports contain all 100 inputs, references, raw outputs and scores. "
              "The evidence ZIP includes the raw run, conversion manifest, frozen corpus, logs and reproduction scripts; "
              "it excludes model weights. Dashboard and aggregate downloads include this new configuration alongside unchanged baselines.", ""]
    paths[2].write_text("\n".join(lines))
    evidence = paths + [artifacts / f"results-{MODEL_ID}.json", artifacts / f"{MODEL_ID}-conversion.json",
                        artifacts / "benchmark-corpus.jsonl", ROOT / "logs" / f"{MODEL_ID}.log",
                        ROOT / "logs" / f"{MODEL_ID}-conversion.log"]
    evidence += [ROOT / "benchmark" / name for name in ("quantize_cleanup_2b.py", "run_cleanup_2b_4bit.py", "run_old_cleanup.py", "score_results.py", "report_cleanup_2b.py")]
    package = artifacts / f"{MODEL_ID}-evidence.zip"
    with zipfile.ZipFile(package, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in evidence:
            archive.write(path, path.relative_to(ROOT))
    downloads = ROOT.parent / "public/downloads"
    for path in paths + [package, artifacts / f"results-{MODEL_ID}.json", artifacts / f"{MODEL_ID}-conversion.json"]:
        shutil.copyfile(path, downloads / path.name)
    print(json.dumps(s, indent=2))


if __name__ == "__main__":
    main()
