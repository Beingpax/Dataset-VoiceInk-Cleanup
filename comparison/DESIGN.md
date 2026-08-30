# Design System

## Direction

An editorial research folio viewed on a well-lit desk: crisp white paper, ink-heavy typography, cool cyan annotation marks, and precise tabular evidence. The site combines a magazine-like opening with a restrained analysis tool beneath it.

## Color

Use OKLCH tokens exclusively.

- Background: `oklch(1 0 0)`
- Surface: `oklch(0.965 0.006 200)`
- Ink: `oklch(0.18 0.018 220)`
- Muted ink: `oklch(0.43 0.025 220)`
- Primary cyan: `oklch(0.68 0.12 200)`
- Deep cyan: `oklch(0.38 0.09 205)`
- Accent coral: `oklch(0.63 0.17 32)`
- Positive: `oklch(0.55 0.13 150)`
- Caution: `oklch(0.70 0.15 78)`

Color is restrained. Cyan denotes selected data and benchmark identity; coral calls out limitations and deltas. Neutral surfaces carry most of the page.

## Typography

Use a single reliable UI sans stack for controls and tables, with Georgia as an editorial display face for the opening and section titles. Monospace is reserved for transcripts, prompts, configuration, and numeric details. Body copy is capped near 70 characters.

## Layout

Use a wide reading canvas with a strong editorial masthead, asymmetric summary composition, a comparison table, a two-axis quality plot, and an evidence browser. Avoid a wall of equal cards. On narrow screens, tables become horizontally scrollable and the evidence browser becomes a single column.

## Components

- Masthead with benchmark title, date, sample size, seed, and hardware.
- Ranking table with exact score definitions and sortable columns.
- Quality scatterplot for similarity versus content preservation.
- Model dossiers exposing prompt, runtime, quantization, and limitations.
- Case browser with model filter, quality filter, transcript/reference/output panes, and per-case metrics.
- Methodology and reproducibility section linking downloadable artifacts.

## Motion

Use short 150–220 ms state transitions for filters, disclosure, and chart focus. No orchestrated page-load animation. Respect reduced-motion preferences in CSS.
