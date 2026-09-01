import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const data = path.resolve(directory, '../data');
const sourcePath = path.join(data, 'cleanup-dataset.jsonl');
const seed = 20260831;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const normalized = value => value.toLocaleLowerCase('en').replace(/\s+/gu, ' ').trim();
const count = values => values.reduce((a, key) => (a[key] = (a[key] || 0) + 1, a), {});

function randomGenerator(initial) {
  let state = initial >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function dimensions(row) {
  const m = row.metadata;
  const words = row.messages.find(message => message.role === 'user').content.trim().split(/\s+/u).length;
  return [
    `category:${m.primary_category}`, `type:${m.record_type}`, `domain:${m.domain}`,
    `presentation:${m.asr_presentation}`, `length:${words < 30 ? '20–29' : words < 80 ? '30–79' : '80–200'}`,
    ...m.error_types.map(value => `error:${value}`),
    ...m.formatting_features.map(value => `format:${value}`),
  ];
}

function coverage(rows) {
  const result = {};
  for (const [key, value] of Object.entries(count(rows.flatMap(dimensions)))) {
    const at = key.indexOf(':');
    (result[key.slice(0, at)] ??= {})[key.slice(at + 1)] = value;
  }
  return result;
}

export function createSplit(raw, {validationBatches: fixedBatches} = {}) {
  const lines = raw.trimEnd().split(/\r?\n/u);
  const records = lines.map((line, index) => ({line, row: JSON.parse(line), index}));
  assert.equal(records.length, 5000, 'Expected the current 5,000-pair source');
  assert.equal(new Set(records.map(r => r.row.id)).size, records.length, 'Duplicate source IDs');
  const groups = new Map();
  for (const record of records) {
    const batch = record.row.metadata.generation_batch;
    assert.ok(batch, `${record.row.id}: missing batch provenance`);
    if (!groups.has(batch)) groups.set(batch, []);
    groups.get(batch).push(record);
  }
  const names = [...groups.keys()].sort();
  assert.equal(names.length, 50, 'Expected 50 original authoring batches');
  for (const group of groups.values()) assert.equal(group.length, 100, 'Expected 100 records per batch');
  const totals = count(records.flatMap(r => dimensions(r.row)));
  const keys = Object.keys(totals).sort();
  const matrix = names.map(name => {
    const tally = count(groups.get(name).flatMap(r => dimensions(r.row)));
    return keys.map(key => tally[key] || 0);
  });
  const score = selection => keys.reduce((sum, key, k) => {
    const actual = selection.reduce((n, index) => n + matrix[index][k], 0);
    // Require every observed marginal label in both splits; match its overall
    // prevalence approximately. Joint combinations are not hard quotas.
    const missing = actual === 0 || actual === totals[key];
    const target = totals[key] * 0.1;
    return sum + (missing ? 1e6 : 0) + (actual - target) ** 2 / Math.max(target, 1);
  }, 0);
  const random = randomGenerator(seed);
  if (fixedBatches) {
    assert.equal(fixedBatches.length, 5, 'Expected five frozen validation batches');
    assert.equal(new Set(fixedBatches).size, 5, 'Repeated frozen validation batch');
    assert.ok(fixedBatches.every(name => names.includes(name)), 'Frozen validation batch missing from source');
  }
  let best = fixedBatches?.map(name => names.indexOf(name)).sort((a, b) => a - b) ?? null;
  let bestScore = best ? score(best) : Infinity;
  for (let trial = 0; trial < (fixedBatches ? 0 : 10000); trial++) {
    const sample = new Set();
    while (sample.size < 5) sample.add(Math.floor(random() * names.length));
    const selected = [...sample].sort((a, b) => a - b), value = score(selected);
    if (value < bestScore) { best = selected; bestScore = value; }
  }
  for (let pass = 0; pass < (fixedBatches ? 0 : 10); pass++) {
    let next = best, nextScore = bestScore;
    for (let slot = 0; slot < 5; slot++) for (let candidate = 0; candidate < names.length; candidate++) {
      if (best.includes(candidate)) continue;
      const trial = best.map((value, index) => index === slot ? candidate : value).sort((a, b) => a - b);
      const value = score(trial);
      if (value < nextScore) { next = trial; nextScore = value; }
    }
    if (nextScore >= bestScore) break;
    best = next; bestScore = nextScore;
  }
  assert.ok(bestScore < 1e6, 'Could not cover every observed dimension in both splits');
  const validationBatches = best.map(index => names[index]);
  const selected = new Set(validationBatches);
  const training = records.filter(r => !selected.has(r.row.metadata.generation_batch));
  const validation = records.filter(r => selected.has(r.row.metadata.generation_batch));
  const shuffle = (items, initial) => {
    const rng = randomGenerator(initial), result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return {training: shuffle(training, seed + 1), validation: shuffle(validation, seed + 2), validationBatches};
}

function main() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const manifest = path.join(data, 'split-report.json');
  const frozen = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).validation_batches : undefined;
  const {training, validation, validationBatches} = createSplit(source, {validationBatches: frozen});
  assert.equal(training.length, 4500);
  assert.equal(validation.length, 500);
  const trainIds = new Set(training.map(r => r.row.id));
  assert.ok(validation.every(r => !trainIds.has(r.row.id)), 'ID overlap');
  for (const role of ['user', 'assistant']) {
    const trainText = new Set(training.map(r => normalized(r.row.messages.find(m => m.role === role).content)));
    assert.ok(validation.every(r => !trainText.has(normalized(r.row.messages.find(m => m.role === role).content))), `Normalized ${role} text overlap`);
  }
  const partitions = {training, validation};
  const files = {};
  for (const [name, entries] of Object.entries(partitions)) {
    const text = entries.map(r => r.line).join('\n') + '\n';
    const filename = `cleanup-${name}.jsonl`;
    fs.writeFileSync(path.join(data, filename), text);
    files[name] = {file: filename, records: entries.length, sha256: hash(text), coverage: coverage(entries.map(r => r.row))};
  }
  assert.equal(fs.readFileSync(sourcePath, 'utf8'), source, 'Combined source changed');
  const report = {
    source: 'cleanup-dataset.jsonl', source_sha256: hash(source), seed, ratio: '90/10',
    method: 'Whole-batch holdout selected by deterministic coverage balancing; seeded row shuffle within each file. Existing validation batch membership is frozen on subsequent runs.',
    validation_batches: validationBatches,
    training_batches: [...new Set(training.map(r => r.row.metadata.generation_batch))].sort(),
    checks: {source_unchanged: true, source_records_preserved_verbatim: true, id_overlap: 0, batch_overlap: 0, normalized_input_overlap: 0, normalized_output_overlap: 0, every_observed_marginal_label_in_both: true},
    limitations: ['Authoring batches are grouping proxies, not independently recorded sessions. Semantic template families across batches are not annotated.', 'Coverage applies to individual categories, types, errors, domains, presentation, formats and length bands, not every rare combination.', 'Existing generation and review metadata are preserved; splitting does not certify training quality. Unapproved paragraph reclassifications are not applied by this operation.'],
    ...files,
  };
  fs.writeFileSync(path.join(data, 'split-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({source_sha256: report.source_sha256, training: training.length, validation: validation.length, validation_batches: validationBatches, checks: report.checks, training_coverage: files.training.coverage, validation_coverage: files.validation.coverage}, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
