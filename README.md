# VoiceInk Cleanup Research

This repository contains two related but separate projects:

## 1. Dataset comparison application

[`comparison/`](comparison/) contains the complete work from the **Benchmark 3 transcript models** task:

- A 100-case benchmark across two labeled 50-case datasets.
- VoiceInk Refine V1, SpeakoFlow Mini, S1-mini, and GPT-5.6 Sol low-reasoning outputs.
- Aggregate quality, latency, throughput, exact-match, WER, chrF++, edit-similarity, and peak-memory data where available.
- Every raw input, human reference, model output, prompt configuration, and per-case score.
- Reproducible sampling, model-running, dataset-integration, and scoring scripts.
- Complete JSON, JSONL, and CSV artifacts.
- The modular comparison website.
- An integrated JSONL dataset viewer implemented as a JavaScript application module, not a standalone viewer HTML file.

The repository root opens the comparison website at [`comparison/site/index.html`](comparison/site/index.html).

## 2. Dataset generator and authoring project

[`dataset-generator/`](dataset-generator/) contains the transcript-cleanup dataset work:

- The full research-backed authoring and fine-tuning plan.
- The `polished-clean-v1` cleanup contract.
- Dataset schema and category strategy.
- The 50-example curated JSONL demonstration.
- Product, design, and implementation summaries.
- The original dataset overview page, retained as a separate generator/authoring surface.

Generated JSONL can be opened from the comparison website's **JSONL Dataset Viewer**. The viewer includes the curated generator sample as a built-in source and also accepts local JSONL files through its file picker.

## Repository structure

```text
.
├── index.html                      # Opens the main comparison application
├── comparison/
│   ├── site/                       # Modular benchmark and JSONL viewer website
│   ├── benchmark/                  # Sampling, inference, integration, and scoring scripts
│   ├── artifacts/                  # Complete benchmark outputs and exports
│   ├── training.jsonl              # Original training split
│   ├── validation.jsonl            # Original validation split
│   ├── logs/                       # Preserved local benchmark runtime log
│   ├── PRODUCT.md
│   └── DESIGN.md
└── dataset-generator/
    ├── data/sample-50.jsonl        # Curated generator demonstration
    ├── site/index.html             # Dataset authoring overview
    ├── README.md                   # Full dataset plan
    ├── PROJECT_SUMMARY.md
    ├── PRODUCT.md
    └── DESIGN.md
```

## Models are excluded

Downloaded models, model weights, caches, checkpoints, virtual environments, and packaged runtimes are intentionally excluded from Git. The benchmark scripts retain their expected local model paths so the benchmark can be reproduced after models are supplied locally.

## Viewing the website

The website uses browser modules and fetches local data files, so serve the repository with any static HTTP server and open the repository root. No package installation or build step is required.

## Benchmark scope

The comparison is an inspectable fixed-sample experiment, not a claim of universal model superiority. The two 50-case sources remain separately labeled because they were constructed differently. Provider-side latency, throughput, and peak memory are unavailable for the hosted GPT baseline and remain explicitly marked unavailable.
