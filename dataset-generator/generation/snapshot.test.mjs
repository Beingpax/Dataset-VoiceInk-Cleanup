import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRecords} from './assemble.mjs';
import {parseJsonl, matchesErrors} from '../../src/utils/jsonl.js';

const row = {
  id: 'sample_5000', input: 'Um, please leave the parcel beside the kitchen door because I will be upstairs working when the delivery driver arrives.',
  output: 'Please leave the parcel beside the kitchen door because I will be upstairs working when the delivery driver arrives.',
  category: 'filler_words', type: 'single_principal_error', errors: ['filler'], features: [],
  domain: 'general', scenario: 'Parcel delivery instructions', presentation: 'correct',
};

test('draft export does not imply semantic or human review', () => {
  const [record] = canonicalRecords([row], {reviewedIds: new Set()});
  assert.equal(record.metadata.review_status, 'synthetic_draft');
  assert.equal(record.metadata.human_reviewed, false);
  assert.equal(record.metadata.generation_batch, 'batch-050');
  assert.deepEqual(record.messages.map(message => message.role), ['system', 'user', 'assistant']);
  assert.equal(record.messages[1].content, row.input);
  assert.equal(record.messages[2].content, row.output);
});

test('only explicitly accepted IDs carry the foreground review marker', () => {
  const records = canonicalRecords([row, {...row, id: 'sample_4999'}], {reviewedIds: new Set([row.id])});
  assert.equal(records[0].metadata.review_status, 'ai_foreground_reviewed');
  assert.equal(records[1].metadata.review_status, 'synthetic_draft');
});

test('viewer retains final sample ID, categories, errors and review provenance', () => {
  const records = canonicalRecords([row], {reviewedIds: new Set()});
  const parsed = parseJsonl(records.map(record => JSON.stringify(record)).join('\n'));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records[0].id, 'sample_5000');
  assert.equal(parsed.records[0].category, 'filler_words');
  assert.equal(parsed.records[0].recordType, 'single_principal_error');
  assert.equal(parsed.records[0].metadata.review_status, 'synthetic_draft');
  assert.equal(matchesErrors(parsed.records[0], ['filler'], 'all'), true);
});
