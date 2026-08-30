# VoiceInk Cleanup Research

This repository contains two related but separate projects presented through a React application.

## React application

The primary website is now a React 19 application powered by Vite and React Router. It replaces the previous single long static page with dedicated routes:

- `#/` overview and project navigation.
- `#/benchmark` aggregate rankings and quality visualization.
- `#/cases` 100-case benchmark evidence browser.
- `#/viewer` full JSONL dataset review workspace.
- `#/generator` dataset-authoring rules.
- `#/methodology` reproduction details, limitations, and artifact downloads.

`HashRouter` keeps every route compatible with static hosting and GitHub Pages without server rewrite rules.

The JSONL viewer is implemented as the React page `src/pages/JsonlViewerPage.jsx`. It provides a prominent record number, searchable record list, metadata filters, previous/next navigation, and a large side-by-side Raw ASR Input versus Target Output comparison. The 100-case benchmark corpus is the default built-in source, and local generated JSONL can be selected without uploading it.

### Local development

```sh
npm install
npm run dev
```

The build command is documented in `package.json` but was not run during this migration.

## 1. Dataset comparison application

[`comparison/`](comparison/) contains the complete work from the **Benchmark 3 transcript models** task:

- A 100-case benchmark across two labeled 50-case datasets.
- VoiceInk Refine V1, SpeakoFlow Mini, and GPT-5.6 Sol low-reasoning outputs.
- Aggregate quality, latency, throughput, exact-match, WER, chrF++, edit-similarity, and peak-memory data where available.
- Every raw input, human reference, model output, prompt configuration, and per-case score.
- Reproducible sampling, model-running, dataset-integration, and scoring scripts.
- Complete JSON, JSONL, and CSV artifacts.
- The modular comparison website.
- An integrated JSONL dataset viewer implemented as a JavaScript application module, not a standalone viewer HTML file.

The earlier dependency-free comparison website remains under [`comparison/site/`](comparison/site/) as preserved benchmark-task source. The React application at the repository root is now the primary interface.

## 2. Dataset generator and authoring project

[`dataset-generator/`](dataset-generator/) contains the transcript-cleanup dataset work:

- The concise active authoring guide in `dataset-generator/README.md`.
- The `polished-clean-v1` cleanup contract.
- Dataset schema and category strategy.
- The approved 5,000-pair composition and generation rules.
- Product, design, and implementation summaries.
- The original dataset overview page, retained as a separate generator/authoring surface.

The previous 180-pair generator collection and its viewer copies have been removed. The **JSONL Dataset Viewer** defaults to the unchanged 100 labeled benchmark cases in `public/data/benchmark-sample.jsonl` and accepts future generated JSONL through its local file picker. Benchmark source snapshots and results remain intact.

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
    ├── site/index.html             # Dataset authoring overview
    ├── README.md                   # Active dataset authoring guide
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
