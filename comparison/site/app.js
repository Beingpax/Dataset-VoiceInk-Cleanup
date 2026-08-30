import { initJsonlViewer } from './jsonl-viewer.js';

const colors = [
  'oklch(0.68 0.12 200)',
  'oklch(0.63 0.17 32)',
  'oklch(0.70 0.15 78)',
  'oklch(0.55 0.13 150)',
];

const formatPercent = value => value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
const formatNumber = (value, digits = 1) => value == null ? 'Unavailable' : Number(value).toFixed(digits);
const shortName = model => model.name.replace(' (low reasoning)', '');

let benchmark;
let models;
let orderedCaseIds = [];
let currentCaseId;
let activeDataset = 'all';

function activeSummary(model) {
  return activeDataset === 'all' ? model.summary : model.dataset_summaries[activeDataset];
}

async function loadData() {
  const response = await fetch('./data/benchmark.json');
  if (!response.ok) throw new Error(`Could not load benchmark data (${response.status})`);
  benchmark = await response.json();
  models = benchmark.models
    .slice()
    .sort((a, b) => b.summary.mean_edit_similarity - a.summary.mean_edit_similarity)
    .map((model, index) => ({ ...model, color: colors[index] }));
  orderedCaseIds = models[0].cases.map(item => item.id);
  currentCaseId = orderedCaseIds[0];
  renderAll();
}

function renderAll() {
  document.querySelector('#case-count').textContent = `${benchmark.benchmark.sample_count} cases`;
  renderLead();
  renderTable();
  renderChart();
  renderModels();
  renderCaseOptions();
  renderCase();
}

function renderLead() {
  const leader = models[0];
  const local = models.filter(model => activeSummary(model).median_tokens_per_second != null);
  const fastest = local.slice().sort((a, b) => activeSummary(b).median_tokens_per_second - activeSummary(a).median_tokens_per_second)[0];
  const leaderSummary = activeSummary(leader);
  const fastestSummary = activeSummary(fastest);
  document.querySelector('#lead-finding').innerHTML = `
    <strong>${shortName(leader)}</strong> was closest to the human references at ${formatPercent(leaderSummary.mean_edit_similarity)} mean edit similarity. Among local runs, <strong>${shortName(fastest)}</strong> was fastest at ${formatNumber(fastestSummary.median_tokens_per_second)} median output tokens per second.
  `;
}

function renderTable() {
  const body = document.querySelector('#ranking-table tbody');
  body.innerHTML = models.map((model, index) => {
    const s = activeSummary(model);
    const memory = s.peak_memory_gib == null ? '<span class="unavailable">Provider unavailable</span>' : `${formatNumber(s.peak_memory_gib, 2)} GiB`;
    const speed = s.median_tokens_per_second == null ? '<span class="unavailable">Provider unavailable</span>' : formatNumber(s.median_tokens_per_second);
    return `<tr>
      <td><strong><span class="rank">${String(index + 1).padStart(2, '0')}</span>${model.name}</strong><span>${model.runtime}</span></td>
      <td>${formatPercent(s.mean_edit_similarity)}</td>
      <td>${formatPercent(s.mean_chrf)}</td>
      <td>${formatPercent(s.mean_wer)}</td>
      <td>${Math.round(s.exact_match_rate * s.case_count)}/${s.case_count}</td>
      <td>${s.mean_generation_seconds == null ? '<span class="unavailable">Unavailable</span>' : `${formatNumber(s.mean_generation_seconds, 3)} s`}</td>
      <td>${s.median_generation_seconds == null ? '<span class="unavailable">Unavailable</span>' : `${formatNumber(s.median_generation_seconds, 3)} s`}</td>
      <td>${speed}</td>
      <td>${memory}</td>
    </tr>`;
  }).join('');
}

function svg(tag, attrs = {}, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  if (text) node.textContent = text;
  return node;
}

function renderChart() {
  const chart = document.querySelector('#quality-chart');
  chart.innerHTML = '';
  const bounds = { left: 92, right: 930, top: 42, bottom: 480 };
  const xMin = 0.82, xMax = 1.0, yMin = 0.48, yMax = 1.0;
  const x = value => bounds.left + ((value - xMin) / (xMax - xMin)) * (bounds.right - bounds.left);
  const y = value => bounds.bottom - ((value - yMin) / (yMax - yMin)) * (bounds.bottom - bounds.top);
  [0.84, 0.88, 0.92, 0.96, 1].forEach(value => {
    chart.append(svg('line', { x1: x(value), x2: x(value), y1: bounds.top, y2: bounds.bottom, class: 'axis-line' }));
    chart.append(svg('text', { x: x(value), y: 512, 'text-anchor': 'middle', class: 'tick-label' }, `${Math.round(value * 100)}%`));
  });
  [0.5, 0.6, 0.7, 0.8, 0.9, 1].forEach(value => {
    chart.append(svg('line', { x1: bounds.left, x2: bounds.right, y1: y(value), y2: y(value), class: 'axis-line' }));
    chart.append(svg('text', { x: 72, y: y(value) + 5, 'text-anchor': 'end', class: 'tick-label' }, `${Math.round(value * 100)}%`));
  });
  chart.append(svg('text', { x: 510, y: 550, 'text-anchor': 'middle', class: 'axis-label' }, 'Edit similarity →'));
  const yLabel = svg('text', { x: 20, y: 270, 'text-anchor': 'middle', transform: 'rotate(-90 20 270)', class: 'axis-label' }, 'Word accuracy →');
  chart.append(yLabel);
  models.forEach((model, index) => {
    const summary = activeSummary(model);
    const pointX = x(summary.mean_edit_similarity);
    const pointY = y(Math.max(yMin, 1 - summary.mean_wer));
    chart.append(svg('circle', { cx: pointX, cy: pointY, r: 14, fill: model.color, class: 'chart-point' }));
    const anchor = pointX > 790 ? 'end' : 'start';
    const offset = pointX > 790 ? -22 : 22;
    chart.append(svg('text', { x: pointX + offset, y: pointY + (index % 2 ? 5 : -15), 'text-anchor': anchor, class: 'point-label' }, shortName(model)));
  });
  document.querySelector('#chart-legend').innerHTML = models.map(model => `<span><i style="--dot:${model.color}"></i>${shortName(model)}</span>`).join('');
}

function renderModels() {
  document.querySelector('#model-strata').innerHTML = models.map((model, index) => `
    <article class="model-entry">
      <div class="index">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <h3>${model.name}</h3>
        <div class="runtime">${model.runtime}</div>
      </div>
      <p>${model.prompt_mode}. ${model.summary.peak_memory_gib == null ? 'Provider-side memory, latency, and throughput were not exposed.' : `Measured peak RSS: ${formatNumber(model.summary.peak_memory_gib, 2)} GiB; selected-view mean response latency: ${formatNumber(activeSummary(model).mean_generation_seconds, 3)} seconds; median: ${formatNumber(activeSummary(model).median_generation_seconds, 3)} seconds.`}</p>
    </article>
  `).join('');
}

function getCase(model, id) {
  return model.cases.find(item => item.id === id);
}

function caseDifficulty(id) {
  const scores = models.map(model => getCase(model, id).metrics.edit_similarity);
  return 1 - scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function caseSpread(id) {
  const scores = models.map(model => getCase(model, id).metrics.edit_similarity);
  return Math.max(...scores) - Math.min(...scores);
}

function reorderCases(mode) {
  orderedCaseIds = models[0].cases.filter(item => activeDataset === 'all' || item.dataset_id === activeDataset).map(item => item.id);
  if (mode === 'hardest') orderedCaseIds.sort((a, b) => caseDifficulty(b) - caseDifficulty(a));
  if (mode === 'spread') orderedCaseIds.sort((a, b) => caseSpread(b) - caseSpread(a));
  if (mode === 'longest') orderedCaseIds.sort((a, b) => getCase(models[0], b).input_characters - getCase(models[0], a).input_characters);
  renderCaseOptions();
  currentCaseId = orderedCaseIds[0];
  renderCase();
}

function renderCaseOptions() {
  const select = document.querySelector('#case-select');
  select.innerHTML = orderedCaseIds.map(id => {
    const item = getCase(models[0], id);
    const origin = item.source_index == null ? item.source_record_id : `row ${item.source_index}`;
    return `<option value="${id}">${id} · ${origin}</option>`;
  }).join('');
  select.value = currentCaseId;
}

function metricPair(label, value) {
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

function renderCase() {
  const source = getCase(models[0], currentCaseId);
  document.querySelector('#case-select').value = currentCaseId;
  const origin = source.source_index == null ? source.source_record_id : `validation row ${source.source_index}`;
  const group = source.dataset_id === 'curated-sample-50' ? (source.metadata?.primary_category || 'curated pair').replaceAll('_', ' ') : (source.selection_group === 'long_random_addition' ? 'long-sample addition' : 'original sample');
  document.querySelector('#case-meta').innerHTML = `<strong>${source.id}</strong><span>${source.dataset_name}</span><span>${origin}</span><span>${group}</span><span>${source.input_words} words</span><span>mean difficulty ${formatPercent(caseDifficulty(source.id))}</span>`;
  document.querySelector('#case-input').textContent = source.input;
  document.querySelector('#case-reference').textContent = source.reference;
  const container = document.querySelector('#case-outputs');
  container.innerHTML = '';
  const template = document.querySelector('#output-template');
  models.forEach(model => {
    const result = getCase(model, currentCaseId);
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.model-dot').style.setProperty('--dot', model.color);
    fragment.querySelector('h3').textContent = model.name;
    fragment.querySelector('.output-score').textContent = result.metrics.exact_match ? 'Exact match' : `${formatPercent(result.metrics.edit_similarity)} similar`;
    fragment.querySelector('pre').textContent = result.output || '(empty output)';
    const perf = result.performance || {};
    fragment.querySelector('.output-metrics').innerHTML = [
      metricPair('chrF++', formatPercent(result.metrics.chrf)),
      metricPair('WER', formatPercent(result.metrics.wer)),
      metricPair('response latency', perf.generation_seconds == null ? 'Unavailable' : `${formatNumber(perf.generation_seconds, 3)} s`),
      metricPair('throughput', perf.tokens_per_second == null ? 'Unavailable' : `${formatNumber(perf.tokens_per_second)} tok/s`),
    ].join('');
    container.append(fragment);
  });
}

function moveCase(delta) {
  const index = orderedCaseIds.indexOf(currentCaseId);
  currentCaseId = orderedCaseIds[(index + delta + orderedCaseIds.length) % orderedCaseIds.length];
  renderCase();
}

document.querySelector('#case-select').addEventListener('change', event => {
  currentCaseId = event.target.value;
  renderCase();
});
document.querySelector('#case-order').addEventListener('change', event => reorderCases(event.target.value));
function changeDataset(value) {
  activeDataset = value;
  document.querySelector('#dataset-view').value = value;
  document.querySelector('#case-dataset').value = value;
  models.sort((a, b) => activeSummary(b).mean_edit_similarity - activeSummary(a).mean_edit_similarity);
  renderLead();
  renderTable();
  renderChart();
  renderModels();
  reorderCases(document.querySelector('#case-order').value);
  document.querySelector('#case-count').textContent = `${orderedCaseIds.length} cases`;
}
document.querySelector('#dataset-view').addEventListener('change', event => changeDataset(event.target.value));
document.querySelector('#case-dataset').addEventListener('change', event => changeDataset(event.target.value));
document.querySelector('#previous-case').addEventListener('click', () => moveCase(-1));
document.querySelector('#next-case').addEventListener('click', () => moveCase(1));

initJsonlViewer();

loadData().catch(error => {
  document.querySelector('#results').innerHTML = `<div class="section-heading"><div><h2>Benchmark data could not load.</h2><p>${error.message}</p><p>Serve the repository root over HTTP and open <code>/comparison/site/</code>.</p></div></div>`;
});
