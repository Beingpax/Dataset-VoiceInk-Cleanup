import { useEffect, useMemo, useRef, useState } from 'react';
import PageState from '../components/PageState.jsx';
import ModelFilter from '../components/ModelFilter.jsx';
import Picker from '../components/Picker.jsx';
import RichText from '../components/RichText.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';
import useArrowNavigation from '../hooks/useArrowNavigation.js';
import { hasRecordedOutput } from '../lib/benchmarkFairness.js';

const percent = value => value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;

export default function CasesPage() {
  const { data, loading, error, dataset, setDataset, hiddenModelIds } = useBenchmark();
  const [order, setOrder] = useState('source');
  const [selectedId, setSelectedId] = useState('');
  const responsesRef = useRef(null);
  const [responseEdges, setResponseEdges] = useState({ start: true, end: true });
  const models = data?.models || [];
  const visibleModels = useMemo(() => models.filter(model => !hiddenModelIds.has(model.id)), [models, hiddenModelIds]);

  const cases = useMemo(() => {
    if (!models.length) return [];
    const recordedCases = new Map();
    for (const model of models) for (const item of model.cases) {
      if ((dataset === 'all' || item.dataset_id === dataset) && !recordedCases.has(item.id)) recordedCases.set(item.id, { ...item });
    }
    const items = [...recordedCases.values()];
    const scores = id => {
      const values = visibleModels.map(model => model.cases.find(item => item.id === id))
        .filter(hasRecordedOutput).map(result => result.metrics?.edit_similarity).filter(Number.isFinite);
      return values.length ? values : [0];
    };
    if (order === 'hardest') items.sort((a, b) => Math.min(...scores(a.id)) - Math.min(...scores(b.id)));
    if (order === 'spread') items.sort((a, b) => (Math.max(...scores(b.id)) - Math.min(...scores(b.id))) - (Math.max(...scores(a.id)) - Math.min(...scores(a.id))));
    if (order === 'longest') items.sort((a, b) => b.input_characters - a.input_characters);
    return items;
  }, [models, visibleModels, dataset, order]);

  useEffect(() => { if (!cases.some(item => item.id === selectedId)) setSelectedId(cases[0]?.id || ''); }, [cases, selectedId]);
  const position = Math.max(0, cases.findIndex(item => item.id === selectedId));
  const move = delta => setSelectedId(cases[(position + delta + cases.length) % cases.length]?.id || '');
  useArrowNavigation({ previous: () => move(-1), next: () => move(1), enabled: cases.length > 1 });
  useEffect(() => {
    const rail = responsesRef.current;
    if (!rail) return undefined;
    const updateEdges = () => setResponseEdges({
      start: rail.scrollLeft <= 1,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
    });
    rail.scrollLeft = 0;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [selectedId, visibleModels]);
  if (!data) return <PageState loading={loading} error={error} />;
  const selected = cases.find(item => item.id === selectedId);

  const scrollResponses = direction => {
    const rail = responsesRef.current;
    if (!rail) return;
    const panel = rail.querySelector('article');
    rail.scrollBy({ left: direction * ((panel?.getBoundingClientRect().width || rail.clientWidth) + 1) });
  };

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
      <details className="case-filter-toggle">
        <summary>Filter models <span>{visibleModels.length} of {models.length}</span></summary>
        <ModelFilter />
      </details>
      {selected && <>
        <section className="case-reference"><header><span>{selected.id}</span><strong>{selected.dataset_name}</strong><span>{selected.input_words} words</span></header><div className="case-reference-scroll" tabIndex="0" aria-label="Side-by-side transcript comparison. Scroll horizontally on narrow screens."><div className="case-reference-pair"><article><h2 id="case-input-heading">Raw ASR</h2><div key={`${selected.id}-input`} className="case-sample-text" role="region" tabIndex="0" aria-labelledby="case-input-heading"><RichText text={selected.input} /></div></article><article><h2 id="case-reference-heading">Reference</h2><div key={`${selected.id}-reference`} className="case-sample-text" role="region" tabIndex="0" aria-labelledby="case-reference-heading"><RichText text={selected.reference} /></div></article></div></div></section>
        <section className="case-results">
          <header className="case-results-heading">
            <div><h2 id="model-responses-heading">Model responses</h2><p id="model-responses-help">{visibleModels.length} of {models.length} models shown. Scroll horizontally for more responses.</p></div>
            <div className="case-response-nav" hidden={!visibleModels.length} aria-label="Model response navigation">
              <button type="button" aria-label="Previous model responses" aria-controls="model-response-scroll" disabled={responseEdges.start} onClick={() => scrollResponses(-1)}>←</button>
              <button type="button" aria-label="Next model responses" aria-controls="model-response-scroll" disabled={responseEdges.end} onClick={() => scrollResponses(1)}>→</button>
            </div>
          </header>
          {!visibleModels.length && <p className="empty-copy">No models selected. Turn on a model above to see its response.</p>}
          <div className="case-response-scroll" id="model-response-scroll" ref={responsesRef} role="region" tabIndex="0" aria-labelledby="model-responses-heading" aria-describedby="model-responses-help" onScroll={event => {
            const rail = event.currentTarget;
            setResponseEdges({ start: rail.scrollLeft <= 1, end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1 });
          }} onKeyDown={event => {
            // Let native arrow scrolling work without changing the selected case.
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation();
          }}>{visibleModels.map(model => {
          const result = model.cases.find(item => item.id === selected.id);
          const completed = hasRecordedOutput(result);
          const metrics = completed ? result.metrics : null;
          return <article key={model.id}>
            <header><div className="model-response-title"><h3>{model.name}</h3><span>{!completed ? 'Failed / missing result' : metrics?.edit_similarity == null ? 'Quality unavailable' : `${percent(metrics.edit_similarity)} similar`}</span></div>
              {model.comparison?.note && <p className="empty-copy">{model.comparison.note}</p>}

            </header>
            <div className="model-output">{!completed && <p className="empty-copy">{result?.error || 'No text output was recorded for this case.'}</p>}<RichText text={typeof result?.output === 'string' && result.output ? result.output : completed ? '(empty output)' : '(no completed output)'} /></div>
            <footer className="model-response-metrics"><dl><div><dt>chrF++</dt><dd>{percent(metrics?.chrf)}</dd></div><div><dt>WER</dt><dd>{percent(metrics?.wer)}</dd></div><div><dt>Latency</dt><dd>{!completed || result.performance?.generation_seconds == null ? 'Unavailable' : `${result.performance.generation_seconds.toFixed(3)} s`}</dd></div></dl></footer>
          </article>;
        })}</div></section>
      </>}
    </div>
  );
}
