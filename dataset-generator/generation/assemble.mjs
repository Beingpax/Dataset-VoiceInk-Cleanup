import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {config, directory, root, hash, normalized, readJsonl, validateBatch, words} from './validate.mjs';

function counts(rows, key) {
  return rows.reduce((result, row) => {result[row[key]] = (result[row[key]] || 0) + 1; return result;}, {});
}

export function findDuplicates(rows, benchmarkInputs = new Set()) {
  const problems = [];
  const inputs = new Map(), outputs = new Map();
  for (const row of rows) {
    const input = normalized(row.input), output = normalized(row.output);
    if (inputs.has(input)) problems.push(`${row.id}: duplicate input of ${inputs.get(input)}`);
    if (outputs.has(output)) problems.push(`${row.id}: duplicate target of ${outputs.get(output)}`);
    if (benchmarkInputs.has(input)) problems.push(`${row.id}: input overlaps preserved benchmark`);
    inputs.set(input, row.id); outputs.set(output, row.id);
  }
  return problems;
}

export function nearDuplicates(rows) {
  const grams = value => {
    const tokens = normalized(value).split(' ');
    return new Set(tokens.slice(0, -2).map((_, i) => tokens.slice(i, i + 3).join(' ')));
  };
  const sets = rows.map(row => grams(row.input));
  const index = new Map();
  sets.forEach((set, i) => set.forEach(gram => {
    const indices = index.get(gram) || [];
    indices.push(i); index.set(gram, indices);
  }));
  const candidates = new Set();
  for (const indices of index.values()) {
    if (indices.length > 30) continue;
    for (let a = 0; a < indices.length; a++) for (let b = a + 1; b < indices.length; b++) candidates.add(`${indices[a]}:${indices[b]}`);
  }
  const matches = [];
  for (const candidate of candidates) {
    const [a,b] = candidate.split(':').map(Number);
    const common = [...sets[a]].filter(gram => sets[b].has(gram)).length;
    const similarity = common / (sets[a].size + sets[b].size - common);
    if (similarity >= 0.8) matches.push({ids:[rows[a].id,rows[b].id], trigram_jaccard:Number(similarity.toFixed(3))});
  }
  return matches;
}

export function audit() {
  const failures = [], rows = [], batchReviews = [], batches = [];
  const benchmark = {};
  for (const [relative, expected] of Object.entries(config.benchmark_sha256)) {
    const actual = hash(fs.readFileSync(path.join(root, relative)));
    benchmark[relative] = {sha256:actual, unchanged:actual === expected};
    if (actual !== expected) failures.push(`Benchmark changed: ${relative}`);
  }
  for (let number = 1; number <= config.batch_count; number++) {
    const batch = `batch-${String(number).padStart(3, '0')}`;
    const file = path.join(directory, 'batches', `${batch}.jsonl`);
    if (!fs.existsSync(file)) {failures.push(`Missing ${batch}`); continue;}
    const {raw, rows:items} = readJsonl(file);
    const result = validateBatch(items, number);
    failures.push(...result.failures);
    const digest = hash(raw);
    batches.push({batch, records:items.length, sha256:digest, mechanical_failures:result.failures.length});
    rows.push(...items);
    const reviewFile = path.join(directory, 'reviews', `${batch}.json`);
    if (!fs.existsSync(reviewFile)) {failures.push(`Missing foreground review: ${batch}`); continue;}
    const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
    const ids = items.map(row => row.id);
    if (review.sha256 !== digest) failures.push(`Stale foreground review: ${batch}`);
    if (review.reviewer !== 'foreground' || review.status !== 'accepted') failures.push(`Unaccepted review: ${batch}`);
    if (JSON.stringify(review.accepted_ids) !== JSON.stringify(ids)) failures.push(`Review does not cover all ordered IDs: ${batch}`);
    if (!Array.isArray(review.checks) || !['naturalness', 'faithfulness', 'local_corrections', 'formatting', 'entities', 'metadata'].every(check => review.checks.includes(check))) failures.push(`Incomplete review scope: ${batch}`);
    batchReviews.push(review);
  }
  if (rows.length !== config.target_pairs) failures.push(`Total ${rows.length}, expected ${config.target_pairs}`);
  for (const [key, expected] of [['category', config.categories], ['type', config.record_types]]) {
    const actual = counts(rows,key);
    for (const label of new Set([...Object.keys(expected),...Object.keys(actual)])) if ((actual[label] || 0) !== (expected[label] || 0)) failures.push(`Global ${key} ${label}: ${actual[label] || 0}, expected ${expected[label] || 0}`);
  }
  const benchmarkRows = readJsonl(path.join(root, 'public/data/benchmark-sample.jsonl')).rows;
  const benchmarkInputs = new Set(benchmarkRows.map(row => normalized(row.input ?? row.messages?.find(message => message.role === 'user')?.content ?? '')));
  failures.push(...findDuplicates(rows, benchmarkInputs));
  const near = nearDuplicates(rows);
  if (near.length) failures.push(`${near.length} near-duplicate input pairs require reauthoring`);
  return {failures, rows, report:{target_pairs:config.target_pairs, records:rows.length, accepted_batches:batchReviews.filter(review=>review.status==='accepted').length, batches, categories:counts(rows,'category'), record_types:counts(rows,'type'), domains:counts(rows,'domain'), asr_presentation:counts(rows,'presentation'), lengths:{minimum:rows.length?Math.min(...rows.map(row=>words(row.input).length)):null, maximum:rows.length?Math.max(...rows.map(row=>words(row.input).length)):null, extended:rows.filter(row=>words(row.input).length>=80).length}, near_duplicates:near, benchmark, review_method:'Every pair reviewed by the foreground AI agent; content-hash-bound batch acceptance. Not human review or a guarantee of error-free data.'}};
}

export function canonicalRecords(rows) {
  const readme = fs.readFileSync(path.join(directory, '../README.md'), 'utf8');
  const system = readme.match(/```text\n([\s\S]*?)\n```/u)?.[1];
  if (!system?.startsWith('You are a transcript cleanup editor.')) throw new Error('Canonical README system instruction not found');
  return rows.map(row => ({
    id:row.id,
    messages:[{role:'system',content:system},{role:'user',content:row.input},{role:'assistant',content:row.output}],
    metadata:{language:'en',record_type:row.type,primary_category:row.category,error_types:row.errors,formatting_features:row.features,edit_support:'direct',source:'synthetic_generated',policy_version:config.policy_version,domain:row.domain,scenario:row.scenario,asr_presentation:row.presentation,generation_batch:`batch-${String(Math.ceil(Number(row.id.slice(7))/100)).padStart(3,'0')}`,generation_model:config.model,prompt_revision:config.prompt_revision,review_status:'ai_foreground_reviewed',human_reviewed:false},
  }));
}

function main() {
  const result = audit();
  console.log(JSON.stringify({...result.report,failures:result.failures},null,2));
  if (result.failures.length) {process.exitCode=1;return;}
  if (!process.argv.includes('--write')) return;
  const records = canonicalRecords(result.rows);
  const jsonl = records.map(row=>JSON.stringify(row)).join('\n')+'\n';
  const targets = ['dataset-generator/data/generated-5000.jsonl','public/data/generated-5000.jsonl'];
  for (const target of targets) fs.writeFileSync(path.join(root,target),jsonl);
  const report = {...result.report,passed:true,dataset_sha256:hash(jsonl),outputs:targets};
  fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Wrote ${records.length} reviewed pairs to both synchronized dataset files.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
