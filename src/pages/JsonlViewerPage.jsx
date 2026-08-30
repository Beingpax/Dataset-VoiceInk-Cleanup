import { useEffect, useMemo, useState } from 'react';
import RichText from '../components/RichText.jsx';
import { asList, humanize, parseJsonl, truncate } from '../utils/jsonl.js';

const sources = [
  { id: 'generator', label: 'Generator sample', detail: '50 curated pairs', path: 'data/generator-sample.jsonl' },
  { id: 'benchmark', label: 'Benchmark corpus', detail: '100 labeled cases', path: 'data/benchmark-sample.jsonl' },
];

function unique(records, key, flatten = false) {
  return [...new Set(records.flatMap(record => flatten ? record[key] : [record[key]]).filter(Boolean))].sort();
}

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}><option value="">{allLabel}</option>{options.map(option => <option key={option} value={option}>{humanize(option)}</option>)}</select></label>;
}

function MetaChip({ label, value }) {
  return <span><strong>{label}:</strong> {humanize(value)}</span>;
}

export default function JsonlViewerPage() {
  const [records, setRecords] = useState([]);
  const [source, setSource] = useState('generator');
  const [sourceName, setSourceName] = useState('Generator sample');
  const [status, setStatus] = useState('Loading generator sample…');
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [errorType, setErrorType] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const acceptText = (text, name) => {
    try {
      const result = parseJsonl(text);
      setRecords(result.records);
      setSourceName(name);
      setSelectedId(result.records[0]?.id || '');
      setQuery(''); setType(''); setCategory(''); setLanguage(''); setErrorType('');
      setLoadError(false);
      setStatus(result.errors.length ? `Loaded ${result.records.length} records; skipped ${result.errors.length} invalid lines.` : `Loaded ${result.records.length} records from ${name}.`);
    } catch (error) {
      setLoadError(true);
      setStatus(`Could not read ${name}: ${error.message}`);
    }
  };

  const loadSource = async sourceId => {
    const item = sources.find(candidate => candidate.id === sourceId);
    if (!item) return;
    setSource(sourceId); setStatus(`Loading ${item.label}…`); setLoadError(false);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${item.path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      acceptText(await response.text(), item.label);
    } catch (error) {
      setLoadError(true); setStatus(`Could not load ${item.label}: ${error.message}`);
    }
  };

  useEffect(() => { loadSource('generator'); }, []);

  const filtered = useMemo(() => records.filter(record =>
    (!query || record.search.includes(query.toLocaleLowerCase())) &&
    (!type || record.recordType === type) &&
    (!category || record.category === category) &&
    (!language || record.language === language) &&
    (!errorType || record.errorTypes.includes(errorType))
  ), [records, query, type, category, language, errorType]);

  useEffect(() => { if (!filtered.some(record => record.id === selectedId)) setSelectedId(filtered[0]?.id || ''); }, [filtered, selectedId]);
  const selectedIndex = filtered.findIndex(record => record.id === selectedId);
  const selected = filtered[selectedIndex];
  const move = delta => {
    if (!filtered.length) return;
    setSelectedId(filtered[(selectedIndex + delta + filtered.length) % filtered.length].id);
  };

  const handleFile = async event => {
    const file = event.target.files[0];
    if (!file) return;
    setSource('local');
    acceptText(await file.text(), file.name);
  };

  return (
    <div className="viewer-page">
      <header className="viewer-page-head">
        <div><p className="page-context">Dataset review workspace</p><h1>JSONL Viewer</h1><p>Filter the dataset, select a record, then review the input and expected output at full reading size.</p></div>
        <div className="viewer-source-controls"><label>Repository dataset<select value={source} onChange={event => loadSource(event.target.value)}><option value="local" disabled>Local file</option>{sources.map(item => <option key={item.id} value={item.id}>{item.label} · {item.detail}</option>)}</select></label><label className="file-button">Choose local JSONL<input type="file" accept=".jsonl,.ndjson,application/json,application/x-ndjson" onChange={handleFile} /></label></div>
      </header>

      <div className={`load-status ${loadError ? 'is-error' : ''}`} role={loadError ? 'alert' : 'status'}>{status}</div>

      <section className="filter-strip" aria-label="Dataset filters">
        <label className="search-field">Search records<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Input, output, ID, category, or metadata" /></label>
        <FilterSelect label="Record type" value={type} onChange={setType} options={unique(records, 'recordType')} allLabel="All types" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={unique(records, 'category')} allLabel="All categories" />
        <FilterSelect label="Error type" value={errorType} onChange={setErrorType} options={unique(records, 'errorTypes', true)} allLabel="All errors" />
        <FilterSelect label="Language" value={language} onChange={setLanguage} options={unique(records, 'language')} allLabel="All languages" />
        <button type="button" onClick={() => { setQuery(''); setType(''); setCategory(''); setLanguage(''); setErrorType(''); }}>Clear filters</button>
      </section>

      <div className="review-workspace">
        <aside className="record-browser" aria-label="Filtered records">
          <header><strong>{filtered.length.toLocaleString()}</strong><span>matching records</span></header>
          <div className="record-list">{filtered.slice(0, 1000).map((record, index) => <button key={record.id} type="button" className={record.id === selectedId ? 'is-selected' : ''} onClick={() => setSelectedId(record.id)}><span className="record-ordinal">{String(index + 1).padStart(3, '0')}</span><span className="record-copy"><strong>{record.id}</strong><small>{humanize(record.category)}</small><span className="record-preview">{truncate(record.input, 92)}</span></span></button>)}</div>
        </aside>

        <article className="record-review">
          {selected ? <>
            <header className="record-review-head"><div><p>Record <strong>{selectedIndex + 1}</strong> of <strong>{filtered.length}</strong></p><h2>{selected.id}</h2><span>{humanize(selected.category)} · {humanize(selected.recordType)}</span></div><div className="record-navigation"><button type="button" onClick={() => move(-1)}>Previous</button><button type="button" onClick={() => move(1)}>Next</button></div></header>
            <div className="transcript-comparison">
              <section><header><h3>Raw ASR input</h3><span>{selected.input.split(/\s+/).filter(Boolean).length} words</span></header><div className="transcript-body"><RichText text={selected.input} /></div></section>
              <section><header><h3>Target output</h3><span>{selected.output.split(/\s+/).filter(Boolean).length} words</span></header><div className="transcript-body"><RichText text={selected.output} /></div></section>
            </div>
            <div className="record-metadata"><MetaChip label="Language" value={selected.language} /><MetaChip label="Type" value={selected.recordType} /><MetaChip label="Category" value={selected.category} />{selected.errorTypes.map(value => <MetaChip key={`error-${value}`} label="Error" value={value} />)}{selected.formattingFeatures.map(value => <MetaChip key={`format-${value}`} label="Formatting" value={value} />)}{Object.entries(selected.metadata).filter(([key]) => !['language', 'record_type', 'primary_category', 'error_types', 'formatting_features'].includes(key)).flatMap(([key, value]) => asList(value).map(item => <MetaChip key={`${key}-${item}`} label={humanize(key)} value={item} />))}</div>
            <details className="record-disclosure"><summary>System instruction</summary><p>{selected.system || 'No system instruction in this record.'}</p></details>
            <details className="record-disclosure"><summary>Raw JSON</summary><pre>{JSON.stringify(selected.raw, null, 2)}</pre></details>
          </> : <div className="no-record"><h2>No records match</h2><p>Clear one or more filters to continue reviewing {sourceName}.</p></div>}
        </article>
      </div>
    </div>
  );
}
