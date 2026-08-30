function contentByRole(messages, role) {
  const item = Array.isArray(messages) ? messages.find(message => message?.role === role) : null;
  return typeof item?.content === 'string' ? item.content : '';
}

export function asList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return value == null || value === '' ? [] : [String(value)];
}

export function humanize(value) {
  return String(value || 'unspecified').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export function normalizeRecord(raw, index) {
  const metadata = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const merged = { ...raw, ...metadata };
  const input = contentByRole(raw?.messages, 'user') || String(raw?.input ?? raw?.prompt ?? '');
  const output = contentByRole(raw?.messages, 'assistant') || String(raw?.reference ?? raw?.output ?? raw?.completion ?? '');
  const system = contentByRole(raw?.messages, 'system') || String(raw?.system ?? '');
  const record = {
    raw,
    metadata,
    id: String(raw?.id ?? metadata.id ?? `record_${String(index + 1).padStart(4, '0')}`),
    input,
    output,
    system,
    language: String(merged.language ?? 'unspecified'),
    recordType: String(merged.record_type ?? merged.selection_group ?? merged.dataset_id ?? 'unspecified'),
    category: String(merged.primary_category ?? merged.dataset_name ?? 'unspecified'),
    errorTypes: asList(merged.error_types),
    formattingFeatures: asList(merged.formatting_features),
  };
  record.search = [record.id, input, output, system, record.language, record.recordType, record.category, ...record.errorTypes, ...record.formattingFeatures, ...Object.values(metadata).flatMap(asList)].join(' ').toLocaleLowerCase();
  return record;
}

export function parseJsonl(text) {
  const records = [];
  const errors = [];
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, lineIndex) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('expected a JSON object');
      records.push(normalizeRecord(parsed, records.length));
    } catch (error) {
      errors.push(`Line ${lineIndex + 1}: ${error.message}`);
    }
  });
  if (!records.length) throw new Error(errors[0] || 'No JSONL objects were found.');
  return { records, errors };
}

export function truncate(value, limit = 120) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean || 'Empty';
}
