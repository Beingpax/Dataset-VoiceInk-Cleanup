import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createSplit} from './split.mjs';

const base = new URL('../data/', import.meta.url);
const source = fs.readFileSync(new URL('cleanup-dataset.jsonl', base), 'utf8');
const report = JSON.parse(fs.readFileSync(new URL('split-report.json', base), 'utf8'));
const read = name => fs.readFileSync(new URL(`cleanup-${name}.jsonl`, base), 'utf8').trimEnd().split('\n');

test('split files preserve every source record exactly once and the source hash', () => {
  const training = read('training'), validation = read('validation');
  assert.equal(training.length, 4500);
  assert.equal(validation.length, 500);
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), report.source_sha256);
  assert.deepEqual([...training, ...validation].sort(), source.trimEnd().split('\n').sort());
  assert.equal(new Set([...training, ...validation].map(line => JSON.parse(line).id)).size, 5000);
});

test('frozen batch membership and shuffled output are reproducible', () => {
  const result = createSplit(source, {validationBatches: report.validation_batches});
  assert.deepEqual(result.training.map(r => r.line), read('training'));
  assert.deepEqual(result.validation.map(r => r.line), read('validation'));
  const trainBatches = new Set(result.training.map(r => r.row.metadata.generation_batch));
  assert.ok(result.validation.every(r => !trainBatches.has(r.row.metadata.generation_batch)));
});

test('both files cover every observed label and contain no normalized transcript overlap', () => {
  const training = read('training').map(JSON.parse), validation = read('validation').map(JSON.parse);
  const labelKeys = ['primary_category', 'record_type', 'domain', 'asr_presentation', 'error_types', 'formatting_features'];
  for (const key of labelKeys) {
    const labels = rows => [...new Set(rows.flatMap(r => r.metadata[key]))].sort();
    assert.deepEqual(labels(training), labels(validation), key);
  }
  for (const role of ['user', 'assistant']) {
    const normalize = row => row.messages.find(m => m.role === role).content.toLocaleLowerCase('en').replace(/\s+/gu, ' ').trim();
    const seen = new Set(training.map(normalize));
    assert.ok(validation.every(row => !seen.has(normalize(row))));
  }
});
