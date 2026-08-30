#!/usr/bin/env python3
"""Select the reproducible validation sample and write benchmark inputs."""

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "validation.jsonl"
OUT_JSONL = ROOT / "artifacts" / "sample.jsonl"
OUT_JSON = ROOT / "site" / "data" / "sample.json"
ORIGINAL_SEED = 20260830
ADDITION_SEED = 20260831
ORIGINAL_COUNT = 20
ADDITION_COUNT = 30
LONG_POOL_FRACTION = 0.30


def main() -> None:
    rows = [json.loads(line) for line in SOURCE.read_text().splitlines() if line.strip()]
    original_rng = random.Random(ORIGINAL_SEED)
    original_indices = sorted(original_rng.sample(range(len(rows)), ORIGINAL_COUNT))
    remaining = [index for index in range(len(rows)) if index not in set(original_indices)]
    remaining.sort(key=lambda index: len(next(m["content"] for m in rows[index]["messages"] if m["role"] == "user")), reverse=True)
    long_pool_size = max(ADDITION_COUNT, round(len(remaining) * LONG_POOL_FRACTION))
    long_pool = remaining[:long_pool_size]
    addition_rng = random.Random(ADDITION_SEED)
    addition_indices = sorted(addition_rng.sample(long_pool, ADDITION_COUNT))
    indices = original_indices + addition_indices
    sample = []
    for ordinal, source_index in enumerate(indices, 1):
        messages = rows[source_index]["messages"]
        by_role = {message["role"]: message["content"] for message in messages}
        reference = by_role["assistant"]
        sample.append(
            {
                "id": f"V{ordinal:02d}",
                "source_index": source_index,
                "system": by_role["system"],
                "input": by_role["user"],
                "reference": reference,
                "selection_group": "original_random" if ordinal <= ORIGINAL_COUNT else "long_random_addition",
                "input_words": len(by_role["user"].split()),
                "input_characters": len(by_role["user"]),
            }
        )

    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSONL.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in sample))
    metadata = {
        "count": len(sample),
        "original_seed": ORIGINAL_SEED,
        "original_count": ORIGINAL_COUNT,
        "addition_seed": ADDITION_SEED,
        "addition_count": ADDITION_COUNT,
        "long_pool_fraction": LONG_POOL_FRACTION,
        "long_pool_size": long_pool_size,
        "original_indices": original_indices,
        "addition_indices": addition_indices,
    }
    OUT_JSON.write_text(json.dumps({**metadata, "cases": sample}, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
