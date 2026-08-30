import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalRecords} from './assemble.mjs';
import {config, directory, root, hash, readJsonl, validateBatch} from './validate.mjs';

// A reviewable snapshot is separate from the gated, accepted final collection.
export function draftSnapshot() {
  const rows = [], reviewedIds = new Set(), failures = [];
  let batchPassed = 0;
  for (let number = 1; number <= config.batch_count; number++) {
    const batch = `batch-${String(number).padStart(3, '0')}`;
    const {raw, rows: items} = readJsonl(path.join(directory, 'batches', `${batch}.jsonl`));
    const result = validateBatch(items, number);
    if (!result.failures.length) batchPassed += items.length;
    failures.push(...result.failures);
    rows.push(...items);
    const reviewPath = path.join(directory, 'reviews', `${batch}.json`);
    if (!fs.existsSync(reviewPath)) continue;
    const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
    if (review.sha256 !== hash(raw) || review.reviewer !== 'foreground' || review.status !== 'accepted') continue;
    const ids = items.map(row => row.id);
    if (JSON.stringify(review.accepted_ids) !== JSON.stringify(ids)) continue;
    ids.forEach(id => reviewedIds.add(id));
  }
  if (rows.length !== config.target_pairs) failures.push(`Expected ${config.target_pairs} records, received ${rows.length}`);
  if (failures.length) throw new Error(`Draft snapshot not written: ${failures.join('; ')}`);
  return {
    records: canonicalRecords(rows, {reviewedIds}),
    status: {
      collection_status: 'draft',
      target: config.target_pairs,
      generated: rows.length,
      batch_checks_passed: batchPassed,
      foreground_reviewed: reviewedIds.size,
      awaiting_foreground_review: rows.length - reviewedIds.size,
      human_reviewed: false,
      note: 'Review snapshot only. Cross-batch corrections and full semantic review may still be in progress. Batch checks do not certify naturalness or faithfulness.',
    },
  };
}

function main() {
  const {records, status} = draftSnapshot();
  const jsonl = records.map(record => JSON.stringify(record)).join('\n') + '\n';
  const targets = ['dataset-generator/data/cleanup-dataset.jsonl', 'public/data/cleanup-dataset.jsonl'];
  for (const target of targets) {
    const file = path.join(root, target);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, jsonl);
  }
  const report = {...status, dataset_sha256: hash(jsonl), outputs: targets};
  fs.writeFileSync(path.join(directory, 'draft-status.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
