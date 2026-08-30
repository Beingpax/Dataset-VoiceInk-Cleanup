import { useEffect, useMemo, useState } from 'react';
import PageState from '../components/PageState.jsx';
import RichText from '../components/RichText.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';

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
  if (!data) return <PageState loading={loading} error={error} />;
  const selected = cases.find(item => item.id === selectedId);
  const position = Math.max(0, cases.findIndex(item => item.id === selectedId));
  const move = delta => setSelectedId(cases[(position + delta + cases.length) % cases.length]?.id || '');

  return (
    <div className="page-stack cases-page">
      <header className="page-heading"><div><p className="page-context">Per-case evidence</p><h1>Cases</h1><p>Inspect the raw transcript, human reference, four responses, quality scores, and measured generation performance.</p></div><div className="case-position"><strong>{position + 1}</strong><span>of {cases.length}</span></div></header>
      <div className="case-controls">
        <label>Dataset<select value={dataset} onChange={event => setDataset(event.target.value)}><option value="all">Both datasets</option>{data.benchmark.datasets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Case<select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{cases.map(item => <option key={item.id} value={item.id}>{item.id} · {item.input_words} words</option>)}</select></label>
        <label>Order<select value={order} onChange={event => setOrder(event.target.value)}><option value="source">Source order</option><option value="hardest">Hardest first</option><option value="spread">Largest model spread</option><option value="longest">Longest input first</option></select></label>
        <div className="case-nav"><button type="button" onClick={() => move(-1)}>Previous case</button><button type="button" onClick={() => move(1)}>Next case</button></div>
      </div>
      {selected && <>
        <section className="case-reference"><header><span>{selected.id}</span><strong>{selected.dataset_name}</strong><span>{selected.input_words} words</span></header><div><article><h2>Raw ASR</h2><RichText text={selected.input} /></article><article><h2>Human reference</h2><RichText text={selected.reference} /></article></div></section>
        <section className="case-results"><h2>Model responses</h2>{models.map(model => { const result = model.cases.find(item => item.id === selected.id); return <article key={model.id}><header><div><h3>{model.name}</h3><span>{result.metrics.exact_match ? 'Exact match' : `${percent(result.metrics.edit_similarity)} similar`}</span></div><dl><div><dt>chrF++</dt><dd>{percent(result.metrics.chrf)}</dd></div><div><dt>WER</dt><dd>{percent(result.metrics.wer)}</dd></div><div><dt>Latency</dt><dd>{result.performance?.generation_seconds == null ? 'Unavailable' : `${result.performance.generation_seconds.toFixed(3)} s`}</dd></div></dl></header><div className="model-output"><RichText text={result.output || '(empty output)'} /></div></article>; })}</section>
      </>}
    </div>
  );
}
