import { useEffect, useMemo, useState } from 'react';
import PageState from '../components/PageState.jsx';
import Picker from '../components/Picker.jsx';
import RichText from '../components/RichText.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';
import useArrowNavigation from '../hooks/useArrowNavigation.js';

const percent = value => `${(value * 100).toFixed(1)}%`;

export default function CasesPage() {
  const { data, loading, error } = useBenchmark();
  const [dataset, setDataset] = useState('all');
  const [order, setOrder] = useState('source');
  const [selectedId, setSelectedId] = useState('');
  const models = data?.models || [];

  const cases = useMemo(() => {
    if (!models.length) return [];
    const items = models[0].cases.filter(item => dataset === 'all' || item.dataset_id === dataset).map(item => ({ ...item }));
    const scores = id => models.map(model => model.cases.find(item => item.id === id)?.metrics.edit_similarity ?? 0);
    if (order === 'hardest') items.sort((a, b) => Math.min(...scores(a.id)) - Math.min(...scores(b.id)));
    if (order === 'spread') items.sort((a, b) => (Math.max(...scores(b.id)) - Math.min(...scores(b.id))) - (Math.max(...scores(a.id)) - Math.min(...scores(a.id))));
    if (order === 'longest') items.sort((a, b) => b.input_characters - a.input_characters);
    return items;
  }, [models, dataset, order]);

  useEffect(() => { if (!cases.some(item => item.id === selectedId)) setSelectedId(cases[0]?.id || ''); }, [cases, selectedId]);
  const position = Math.max(0, cases.findIndex(item => item.id === selectedId));
  const move = delta => setSelectedId(cases[(position + delta + cases.length) % cases.length]?.id || '');
  useArrowNavigation({ previous: () => move(-1), next: () => move(1), enabled: cases.length > 1 });
  if (!data) return <PageState loading={loading} error={error} />;
  const selected = cases.find(item => item.id === selectedId);

  return (
    <div className="page-stack cases-page">
      <header className="page-heading page-heading-workflow">
        <div><h1>Cases</h1></div>
        <section className="case-controls" aria-label="Case controls">
          <div className="control-fields">
            <Picker label="Dataset" value={dataset} onChange={setDataset} options={[{ value: 'all', label: 'Both datasets' }, ...data.benchmark.datasets.map(item => ({ value: item.id, label: item.name }))]} />
            <Picker label="Case" value={selectedId} onChange={setSelectedId} options={cases.map(item => ({ value: item.id, label: `${item.id} · ${item.input_words} words` }))} />
            <Picker label="Sort cases" value={order} onChange={setOrder} options={[{ value: 'source', label: 'Source order' }, { value: 'hardest', label: 'Hardest first' }, { value: 'spread', label: 'Largest model spread' }, { value: 'longest', label: 'Longest input first' }]} />
          </div>
          <div className="case-actions"><div className="case-position"><strong>{position + 1}</strong><span>of {cases.length}</span></div><div className="case-nav"><button type="button" onClick={() => move(-1)}>Previous</button><button className="primary-action" type="button" onClick={() => move(1)}>Next case</button></div></div>
        </section>
      </header>
      {selected && <>
        <section className="case-reference"><header><span>{selected.id}</span><strong>{selected.dataset_name}</strong><span>{selected.input_words} words</span></header><div className="case-reference-scroll" tabIndex="0" aria-label="Side-by-side transcript comparison. Scroll horizontally on narrow screens."><div className="case-reference-pair"><article><h2>Raw ASR</h2><RichText text={selected.input} /></article><article><h2>Human reference</h2><RichText text={selected.reference} /></article></div></div></section>
        <section className="case-results"><h2>Model responses</h2>{models.map(model => { const result = model.cases.find(item => item.id === selected.id); return <article key={model.id}><header><div><h3>{model.name}</h3><span>{result.metrics.exact_match ? 'Exact match' : `${percent(result.metrics.edit_similarity)} similar`}</span></div><dl><div><dt>chrF++</dt><dd>{percent(result.metrics.chrf)}</dd></div><div><dt>WER</dt><dd>{percent(result.metrics.wer)}</dd></div><div><dt>Latency</dt><dd>{result.performance?.generation_seconds == null ? 'Unavailable' : `${result.performance.generation_seconds.toFixed(3)} s`}</dd></div></dl></header><div className="model-output"><RichText text={result.output || '(empty output)'} /></div></article>; })}</section>
      </>}
    </div>
  );
}
