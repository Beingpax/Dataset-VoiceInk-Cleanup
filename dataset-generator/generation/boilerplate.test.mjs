import test from 'node:test';
import assert from 'node:assert/strict';
import {repeatedBoilerplate} from './assemble.mjs';

const padding = 'Please let me know today if that timing creates a problem for anyone involved.';
test('catches long shared padding despite distinct messages', () => {
  const rows = Array.from({length: 40}, (_, i) => ({id: `sample_${String(i + 1).padStart(4, '0')}`, output: `Message ${i} has its own context. ${padding}`}));
  const flags = repeatedBoilerplate(rows);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].ids.length, 40);
});
test('does not flag short conventional greetings or sparse repetitions', () => {
  const rows = Array.from({length: 4}, (_, i) => ({id: `sample_${String(i + 1).padStart(4, '0')}`, output: `Thanks for your help. ${padding}`}));
  assert.deepEqual(repeatedBoilerplate(rows), []);
});
test('counts records, not repetitions inside one target', () => {
  assert.deepEqual(repeatedBoilerplate([{id: 'sample_0001', output: Array(8).fill(padding).join(' ')}]), []);
});
