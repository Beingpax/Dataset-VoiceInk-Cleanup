import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const ROOT = new URL('./', import.meta.url);
const DATASET_PATH = '/Users/beingpax/Downloads/transcript-cleanup-dataset/dataset-generator/data/cleanup-dataset.jsonl';
const SYSTEM_TEMPLATE_PATH = '/Users/beingpax/VoiceInk/VoiceInk/Core/Enhancement/AIPrompts.swift';
const PROMPT_TEMPLATES_PATH = '/Users/beingpax/VoiceInk/VoiceInk/Features/Enhancement/Templates/PromptTemplates.swift';
const MODEL = 'openai/gpt-oss-120b';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const EMAIL_CATEGORY = 'email_formatting';
const SEED = 0x564f4943;

function extractMultiline(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing source marker: ${startMarker}`);
  const bodyStart = source.indexOf('"""', start) + 3;
  const end = source.indexOf(endMarker, bodyStart);
  if (bodyStart < 3 || end < 0) throw new Error(`Unable to extract prompt after: ${startMarker}`);
  return source.slice(bodyStart, end).replace(/^\n/, '').split('\n').map(line => line.replace(/^ {8}/, '')).join('\n').trim();
}

function extractTemplate(source, title, nextTitle) {
  const titleMarker = `title: "${title}"`;
  const nextMarker = nextTitle ? `title: "${nextTitle}"` : 'id: rewritePromptId';
  const titleIndex = source.indexOf(titleMarker);
  const promptIndex = source.indexOf('promptText:', titleIndex);
  const nextIndex = source.indexOf(nextMarker, promptIndex + 1);
  const bodyStart = source.indexOf('"""', promptIndex) + 3;
  const end = source.lastIndexOf('"""', nextIndex);
  if (titleIndex < 0 || promptIndex < 0 || bodyStart < 3 || end < bodyStart) throw new Error(`Unable to extract ${title} prompt`);
  return source.slice(bodyStart, end).replace(/^\n/, '').split('\n').map(line => line.replace(/^ {20}/, '')).join('\n').trim();
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(items, count, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy.slice(0, count);
}

function cleanOutput(text) {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
}

async function readSecret() {
  if (!stdin.isTTY) {
    let value = '';
    for await (const chunk of stdin) value += chunk;
    return value.trim();
  }
  const prompt = createInterface({ input: stdin, output: stdout, terminal: true });
  const answer = await new Promise(resolve => prompt.question('Groq API key: ', resolve));
  prompt.close();
  return answer.trim();
}

async function callGroq(apiKey, systemPrompt, input, attempt = 1) {
  const startedAt = performance.now();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      reasoning_effort: 'low',
      include_reasoning: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `\n<TRANSCRIPT>\n${input}\n</TRANSCRIPT>` },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 7) {
      const retryAfter = Number(response.headers.get('retry-after')) || Math.min(2 ** attempt, 30);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return callGroq(apiKey, systemPrompt, input, attempt + 1);
    }
    throw new Error(`Groq HTTP ${response.status}: ${message.slice(0, 500)}`);
  }

  const payload = await response.json();
  const output = cleanOutput(payload.choices?.[0]?.message?.content || '');
  if (!output) throw new Error('Groq returned an empty response');
  return {
    output,
    latency_ms: Math.round(performance.now() - startedAt),
    usage: payload.usage || null,
  };
}

async function main() {
  const [datasetText, systemSource, promptSource] = await Promise.all([
    readFile(DATASET_PATH, 'utf8'),
    readFile(SYSTEM_TEMPLATE_PATH, 'utf8'),
    readFile(PROMPT_TEMPLATES_PATH, 'utf8'),
  ]);
  const records = datasetText.trim().split('\n').map(line => JSON.parse(line));
  const baseTemplate = extractMultiline(systemSource, 'enhancementSystemTemplate', '\n        """');
  const defaultTask = extractTemplate(promptSource, 'Default', 'Chat');
  const emailTask = extractTemplate(promptSource, 'Email', 'Rewrite');
  const prompts = {
    default: baseTemplate.replace('%@', defaultTask),
    email: baseTemplate.replace('%@', emailTask),
  };

  const byCategory = Map.groupBy(records, record => record.metadata.primary_category);
  const random = seededRandom(SEED);
  const selected = [];
  for (const category of [...byCategory.keys()].sort()) {
    const count = category === EMAIL_CATEGORY ? 50 : 5;
    selected.push(...sample(byCategory.get(category), count, random).map(record => ({
      ...record,
      prompt_type: category === EMAIL_CATEGORY ? 'email' : 'default',
    })));
  }

  const apiKey = await readSecret();
  if (!apiKey.startsWith('gsk_')) throw new Error('A valid Groq API key is required');
  const outputPath = new URL('../artifacts/voiceink-prompt-output.json', ROOT);
  let completed = [];
  try {
    completed = (JSON.parse(await readFile(outputPath, 'utf8')).cases || []).filter(item => !item.error);
  } catch {}
  const completedIds = new Set(completed.map(item => item.id));
  const queue = selected.filter(item => !completedIds.has(item.id));
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      const startedAt = new Date().toISOString();
      try {
        const result = await callGroq(apiKey, prompts[item.prompt_type], item.messages[1].content);
        completed.push({
          id: item.id,
          category: item.metadata.primary_category,
          prompt_type: item.prompt_type,
          input: item.messages[1].content,
          reference: item.messages[2].content,
          voiceink_output: result.output,
          latency_ms: result.latency_ms,
          usage: result.usage,
          metadata: item.metadata,
          generated_at: startedAt,
        });
        stdout.write(`✓ ${completed.length}/${selected.length} ${item.id} (${item.metadata.primary_category})\n`);
      } catch (error) {
        completed.push({
          id: item.id,
          category: item.metadata.primary_category,
          prompt_type: item.prompt_type,
          input: item.messages[1].content,
          reference: item.messages[2].content,
          voiceink_output: '',
          error: error.message,
          metadata: item.metadata,
          generated_at: startedAt,
        });
        stdout.write(`✗ ${completed.length}/${selected.length} ${item.id}: ${error.message}\n`);
      }
      completed.sort((a, b) => selected.findIndex(item => item.id === a.id) - selected.findIndex(item => item.id === b.id));
      await writeFile(outputPath, JSON.stringify({
        name: 'VoiceInk Prompt Output',
        model: MODEL,
        provider: 'Groq',
        generation_settings: { temperature: 0.3, reasoning_effort: 'low', include_reasoning: false },
        selection: { email_formatting: 50, other_categories_each: 5, total: selected.length, seed: SEED },
        prompts,
        cases: completed,
      }, null, 2));
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  const failures = completed.filter(item => item.error).length;
  stdout.write(`Complete: ${completed.length} cases, ${failures} failures.\n`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
