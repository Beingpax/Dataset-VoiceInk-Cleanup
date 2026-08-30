import { useMemo, useState } from 'react';
import PageState from '../components/PageState.jsx';
import Picker from '../components/Picker.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';

const percent = value => value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
const number = (value, digits = 2) => value == null ? 'Unavailable' : Number(value).toFixed(digits);

function QualityPlot({ models, summaryFor }) {
  const width = 1100, height = 580, left = 92, right = 1040, top = 64, bottom = 490;
  const summaries = models.map(summaryFor);
  const xValues = summaries.map(item => item.mean_edit_similarity);
  const yValues = summaries.map(item => 1 - item.mean_wer);
  const xMin = Math.max(0, Math.floor((Math.min(...xValues) - 0.02) * 20) / 20), xMax = 1;
  const yMin = Math.max(0, Math.floor((Math.min(...yValues) - 0.05) * 10) / 10), yMax = 1;
  const x = value => left + ((value - xMin) / (xMax - xMin || 1)) * (right - left);
  const y = value => bottom - ((value - yMin) / (yMax - yMin || 1)) * (bottom - top);
  const steps = count => Array.from({ length: count }, (_, index) => index / (count - 1));
  const xTicks = steps(5).map(step => xMin + step * (xMax - xMin));
  const yTicks = steps(6).map(step => yMin + step * (yMax - yMin));
  const modelColor = model => ({
    'gpt-5.6-sol-low': 'var(--accent)',
    'voiceink-refine-v1': 'var(--coral)',
    's1-mini': 'var(--green)',
    'speakoflow-mini': 'var(--yellow)',
  }[model.id] || 'var(--accent)');
  const shortName = name => name.replace(' by Superwhisper', '').replace(' (low reasoning)', '');
  return (
    <div className="quality-panel">
      <div className="quality-chart-head"><span>Performance map</span><strong>Higher and farther right is better</strong></div>
      <div className="quality-chart-scroll" tabIndex="0" aria-label="Quality chart. Scroll horizontally on narrow screens.">
      <svg className="quality-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="quality-chart-title quality-chart-description">
      <title id="quality-chart-title">Model quality by edit similarity and word accuracy</title>
      <desc id="quality-chart-description">Each model is positioned by mean edit similarity on the horizontal axis and one minus word error rate on the vertical axis. Higher and farther right indicates better agreement with human references.</desc>
      <rect className="quality-zone" x={x(.95)} y={y(1)} width={right - x(.95)} height={y(.9) - y(1)} rx="8" />
      <text className="quality-zone-label" x={right - 14} y={top + 22} textAnchor="end">High quality zone</text>
      {yTicks.map(value => <g className="quality-grid" key={`y-${value}`}><line x1={left} x2={right} y1={y(value)} y2={y(value)} /><text x={left - 14} y={y(value) + 4} textAnchor="end">{Math.round(value * 100)}%</text></g>)}
      {xTicks.map(value => <g className="quality-grid" key={`x-${value}`}><line x1={x(value)} x2={x(value)} y1={top} y2={bottom} /><text x={x(value)} y={bottom + 28} textAnchor="middle">{Math.round(value * 100)}%</text></g>)}
      <line className="quality-axis" x1={left} x2={right} y1={bottom} y2={bottom} />
      <line className="quality-axis" x1={left} x2={left} y1={top} y2={bottom} />
      <text className="quality-axis-title" x={(left + right) / 2} y="558" textAnchor="middle">Edit similarity to human reference</text>
      <text className="quality-axis-title" transform={`translate(24 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Word accuracy (1 − WER)</text>
      {models.map(model => {
        const summary = summaryFor(model);
        const px = x(summary.mean_edit_similarity), py = y(1 - summary.mean_wer);
        const labelX = px > 820 ? px - 168 : px + 18;
        const labelY = Math.min(bottom - 56, Math.max(top + 8, py - 27));
        return <g className="quality-point" key={model.id}>
          <title>{`${model.name}: ${percent(summary.mean_edit_similarity)} edit similarity, ${percent(1 - summary.mean_wer)} word accuracy`}</title>
          <circle className="quality-halo" cx={px} cy={py} r="17" style={{ fill: modelColor(model) }} />
          <circle cx={px} cy={py} r="8" style={{ fill: modelColor(model) }} />
          <g className="quality-direct-label" transform={`translate(${labelX} ${labelY})`}>
            <rect width="150" height="52" rx="8" />
            <circle cx="13" cy="16" r="4" style={{ fill: modelColor(model) }} />
            <text className="quality-model-name" x="24" y="20">{shortName(model.name)}</text>
            <text className="quality-model-value" x="13" y="39">{percent(summary.mean_edit_similarity)} sim · {percent(1 - summary.mean_wer)} accuracy</text>
          </g>
        </g>;
      })}
      </svg>
      </div>
      <div className="quality-key" aria-label="Exact chart values">
        {models.map(model => { const summary = summaryFor(model); return <div key={model.id}><span className="quality-swatch" style={{ background: modelColor(model) }} /><strong>{shortName(model.name)}</strong><span>{percent(summary.mean_edit_similarity)} similarity</span><span>{percent(summary.mean_wer)} WER</span></div>; })}
      </div>
    </div>
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
        <div><h1>Benchmark</h1></div>
        <div className="heading-controls">
          <Picker label="Dataset view" value={dataset} onChange={setDataset} options={[{ value: 'all', label: 'Combined · 100 cases' }, ...data.benchmark.datasets.map(item => ({ value: item.id, label: `${item.name} · ${item.count}` }))]} />
        </div>
      </header>

      <section className="ranking-section" aria-label="System ranking">
        <div className="table-scroll"><table className="ranking-table"><thead><tr><th>Rank / system</th><th>Edit similarity</th><th>chrF++</th><th>WER</th><th>Exact</th><th>Mean latency</th><th>Median tok/s</th><th>Peak memory</th></tr></thead><tbody>{models.map((model, index) => { const summary = summaryFor(model); const memory = model.summary.peak_memory_gib; return <tr key={model.id}><td><span className="rank">{String(index + 1).padStart(2, '0')}</span><strong>{model.name}</strong><small>{model.runtime}</small></td><td>{percent(summary.mean_edit_similarity)}</td><td>{percent(summary.mean_chrf)}</td><td>{percent(summary.mean_wer)}</td><td>{Math.round(summary.exact_match_rate * summary.case_count)}/{summary.case_count}</td><td>{summary.mean_generation_seconds == null ? 'Unavailable' : `${number(summary.mean_generation_seconds, 3)} s`}</td><td>{number(summary.median_tokens_per_second, 1)}</td><td>{memory == null ? 'Provider unavailable' : `${number(memory)} GiB`}</td></tr>; })}</tbody></table></div>
      </section>

      <section className="plot-section"><div className="section-title"><h2>Quality field</h2></div><QualityPlot models={models} summaryFor={summaryFor} /></section>

      <section className="model-list"><div className="section-title"><h2>Configurations</h2></div>{models.map((model, index) => <article key={model.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{model.name}</h3><strong>{model.runtime}</strong></div><p>{model.prompt_mode}</p></article>)}</section>
    </div>
  );
}
