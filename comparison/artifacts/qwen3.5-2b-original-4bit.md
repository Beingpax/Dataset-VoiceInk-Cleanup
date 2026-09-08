# Qwen3.5 2B Original 4-bit benchmark

The published `mlx-community/Qwen3.5-2B-4bit` checkpoint was downloaded from
Hugging Face at revision `674aaa7240b91e8012fcad5d791b7dfe5ba90207`. It uses
affine 4-bit weights with group size 64 and originates from the post-trained
`Qwen/Qwen3.5-2B` model. “Original” distinguishes it from the cleanup fine-tune;
it is not the raw `Qwen/Qwen3.5-2B-Base` checkpoint.

## Fixed 100-case result

| Metric | Result |
|---|---:|
| Successful cases | 99/100 |
| Exact matches | 7/100 |
| Mean edit similarity | 86.37% |
| Mean chrF++ | 77.80% |
| Mean WER (lower is better) | 41.53% |
| Mean latency | 0.709 s |
| Median throughput | 41.3 tok/s |
| Peak process RSS | 1.104 GiB |

Case C47 reached the unchanged 97-token generation limit. Its partial output is
preserved and excluded from the conditional string-metric means. Because the run
is incomplete, fairness-v1 does not assign it a rank or chart point.

The original upstream model performs substantially below the cleanup-tuned
Qwen3.5 2B 4-bit configuration, which completed all cases with 24 exact matches,
95.23% mean edit similarity, 88.88% chrF++, and 18.88% WER.
