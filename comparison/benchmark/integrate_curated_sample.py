#!/usr/bin/env python3
"""Append the external curated 50-pair sample to the validation benchmark."""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTERNAL = ROOT.parent / "dataset-generator" / "data" / "sample-50.jsonl"
ARCHIVED_SOURCE = ROOT / "artifacts" / "curated-sample-50.source.jsonl"
SAMPLE_PATH = ROOT / "artifacts" / "sample.jsonl"
SITE_SAMPLE = ROOT / "site" / "data" / "sample.json"


def by_role(messages: list[dict]) -> dict[str, str]:
    return {message["role"]: message["content"] for message in messages}


def main() -> None:
    existing = [json.loads(line) for line in SAMPLE_PATH.read_text().splitlines() if line.strip()]
    validation = [row for row in existing if row.get("dataset_id", "voiceink-validation") == "voiceink-validation"]
    if len(validation) != 50:
        raise ValueError(f"Expected 50 validation cases before integration, found {len(validation)}")

    source_rows = [json.loads(line) for line in EXTERNAL.read_text().splitlines() if line.strip()]
    if len(source_rows) != 50:
        raise ValueError(f"Expected 50 curated cases, found {len(source_rows)}")
    shutil.copyfile(EXTERNAL, ARCHIVED_SOURCE)

    for row in validation:
        row["dataset_id"] = "voiceink-validation"
        row["dataset_name"] = "VoiceInk validation sample"
        row.setdefault("source_record_id", str(row["source_index"]))

    curated = []
    for ordinal, row in enumerate(source_rows, 1):
        messages = by_role(row["messages"])
        reference = messages["assistant"]
        metadata = row.get("metadata", {})
        email_markers = ("dear ", "hi ", "hello ", "hey ")
        curated.append({
            "id": f"C{ordinal:02d}",
            "dataset_id": "curated-sample-50",
            "dataset_name": "Curated transcript cleanup sample",
            "source_record_id": row["id"],
            "source_index": None,
            "system": messages["system"],
            "input": messages["user"],
            "reference": reference,
            "s1_context": "email" if "\n\n" in reference and reference.lower().startswith(email_markers) else "general",
            "selection_group": "curated_external_pair",
            "input_words": len(messages["user"].split()),
            "input_characters": len(messages["user"]),
            "metadata": metadata,
        })

    combined = validation + curated
    SAMPLE_PATH.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in combined))
    SITE_SAMPLE.write_text(json.dumps({
        "count": len(combined),
        "datasets": [
            {"id": "voiceink-validation", "name": "VoiceInk validation sample", "count": 50},
            {"id": "curated-sample-50", "name": "Curated transcript cleanup sample", "count": 50},
        ],
        "cases": combined,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"total": len(combined), "validation": len(validation), "curated": len(curated)}, indent=2))


if __name__ == "__main__":
    main()
