import test from 'node:test';
import assert from 'node:assert/strict';
import {config, expectedBatch, validateRecord, validateBatch, words, normalized} from './validate.mjs';

const text = 'Please leave the small parcel beside the kitchen door because I will be upstairs working when the delivery driver arrives.';
const fixture = {id:'sample_0001', input:text, output:text, category:'no_change', type:'no_change', errors:[], features:[], domain:'general', scenario:'Parcel delivery instruction', presentation:'correct'};

test('batch categories sum exactly to the approved 5,000 allocation', () => {
  assert.equal(Object.values(config.categories).reduce((a,b)=>a+b,0),5000);
  assert.equal(Object.values(config.record_types).reduce((a,b)=>a+b,0),5000);
  const totals = {};
  for (let batch=1; batch<=50; batch++) for (const [key,count] of Object.entries(expectedBatch(batch))) totals[key]=(totals[key]||0)+count;
  assert.deepEqual(totals, config.categories);
});

test('word limits are inclusive and count whitespace-separated tokens', () => {
  assert.equal(words(text).length,20);
  assert.deepEqual(validateRecord(fixture),[]);
  const long = Array(200).fill('word').join(' ');
  assert.deepEqual(validateRecord({...fixture,input:long,output:long}),[]);
  assert.ok(validateRecord({...fixture,input:'Too short.'}).some(s=>s.includes('words')));
  assert.ok(validateRecord({...fixture,input:Array(201).fill('word').join(' ')}).some(s=>s.includes('201')));
});

test('no-change equality and labels are enforced', () => {
  assert.ok(validateRecord({...fixture,output:text+' Added.'}).some(s=>s.includes('target differs')));
  assert.ok(validateRecord({...fixture,errors:['filler']}).some(s=>s.includes('error labels')));
  assert.ok(validateRecord({...fixture,type:'natural_multi_error'}).some(s=>s.includes('mismatch')));
});

test('multi-error must have multiple labels and a primary-category behavior', () => {
  const changed = {...fixture,input:'Um, '+text,category:'filler_words',type:'natural_multi_error',errors:['filler']};
  assert.ok(validateRecord(changed).some(s=>s.includes('at least two')));
  assert.ok(validateRecord({...changed,errors:['punctuation','repetition']}).some(s=>s.includes('primary-category')));
});

test('structural labels are supported by rendered output', () => {
  const changed = {...fixture,input:'Um, '+text,category:'filler_words',type:'natural_multi_error',errors:['filler','paragraph_formatting'],features:['paragraphs']};
  assert.ok(validateRecord(changed).some(s=>s.includes('paragraph break')));
  assert.ok(validateRecord({...changed,features:['ordered_list']}).some(s=>s.includes('without list')));
});

test('bad schema and batch counts are rejected without claiming semantic correctness', () => {
  assert.ok(validateRecord(null).length);
  assert.ok(validateRecord({...fixture,input:null}).length);
  assert.ok(validateRecord({...fixture,speaker_id:'speaker'}).some(s=>s.includes('fields')));
  assert.ok(validateBatch([fixture],1).failures.some(s=>s.includes('expected 100')));
  assert.equal(normalized('Hello, WORLD!'),normalized('hello world'));
});
