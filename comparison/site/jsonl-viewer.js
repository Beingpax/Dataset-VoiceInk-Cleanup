const viewerState = {
  records: [],
  visible: [],
  selectedId: null,
  sourceName: '',
};

const byId = id => document.getElementById(id);

function messageContent(messages, role) {
  const message = Array.isArray(messages) ? messages.find(item => item?.role === role) : null;
  return typeof message?.content === 'string' ? message.content : '';
}

function list(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value == null || value === '' ? [] : [String(value)];
}

function humanize(value) {
  return String(value || 'unspecified')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalize(raw, index) {
  const metadata = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const merged = { ...raw, ...metadata };
  const input = messageContent(raw?.messages, 'user') || String(raw?.input ?? raw?.prompt ?? '');
  const output = messageContent(raw?.messages, 'assistant') || String(raw?.reference ?? raw?.output ?? raw?.completion ?? '');
  const system = messageContent(raw?.messages, 'system') || String(raw?.system ?? '');
  const record = {
    raw,
    id: String(raw?.id ?? metadata.id ?? `record_${String(index + 1).padStart(4, '0')}`),
    input,
    output,
    system,
    metadata,
    language: String(merged.language ?? 'unspecified'),
    recordType: String(merged.record_type ?? merged.selection_group ?? merged.dataset_id ?? 'unspecified'),
    category: String(merged.primary_category ?? merged.dataset_name ?? 'unspecified'),
    errorTypes: list(merged.error_types),
    formattingFeatures: list(merged.formatting_features),
  };
  record.search = [
    record.id, input, output, system, record.language, record.recordType, record.category,
    ...record.errorTypes, ...record.formattingFeatures, ...Object.values(metadata).flatMap(list),
  ].join(' ').toLocaleLowerCase();
  return record;
}

function parseJsonl(text) {
  const records = [];
  const errors = [];
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, lineIndex) => {
    if (!line.trim()) return;
    try {
      const value = JSON.parse(line);
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('expected a JSON object');
      records.push(normalize(value, records.length));
    } catch (error) {
      errors.push(`Line ${lineIndex + 1}: ${error.message}`);
    }
  });
  if (!records.length) throw new Error(errors[0] || 'No JSONL records were found.');
  return { records, errors };
}

function setStatus(message, error = false) {
  const status = byId('jsonl-status');
  status.textContent = message;
  status.classList.toggle('is-error', error);
  status.setAttribute('role', error ? 'alert' : 'status');
}

function optionList(select, values, allLabel) {
  const current = select.value;
  select.replaceChildren(new Option(allLabel, ''));
  [...new Set(values.filter(Boolean))].sort().forEach(value => select.add(new Option(humanize(value), value)));
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function populateFilters() {
  optionList(byId('jsonl-type'), viewerState.records.map(record => record.recordType), 'All record types');
  optionList(byId('jsonl-category'), viewerState.records.map(record => record.category), 'All categories');
  optionList(byId('jsonl-language'), viewerState.records.map(record => record.language), 'All languages');
}

function applyFilters() {
  const query = byId('jsonl-search').value.trim().toLocaleLowerCase();
  const type = byId('jsonl-type').value;
  const category = byId('jsonl-category').value;
  const language = byId('jsonl-language').value;
  viewerState.visible = viewerState.records.filter(record =>
    (!query || record.search.includes(query)) &&
    (!type || record.recordType === type) &&
    (!category || record.category === category) &&
    (!language || record.language === language)
  );
  if (!viewerState.visible.some(record => record.id === viewerState.selectedId)) {
    viewerState.selectedId = viewerState.visible[0]?.id ?? null;
  }
  renderViewer();
}

function truncate(text, limit = 100) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean || 'Empty';
}

function makeCell(text, className = '') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderRows() {
  const body = byId('jsonl-rows');
  body.replaceChildren();
  viewerState.visible.slice(0, 500).forEach(record => {
    const row = document.createElement('tr');
    row.dataset.id = record.id;
    row.setAttribute('aria-selected', String(record.id === viewerState.selectedId));
    row.append(
      makeCell(record.id, 'viewer-id'),
      makeCell(truncate(record.input), 'viewer-preview'),
      makeCell(humanize(record.category)),
      makeCell(humanize(record.recordType)),
      makeCell(record.language),
    );
    row.addEventListener('click', () => {
      viewerState.selectedId = record.id;
      renderRows();
      renderDetail();
    });
    body.append(row);
  });
  byId('jsonl-count').textContent = `${viewerState.visible.length.toLocaleString()} of ${viewerState.records.length.toLocaleString()} records`;
  byId('jsonl-limit-note').hidden = viewerState.visible.length <= 500;
}

function appendBlock(container, kind, lines) {
  if (!lines.length) return;
  if (kind === 'ul' || kind === 'ol') {
    const group = document.createElement(kind);
    lines.forEach(text => {
      const item = document.createElement('li');
      item.textContent = text;
      group.append(item);
    });
    container.append(group);
    return;
  }
  if (kind === 'quote') {
    const quote = document.createElement('blockquote');
    quote.textContent = lines.join('\n');
    container.append(quote);
    return;
  }
  const paragraph = document.createElement('p');
  lines.forEach((line, index) => {
    if (index) paragraph.append(document.createElement('br'));
    paragraph.append(document.createTextNode(line));
  });
  container.append(paragraph);
}

function renderRich(container, text) {
  container.replaceChildren();
  let kind = 'p';
  let buffer = [];
  const flush = () => { appendBlock(container, kind, buffer); buffer = []; };
  String(text).split(/\r?\n/).forEach(original => {
    const line = original.trim();
    if (!line) { flush(); kind = 'p'; return; }
    const unordered = line.match(/^[-*•]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.+)$/);
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flush();
      const title = document.createElement('h4');
      title.textContent = heading[2];
      container.append(title);
      kind = 'p';
    } else if (unordered) {
      if (kind !== 'ul') { flush(); kind = 'ul'; }
      buffer.push(unordered[1]);
    } else if (ordered) {
      if (kind !== 'ol') { flush(); kind = 'ol'; }
      buffer.push(ordered[1]);
    } else if (quote) {
      if (kind !== 'quote') { flush(); kind = 'quote'; }
      buffer.push(quote[1]);
    } else {
      if (kind !== 'p') { flush(); kind = 'p'; }
      buffer.push(line);
    }
  });
  flush();
  if (!container.childElementCount) {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'No text provided.';
    container.append(paragraph);
  }
}

function metadataChip(label, value) {
  const chip = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  chip.append(strong, document.createTextNode(` ${humanize(value)}`));
  return chip;
}

function renderDetail() {
  const detail = byId('jsonl-detail');
  const record = viewerState.visible.find(item => item.id === viewerState.selectedId);
  detail.hidden = !record;
  if (!record) return;
  byId('jsonl-detail-id').textContent = record.id;
  byId('jsonl-detail-title').textContent = humanize(record.category);
  renderRich(byId('jsonl-input'), record.input);
  renderRich(byId('jsonl-output'), record.output);
  const metadata = byId('jsonl-metadata');
  metadata.replaceChildren(
    metadataChip('Language', record.language),
    metadataChip('Type', record.recordType),
    metadataChip('Category', record.category),
    ...record.errorTypes.map(value => metadataChip('Error', value)),
    ...record.formattingFeatures.map(value => metadataChip('Formatting', value)),
  );
  Object.entries(record.metadata).forEach(([key, value]) => {
    if (['language', 'record_type', 'primary_category', 'error_types', 'formatting_features'].includes(key)) return;
    list(value).forEach(item => metadata.append(metadataChip(humanize(key), item)));
  });
  byId('jsonl-system').textContent = record.system || 'No system instruction in this record.';
  byId('jsonl-raw').textContent = JSON.stringify(record.raw, null, 2);
}

function renderViewer() {
  renderRows();
  renderDetail();
  byId('jsonl-empty').hidden = viewerState.records.length > 0;
  byId('jsonl-workspace').hidden = viewerState.records.length === 0;
}

function acceptText(text, name) {
  try {
    const { records, errors } = parseJsonl(text);
    viewerState.records = records;
    viewerState.sourceName = name;
    viewerState.selectedId = records[0]?.id ?? null;
    populateFilters();
    byId('jsonl-search').value = '';
    byId('jsonl-type').value = '';
    byId('jsonl-category').value = '';
    byId('jsonl-language').value = '';
    applyFilters();
    setStatus(errors.length
      ? `Loaded ${records.length.toLocaleString()} records from ${name}; skipped ${errors.length} invalid lines.`
      : `Loaded ${records.length.toLocaleString()} records from ${name}.`);
  } catch (error) {
    setStatus(`Could not read ${name}: ${error.message}`, true);
  }
}

async function loadPreset(value) {
  if (!value) return;
  const selected = byId('jsonl-source').selectedOptions[0]?.textContent || value;
  setStatus(`Loading ${selected}…`);
  try {
    const response = await fetch(value, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    acceptText(await response.text(), selected);
  } catch (error) {
    setStatus(`Could not load ${selected}. Serve the repository over HTTP, or choose the JSONL file locally. ${error.message}`, true);
  }
}

export function initJsonlViewer() {
  const root = byId('viewer');
  if (!root) return;
  byId('jsonl-source').addEventListener('change', event => loadPreset(event.target.value));
  byId('jsonl-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    acceptText(await file.text(), file.name);
  });
  ['jsonl-search', 'jsonl-type', 'jsonl-category', 'jsonl-language'].forEach(id => {
    byId(id).addEventListener(id === 'jsonl-search' ? 'input' : 'change', applyFilters);
  });
  byId('jsonl-clear').addEventListener('click', () => {
    byId('jsonl-search').value = '';
    byId('jsonl-type').value = '';
    byId('jsonl-category').value = '';
    byId('jsonl-language').value = '';
    applyFilters();
  });
  loadPreset(byId('jsonl-source').value);
}
