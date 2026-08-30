<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->
---
name: Transcript Dataset Reader
description: A quiet private workspace for reviewing transcript-cleanup JSONL pairs.
---

# Design System: Transcript Dataset Reader

## 1. Overview

**Creative North Star: "The Editor's Proof Table"**

The interface should feel like reviewing a carefully typeset proof: white space is useful, hierarchy is quiet, and the text under review is always more prominent than the interface around it. Controls are familiar and compact, with no decorative choreography.

It explicitly rejects dashboard-heavy analytics, decorative gradients, excessive cards, gratuitous animation, neon AI styling, and raw developer-tool density. Dataset statistics provide orientation, but never compete with the source-to-output comparison.

**Key Characteristics:**

- Reading-first comparison
- Restrained olive accent
- Flat tonal layering
- Compact, familiar controls
- Responsive without hiding essential actions

## 2. Colors

Use pure neutral surfaces with one restrained olive primary derived from the palette seed; reserve color for selection, focus, and meaningful status.

**The Ten Percent Rule.** Accent color must occupy no more than ten percent of the screen; its rarity preserves hierarchy.

## 3. Typography

Use one warm humanist system-sans family for the interface and transcript body, with the native monospace stack reserved for identifiers and raw JSON.

**The Reading Voice Rule.** Transcript content receives the longest line height and strongest contrast; metadata is smaller but never faint.

## 4. Elevation

Flat by default. Depth is conveyed through neutral surface changes and restrained dividers; shadows appear only on temporary overlays if one is required.

**The Proof Table Rule.** If the interface looks like a stack of floating cards, flatten it.

## 5. Components

Buttons, fields, segmented controls, filter chips, record rows, comparison panes, and summary bars use standard browser affordances with consistent geometry. Every interactive control must have visible hover, focus, active, disabled, and error states. Selection uses both an olive state and a textual or structural cue.

## 6. Do's and Don'ts

### Do:

- **Do** make the raw ASR and polished output readable before exposing metadata.
- **Do** preserve keyboard navigation, visible focus, and color-independent labels.
- **Do** use restrained spacing and thin dividers to organize dense information.

### Don't:

- **Don't** use dashboard-heavy analytics, decorative gradients, or excessive cards.
- **Don't** use gratuitous animation, neon AI styling, or developer-tool density.
- **Don't** force raw JSON to be the primary representation of a record.
