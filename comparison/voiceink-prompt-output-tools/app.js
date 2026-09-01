const app = document.querySelector('#app');

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

const paragraphs = text => escapeHtml(text || '(empty output)').split(/\n{2,}/).map(block => `<p>${block.replaceAll('\n', '<br>')}</p>`).join('');
const percent = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'Unavailable';

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function render(data) {
  const state = { category: 'all', prompt: 'all', caseId: data.cases[0]?.id || '' };
  const categories = [...new Set(data.cases.map(item => item.category))].sort();

  function filteredCases() {
    return data.cases.filter(item => (state.category === 'all' || item.category === state.category) && (state.prompt === 'all' || item.prompt_type === state.prompt));
  }

  function draw() {
    const cases = filteredCases();
    if (!cases.some(item => item.id === state.caseId)) state.caseId = cases[0]?.id || '';
    const selected = cases.find(item => item.id === state.caseId);
    const position = Math.max(0, cases.findIndex(item => item.id === state.caseId));
    app.innerHTML = `
      <header class="page-heading">
        <div class="title-block">
          <h1>VoiceInk prompt output</h1>
        </div>
        <section class="controls" aria-label="Case controls">
          <label>Category<select id="category-filter">${option('all', 'All categories', state.category)}${categories.map(value => option(value, value.replaceAll('_', ' '), state.category)).join('')}</select></label>
          <label>Prompt<select id="prompt-filter">${option('all', 'Both prompts', state.prompt)}${option('default', 'Default', state.prompt)}${option('email', 'Email', state.prompt)}</select></label>
          <label>Case<select id="case-filter">${cases.map(item => option(item.id, `${item.id} · ${item.category.replaceAll('_', ' ')}`, state.caseId)).join('')}</select></label>
          <div class="case-actions"><span><strong>${position + 1}</strong> of ${cases.length}</span><button id="previous" type="button" ${cases.length < 2 ? 'disabled' : ''}>Previous</button><button id="next" class="primary" type="button" ${cases.length < 2 ? 'disabled' : ''}>Next case</button></div>
        </section>
      </header>
      ${selected ? `
        <section class="case-meta"><span>${escapeHtml(selected.id)}</span><strong>${escapeHtml(selected.category.replaceAll('_', ' '))}</strong><span>${escapeHtml(selected.prompt_type)} prompt</span></section>
        <section class="comparison" aria-label="Input and reference comparison">
          <article><h2>Raw ASR input</h2><div class="text-body">${paragraphs(selected.input)}</div></article>
          <article><h2>Reference output</h2><div class="text-body">${paragraphs(selected.reference)}</div></article>
        </section>
        <section class="voiceink-result">
          <header><h2>VoiceInk output</h2><strong>${selected.metrics?.exact_match ? 'Exact match' : `${percent(selected.metrics?.edit_similarity)} similar`}</strong></header>
          <div class="result-text ${selected.error ? 'is-error' : ''}">${selected.error ? `<p>${escapeHtml(selected.error)}</p>` : paragraphs(selected.voiceink_output)}</div>
          <footer class="result-metrics"><dl><div><dt>chrF++</dt><dd>${percent(selected.metrics?.chrf)}</dd></div><div><dt>WER</dt><dd>${percent(selected.metrics?.wer)}</dd></div><div><dt>Latency</dt><dd>${selected.latency_ms ? `${(selected.latency_ms / 1000).toFixed(3)} s` : 'Unavailable'}</dd></div></dl></footer>
        </section>
        <details class="prompt-disclosure"><summary>View final constructed ${escapeHtml(selected.prompt_type)} prompt</summary><pre>${escapeHtml(data.prompts[selected.prompt_type])}</pre></details>
      ` : '<section class="empty"><h2>No matching cases</h2><p>Change the filters to continue reviewing outputs.</p></section>'}
    `;

    document.querySelector('#category-filter').addEventListener('change', event => { state.category = event.target.value; draw(); });
    document.querySelector('#prompt-filter').addEventListener('change', event => { state.prompt = event.target.value; draw(); });
    document.querySelector('#case-filter').addEventListener('change', event => { state.caseId = event.target.value; draw(); });
    document.querySelector('#previous')?.addEventListener('click', () => { state.caseId = cases[(position - 1 + cases.length) % cases.length].id; draw(); });
    document.querySelector('#next')?.addEventListener('click', () => { state.caseId = cases[(position + 1) % cases.length].id; draw(); });
  }

  window.addEventListener('keydown', event => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const cases = filteredCases();
    const index = cases.findIndex(item => item.id === state.caseId);
    if (event.key === 'ArrowLeft' && cases.length > 1) { state.caseId = cases[(index - 1 + cases.length) % cases.length].id; draw(); }
    if (event.key === 'ArrowRight' && cases.length > 1) { state.caseId = cases[(index + 1) % cases.length].id; draw(); }
  });
  draw();
}

fetch('./data/results.json', { cache: 'no-store' })
  .then(response => { if (!response.ok) throw new Error(`Results returned HTTP ${response.status}`); return response.json(); })
  .then(render)
  .catch(error => { app.innerHTML = `<section class="empty"><h1>Results unavailable</h1><p>${escapeHtml(error.message)}</p></section>`; });
