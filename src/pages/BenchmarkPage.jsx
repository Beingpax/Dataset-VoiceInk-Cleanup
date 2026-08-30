import { useMemo, useState } from 'react';
import PageState from '../components/PageState.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';

const percent = value => value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
const number = (value, digits = 2) => value == null ? 'Unavailable' : Number(value).toFixed(digits);

function QualityPlot({ models, summaryFor }) {
  const width = 960, height = 500, left = 80, right = 900, top = 40, bottom = 430;
  const summaries = models.map(summaryFor);
  const xValues = summaries.map(item => item.mean_edit_similarity);
  const yValues = summaries.map(item => 1 - item.mean_wer);
  const xMin = Math.max(0, Math.min(...xValues) - 0.04), xMax = 1;
  const yMin = Math.max(0, Math.min(...yValues) - 0.08), yMax = 1;
  const x = value => left + ((value - xMin) / (xMax - xMin || 1)) * (right - left);
  const y = value => bottom - ((value - yMin) / (yMax - yMin || 1)) * (bottom - top);
  const colors = ['var(--cyan)', 'var(--coral)', 'var(--yellow)', 'var(--green)'];
  return (
    <svg className="quality-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Edit similarity plotted against word accuracy">
      {[0, .25, .5, .75, 1].map(step => {
        const yy = top + step * (bottom - top);
        return <line key={step} x1={left} x2={right} y1={yy} y2={yy} />;
      })}
      <text x={(left + right) / 2} y="485" textAnchor="middle">Edit similarity</text>
      {models.map((model, index) => {
        const summary = summaryFor(model);
        return <g key={model.id} transform={`translate(${x(summary.mean_edit_similarity)} ${y(1 - summary.mean_wer)})`}>
          <circle r="12" style={{ fill: colors[index] }} />
          <text x="19" y={index % 2 ? 22 : -15}>{model.name.replace(' by Superwhisper', '').replace(' (low reasoning)', '')}</text>
        </g>;
      })}
    </svg>
  );
}

export default function BenchmarkPage() {
  const { data, loading, error } = useBenchmark();
  const [dataset, setDataset] = useState('all');
  const models = useMemo(() => data ? [...data.models].sort((a, b) => {
    const aSummary = dataset === 'all' ? a.summary : a.dataset_summaries[dataset];
    const bSummary = dataset === 'all' ? b.summary : b.dataset_summaries[dataset];
    return bSummary.mean_edit_similarity - aSummary.mean_edit_similarity;
  }) : [], [data, dataset]);
  if (!data) return <PageState loading={loading} error={error} />;
  const summaryFor = model => dataset === 'all' ? model.summary : model.dataset_summaries[dataset];

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div><p className="page-context">Aggregate evidence</p><h1>Benchmark</h1><p>Quality and runtime results for four deliberately different transcript-cleanup configurations.</p></div>
        <label className="header-control">Results dataset<select value={dataset} onChange={event => setDataset(event.target.value)}><option value="all">Combined · 100 cases</option>{data.benchmark.datasets.map(item => <option key={item.id} value={item.id}>{item.name} · {item.count}</option>)}</select></label>
      </header>

      <section className="ranking-section">
        <div className="table-scroll"><table className="ranking-table"><thead><tr><th>Rank / system</th><th>Edit similarity</th><th>chrF++</th><th>WER</th><th>Exact</th><th>Mean latency</th><th>Median tok/s</th><th>Peak memory</th></tr></thead><tbody>{models.map((model, index) => { const summary = summaryFor(model); const memory = model.summary.peak_memory_gib; return <tr key={model.id}><td><span className="rank">{String(index + 1).padStart(2, '0')}</span><strong>{model.name}</strong><small>{model.runtime}</small></td><td>{percent(summary.mean_edit_similarity)}</td><td>{percent(summary.mean_chrf)}</td><td>{percent(summary.mean_wer)}</td><td>{Math.round(summary.exact_match_rate * summary.case_count)}/{summary.case_count}</td><td>{summary.mean_generation_seconds == null ? 'Unavailable' : `${number(summary.mean_generation_seconds, 3)} s`}</td><td>{number(summary.median_tokens_per_second, 1)}</td><td>{memory == null ? 'Provider unavailable' : `${number(memory)} GiB`}</td></tr>; })}</tbody></table></div>
      </section>

      <section className="plot-section"><div className="section-title"><h2>Quality field</h2><p>Rightward is closer to the human reference. Upward means fewer word errors.</p></div><QualityPlot models={models} summaryFor={summaryFor} /></section>

      <section className="model-list"><div className="section-title"><h2>Configurations</h2><p>The prompt and runtime are part of each benchmark system.</p></div>{models.map((model, index) => <article key={model.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{model.name}</h3><strong>{model.runtime}</strong></div><p>{model.prompt_mode}</p></article>)}</section>
    </div>
  );
}
