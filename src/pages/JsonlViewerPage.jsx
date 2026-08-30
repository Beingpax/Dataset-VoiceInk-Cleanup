import { useEffect, useMemo, useRef, useState } from 'react';
import RichText from '../components/RichText.jsx';
import Picker from '../components/Picker.jsx';
import ErrorTypeFilter from '../components/ErrorTypeFilter.jsx';
import { asList, errorLabel, humanize, matchesErrors, parseJsonl } from '../utils/jsonl.js';
import useArrowNavigation from '../hooks/useArrowNavigation.js';

const sources = [
  { id: 'benchmark', label: 'Benchmark corpus', detail: '100 labeled cases', paths: ['data/benchmark-sample.jsonl'] },
];

function unique(records, key, flatten = false) {
  return [...new Set(records.flatMap(record => flatten ? record[key] : [record[key]]).filter(Boolean))].sort();
}

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return <Picker label={label} value={value} onChange={onChange} options={[{ value: '', label: allLabel }, ...options.map(option => ({ value: option, label: humanize(option) }))]} />;
}

function MetaChip({ label, value }) {
  return <span><strong>{label === 'Error' ? 'Error type' : label}:</strong> {label === 'Error' ? errorLabel(value) : humanize(value)}</span>;
}

export default function JsonlViewerPage() {
  const [records, setRecords] = useState([]);
  const [source, setSource] = useState('benchmark');
  const [sourceName, setSourceName] = useState('Benchmark corpus');
  const [status, setStatus] = useState('Loading benchmark corpus…');
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [errorTypes, setErrorTypes] = useState([]);
  const [errorMatchMode, setErrorMatchMode] = useState('any');
  const [selectedId, setSelectedId] = useState('');
  const recordRailRef = useRef(null);

  const acceptText = (text, name) => {
    try {
      const result = parseJsonl(text);
      setRecords(result.records);
      setSourceName(name);
      setSelectedId(result.records[0]?.id || '');
      setQuery(''); setType(''); setCategory(''); setLanguage(''); setErrorTypes([]); setErrorMatchMode('any');
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
      const texts = await Promise.all(item.paths.map(async path => {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) throw new Error(`HTTP ${response.status} (${path})`);
        return response.text();
      }));
      acceptText(texts.join('\n'), item.label);
    } catch (error) {
      setLoadError(true); setStatus(`Could not load ${item.label}: ${error.message}`);
    }
  };

  useEffect(() => { loadSource('benchmark'); }, []);

  const categoryOptions = useMemo(() => {
    const counts = new Map();
    records.forEach(record => counts.set(record.category, (counts.get(record.category) || 0) + 1));
    return [...counts.entries()]
      .sort(([a, countA], [b, countB]) => countB - countA || humanize(a).localeCompare(humanize(b)))
      .map(([value, count]) => ({ value, label: `${humanize(value)} (${count.toLocaleString()})` }));
  }, [records]);

  const filtered = useMemo(() => records.filter(record =>
    (!query || record.search.includes(query.toLocaleLowerCase())) &&
    (!type || record.recordType === type) &&
    (!category || record.category === category) &&
    (!language || record.language === language) &&
    matchesErrors(record, errorTypes, errorMatchMode)
  ), [records, query, type, category, language, errorTypes, errorMatchMode]);

  useEffect(() => { if (!filtered.some(record => record.id === selectedId)) setSelectedId(filtered[0]?.id || ''); }, [filtered, selectedId]);
  useEffect(() => {
    const selectedButton = recordRailRef.current?.querySelector('[aria-selected="true"]');
    selectedButton?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  }, [selectedId]);
  const selectedIndex = filtered.findIndex(record => record.id === selectedId);
  const selected = filtered[selectedIndex];
  const move = delta => {
    if (!filtered.length) return;
    setSelectedId(filtered[(selectedIndex + delta + filtered.length) % filtered.length].id);
  };
  useArrowNavigation({ previous: () => move(-1), next: () => move(1), enabled: filtered.length > 1 });

  const handleFile = async event => {
    const file = event.target.files[0];
    if (!file) return;
    setSource('local');
    acceptText(await file.text(), file.name);
  };

  return (
    <div className="viewer-page">
      <header className="viewer-page-head">
        <div><h1>JSONL Viewer</h1></div>
        <section className="viewer-source-bar" aria-label="Dataset source">
          <Picker label="Dataset source" value={source} onChange={loadSource} options={[{ value: 'local', label: 'Local file', disabled: true }, ...sources.map(item => ({ value: item.id, label: `${item.label} · ${item.detail}` }))]} />
          <label className="file-button">Open local JSONL<input type="file" accept=".jsonl,.ndjson,application/json,application/x-ndjson" onChange={handleFile} /></label>
          <div className={`load-status ${loadError ? 'is-error' : ''}`} role={loadError ? 'alert' : 'status'}>{status}</div>
        </section>
      </header>

      <section className="filter-strip" aria-label="Dataset filters">
        <label className="search-field">Search records<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Input, output, ID, category, or metadata" /></label>
        <FilterSelect label="Record type" value={type} onChange={setType} options={unique(records, 'recordType')} allLabel="All types" />
        <Picker label="Category" value={category} onChange={setCategory} options={[{ value: '', label: 'All categories' }, ...categoryOptions]} />
        <FilterSelect label="Language" value={language} onChange={setLanguage} options={unique(records, 'language')} allLabel="All languages" />
        <button type="button" onClick={() => { setQuery(''); setType(''); setCategory(''); setLanguage(''); setErrorTypes([]); setErrorMatchMode('any'); }}>Clear filters</button>
      </section>

      <ErrorTypeFilter options={unique(records, 'errorTypes', true)} values={errorTypes} onChange={setErrorTypes} mode={errorMatchMode} onModeChange={setErrorMatchMode} />

      <div className="record-selector">
        <header><strong>{filtered.length.toLocaleString()}</strong><span>matching records</span><small>Scroll horizontally to select</small></header>
        <div className="record-rail" ref={recordRailRef} role="listbox" aria-label="Filtered records" aria-orientation="horizontal">
          {filtered.slice(0, 1000).map((record, index) => <button key={record.id} type="button" role="option" aria-selected={record.id === selectedId} className={record.id === selectedId ? 'is-selected' : ''} onClick={() => setSelectedId(record.id)}><span className="record-ordinal">{String(index + 1).padStart(3, '0')}</span><span className="record-copy"><strong>{record.id}</strong><small>{humanize(record.category)}</small></span></button>)}
        </div>
      </div>

      <div className="review-workspace">
        <article className="record-review">
          {selected ? <>
            <header className="record-review-head"><div><p>Record <strong>{selectedIndex + 1}</strong> of <strong>{filtered.length}</strong></p><h2>{selected.id}</h2><span>{humanize(selected.category)} · {humanize(selected.recordType)}</span></div><div className="record-navigation"><button type="button" onClick={() => move(-1)}>Previous</button><button className="primary-action" type="button" onClick={() => move(1)}>Next record</button></div></header>
            <div className="transcript-comparison-scroll" tabIndex="0" aria-label="Side-by-side transcript comparison. Scroll horizontally on narrow screens."><div className="transcript-comparison">
              <section><header><h3>Raw ASR input</h3><span>{selected.input.split(/\s+/).filter(Boolean).length} words</span></header><div className="transcript-body"><RichText text={selected.input} /></div></section>
              <section><header><h3>Target output</h3><span>{selected.output.split(/\s+/).filter(Boolean).length} words</span></header><div className="transcript-body"><RichText text={selected.output} /></div></section>
            </div></div>
            <div className="record-metadata"><MetaChip label="Language" value={selected.language} /><MetaChip label="Type" value={selected.recordType} /><MetaChip label="Category" value={selected.category} />{selected.errorTypes.map(value => <MetaChip key={`error-${value}`} label="Error" value={value} />)}{selected.formattingFeatures.map(value => <MetaChip key={`format-${value}`} label="Formatting" value={value} />)}{Object.entries(selected.metadata).filter(([key]) => !['language', 'record_type', 'primary_category', 'error_types', 'formatting_features'].includes(key)).flatMap(([key, value]) => asList(value).map(item => <MetaChip key={`${key}-${item}`} label={humanize(key)} value={item} />))}</div>
            <details className="record-disclosure"><summary>System instruction</summary><p>{selected.system || 'No system instruction in this record.'}</p></details>
            <details className="record-disclosure"><summary>Raw JSON</summary><pre>{JSON.stringify(selected.raw, null, 2)}</pre></details>
          </> : <div className="no-record"><h2>No records match</h2><p>Clear one or more filters to continue reviewing {sourceName}.</p></div>}
        </article>
      </div>
    </div>
  );
}
