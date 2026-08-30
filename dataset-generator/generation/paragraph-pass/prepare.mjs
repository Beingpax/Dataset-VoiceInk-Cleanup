import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const readGroup = prefix => fs.readdirSync(directory).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort().flatMap(f => JSON.parse(fs.readFileSync(path.join(directory, f), 'utf8')));
const candidates = new Map(readGroup('candidates-').map(row => [row.id, row]));
const decisions = readGroup('decisions-');
if (decisions.length !== candidates.size || new Set(decisions.map(row => row.id)).size !== candidates.size) throw new Error('Incomplete or duplicated decisions');
const byId = new Map(decisions.map(row => [row.id, row]));
const whitespace = value => value.replace(/\s+/gu, ' ').trim();

export function prepare(batch) {
  const file = path.resolve(directory, '../batches', `batch-${String(batch).padStart(3, '0')}.jsonl`);
  const raw = fs.readFileSync(file, 'utf8');
  const edits = [], held = [], unchanged = [];
  for (const before of raw.trimEnd().split(/\n/u)) {
    const row = JSON.parse(before), decision = byId.get(row.id);
    if (!decision) continue;
    const candidate = candidates.get(row.id);
    if (!decision.break_before.length) { unchanged.push(row.id); continue; }
    let output = candidate.output;
    const positions = decision.break_before.map(anchor => {
      const at = output.indexOf(anchor);
      if (at < 1 || output.indexOf(anchor, at + 1) !== -1 || output[at - 1] !== ' ') throw new Error(`${row.id}: invalid anchor`);
      if (!candidate.paragraphs.some(p => p.includes(anchor) && !p.startsWith(anchor))) throw new Error(`${row.id}: anchor outside flagged paragraph`);
      if (!/[.!?][”"')]?$/u.test(output.slice(0, at).trimEnd())) throw new Error(`${row.id}: not a sentence boundary`);
      return at;
    }).sort((a, b) => b - a);
    if (new Set(positions).size !== positions.length) throw new Error(`${row.id}: repeated boundary`);
    for (const at of positions) output = output.slice(0, at - 1) + '\n\n' + output.slice(at);
    if (whitespace(output) !== whitespace(candidate.output)) throw new Error(`${row.id}: wording changed`);
    const labelChange = row.type === 'no_change' || (row.type === 'single_principal_error' && !['punctuation_capitalization_dictated_formatting', 'email_formatting'].includes(row.category));
    if (labelChange) { held.push(row.id); continue; }
    if (row.output === output) continue;
    if (row.output !== candidate.output) throw new Error(`${row.id}: output changed since identification`);
    const input = row.input;
    row.output = output;
    row.errors = [...new Set([...row.errors, 'paragraph_formatting'])];
    row.features = [...new Set([...row.features, 'paragraphs'])];
    if (row.input !== input) throw new Error(`${row.id}: input changed`);
    edits.push({id: row.id, before, after: JSON.stringify(row)});
  }
  return {file, edits, held, unchanged};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(prepare(Number(process.argv[2]))));
