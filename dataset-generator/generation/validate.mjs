import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const directory = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(directory, '../..');
export const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const words = value => typeof value === 'string' ? value.trim().split(/\s+/u).filter(Boolean) : [];
export const normalized = value => String(value).normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const errors = new Set(['filler', 'repetition', 'stutter', 'false_start', 'self_correction', 'punctuation', 'capitalization', 'dictated_formatting', 'paragraph_formatting', 'list_formatting', 'greeting_signoff', 'asr_substitution', 'spelling', 'name_or_entity', 'technical_term', 'acronym', 'number_normalization', 'date_normalization', 'time_normalization', 'currency_or_measurement', 'address_formatting', 'email_formatting', 'quotation_formatting']);
const categoryErrors = {
  filler_words: ['filler'], repetition_stutters: ['repetition', 'stutter'],
  false_starts_self_corrections: ['false_start', 'self_correction'],
  punctuation_capitalization_dictated_formatting: ['punctuation', 'capitalization', 'dictated_formatting', 'paragraph_formatting'],
  list_formatting: ['list_formatting'], email_formatting: ['greeting_signoff'],
  entity_normalization: ['name_or_entity', 'technical_term', 'acronym', 'number_normalization', 'date_normalization', 'time_normalization', 'currency_or_measurement', 'address_formatting', 'email_formatting', 'asr_substitution', 'spelling'],
  context_inferred_quotation: ['quotation_formatting'], no_change: [],
};
const featureNames = new Set(['paragraphs', 'ordered_list', 'unordered_list', 'email_layout', 'quotation']);
const fields = ['id', 'input', 'output', 'category', 'type', 'errors', 'features', 'domain', 'scenario', 'presentation'];
const tally = (rows, key) => rows.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] || 0) + 1; return acc; }, {});

export function expectedBatch(batch) {
  return {filler_words: 15, repetition_stutters: 15, false_starts_self_corrections: 10, punctuation_capitalization_dictated_formatting: 15, list_formatting: 10, email_formatting: batch % 2 ? 13 : 12, entity_normalization: batch % 2 ? 12 : 13, context_inferred_quotation: 5, no_change: 5};
}

export function readJsonl(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const rows = raw.split(/\r?\n/u).filter(line => line.trim()).map((line, i) => {
    try { return JSON.parse(line); } catch (error) { throw new Error(`${file}:${i + 1}: ${error.message}`); }
  });
  return {raw, rows};
}

export function validateRecord(row) {
  const failures = [];
  const fail = message => failures.push(`${row?.id || 'unknown'}: ${message}`);
  if (!row || typeof row !== 'object' || Array.isArray(row)) return ['Record must be an object'];
  if (Object.keys(row).sort().join('|') !== [...fields].sort().join('|')) fail('unexpected or missing compact fields');
  for (const key of fields.filter(key => !['errors', 'features'].includes(key))) if (typeof row[key] !== 'string' || !row[key].trim()) fail(`${key} must be nonempty text`);
  if (fields.filter(key => !['errors', 'features'].includes(key)).some(key => typeof row[key] !== 'string')) return failures;
  if (!/^sample_\d{4}$/u.test(row.id)) fail('invalid ID');
  const length = words(row.input).length;
  if (length < config.input_words.min || length > config.input_words.max) fail(`input has ${length} words, expected 20–200`);
  if (!(row.category in config.categories)) fail('unknown category');
  if (!(row.type in config.record_types)) fail('unknown record type');
  if (!['general', 'technical', 'medical', 'legal', 'financial'].includes(row.domain)) fail('unknown domain');
  if (!['correct', 'partial', 'absent'].includes(row.presentation)) fail('unknown ASR presentation');
  for (const [key, allowed] of [['errors', errors], ['features', featureNames]]) {
    if (!Array.isArray(row[key]) || row[key].some(item => !allowed.has(item))) fail(`invalid ${key}`);
    else if (new Set(row[key]).size !== row[key].length) fail(`duplicate ${key}`);
  }
  if (!Array.isArray(row.errors) || !Array.isArray(row.features)) return failures;
  if (row.type === 'no_change' || row.category === 'no_change') {
    if (row.type !== 'no_change' || row.category !== 'no_change') fail('no-change category/type mismatch');
    if (row.input !== row.output) fail('no-change target differs');
    if (row.errors.length) fail('no-change record has error labels');
  } else {
    if (row.input === row.output) fail('changed record is unchanged');
    if (!categoryErrors[row.category]?.some(error => row.errors.includes(error))) fail('missing primary-category error');
    if (row.type === 'natural_multi_error' && row.errors.length < 2) fail('multi-error record needs at least two actual error labels');
  }
  if (row.errors.includes('paragraph_formatting') && !row.output.includes('\n\n')) fail('paragraph label without target paragraph break');
  if (row.features.includes('paragraphs') && !row.output.includes('\n\n')) fail('paragraph feature without paragraphs');
  if (row.features.includes('ordered_list') && !/^\d+[.)] /mu.test(row.output)) fail('ordered-list feature without list');
  if (row.features.includes('unordered_list') && !/^[-*] /mu.test(row.output)) fail('unordered-list feature without list');
  if (row.category === 'context_inferred_quotation' && !/["“”]/u.test(row.output)) fail('quotation category without double quotes');
  return failures;
}

function checkCounts(actual, expected, label, failures) {
  for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) if ((actual[key] || 0) !== (expected[key] || 0)) failures.push(`${label}: ${key} = ${actual[key] || 0}, expected ${expected[key] || 0}`);
}

export function validateBatch(rows, batch) {
  const failures = rows.flatMap(validateRecord);
  if (rows.length !== 100) failures.push(`batch ${batch}: ${rows.length} records, expected 100`);
  const start = (batch - 1) * 100 + 1;
  rows.forEach((row, i) => { if (row.id !== `sample_${String(start + i).padStart(4, '0')}`) failures.push(`batch ${batch}: unexpected ID/order at row ${i + 1}`); });
  checkCounts(tally(rows, 'category'), expectedBatch(batch), `batch ${batch} categories`, failures);
  checkCounts(tally(rows, 'type'), {single_principal_error: 10, natural_multi_error: 85, no_change: 5}, `batch ${batch} types`, failures);
  const single = {filler_words: 2, repetition_stutters: 2, false_starts_self_corrections: 1, punctuation_capitalization_dictated_formatting: 1, list_formatting: 1, email_formatting: 1, entity_normalization: 1, context_inferred_quotation: 1};
  checkCounts(tally(rows.filter(row => row.type === 'single_principal_error'), 'category'), single, `batch ${batch} single-error categories`, failures);
  const extended = rows.filter(row => words(row.input).length >= 80).length;
  const medium = rows.filter(row => words(row.input).length >= 30 && words(row.input).length < 80).length;
  if (extended < 10) failures.push(`batch ${batch}: ${extended} extended inputs, expected >=10`);
  if (medium < 40) failures.push(`batch ${batch}: ${medium} medium inputs, expected >=40`);
  const correct = rows.filter(row => row.type !== 'no_change' && row.presentation === 'correct').length;
  if (correct < 20) failures.push(`batch ${batch}: ${correct} changed inputs with correct presentation, expected >=20`);
  for (const [category, count] of Object.entries(expectedBatch(batch))) if (category !== 'no_change' && rows.filter(row => row.category === category && words(row.input).length >= 30).length < Math.ceil(count * 0.2)) failures.push(`batch ${batch}: too few 30+ word inputs in ${category}`);
  const seen = new Map();
  for (const row of rows) {
    const key = normalized(row.input);
    if (seen.has(key)) failures.push(`${row.id}: duplicate normalized input of ${seen.get(key)}`);
    seen.set(key, row.id);
  }
  return {failures, counts: {records: rows.length, categories: tally(rows, 'category'), types: tally(rows, 'type'), domains: tally(rows, 'domain'), presentations: tally(rows, 'presentation'), extended, medium}};
}

export function reviewFlags(rows) {
  return rows.flatMap(row => {
    const input = normalized(row.input).split(' '), output = normalized(row.output).split(' ');
    const flags = [];
    if (output.length / input.length < 0.65) flags.push('large token reduction');
    if (output.length / input.length > 1.2) flags.push('large token expansion');
    const source = new Set(input);
    const added = output.filter(word => !source.has(word));
    if (added.length >= 6) flags.push(`check introduced tokens: ${added.join(' ')}`);
    if (/let me start (again|over)|forget (all|everything)|scratch (all|everything)/iu.test(row.input)) flags.push('possible broad retraction');
    return flags.length ? [{id: row.id, flags}] : [];
  });
}

function main() {
  const args = process.argv.slice(2);
  const batch = Number(args[0]);
  if (!Number.isInteger(batch) || batch < 1 || batch > 50) throw new Error('Usage: node dataset-generator/generation/validate.mjs BATCH_NUMBER');
  const file = path.join(directory, 'batches', `batch-${String(batch).padStart(3, '0')}.jsonl`);
  const {rows, raw} = readJsonl(file);
  if (args[1] === '--review') {
    const start = Math.max(1, Number(args[2]) || 1);
    const end = Math.min(rows.length, Number(args[3]) || start + 19);
    console.log(`Batch ${batch}; SHA256 ${hash(raw)}; rows ${start}–${end}`);
    for (const row of rows.slice(start - 1, end)) {
      console.log(`\n${row.id} | ${row.category} | ${row.type} | ${row.domain} | ${words(row.input).length} words | ${row.presentation}`);
      console.log(`Errors: ${row.errors.join(', ')}; features: ${row.features.join(', ')}; scenario: ${row.scenario}`);
      console.log(`INPUT: ${row.input}\nOUTPUT: ${row.output}`);
    }
    return;
  }
  const report = validateBatch(rows, batch);
  console.log(JSON.stringify({...report, sha256: hash(raw), review_flags: reviewFlags(rows)}, null, 2));
  process.exitCode = report.failures.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
