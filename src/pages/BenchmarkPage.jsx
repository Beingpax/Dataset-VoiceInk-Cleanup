import { useMemo, useState } from 'react';
import PageState from '../components/PageState.jsx';
import Picker from '../components/Picker.jsx';
import QualityPlot from '../components/QualityPlot.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';
import { isRanked, rankingNote } from '../lib/benchmarkFairness.js';

const percent = value => value == null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
const number = (value, digits = 2) => value == null ? 'Unavailable' : Number(value).toFixed(digits);

export default function BenchmarkPage() {
  const { data, loading, error } = useBenchmark();
  const [dataset, setDataset] = useState('all');
  const models = useMemo(() => data ? [...data.models].sort((a, b) => {
    const aSummary = dataset === 'all' ? a.summary : a.dataset_summaries?.[dataset];
    const bSummary = dataset === 'all' ? b.summary : b.dataset_summaries?.[dataset];
    return Number(isRanked(b, bSummary)) - Number(isRanked(a, aSummary))
      || (bSummary?.mean_edit_similarity ?? -Infinity) - (aSummary?.mean_edit_similarity ?? -Infinity)
      || a.name.localeCompare(b.name);
  }) : [], [data, dataset]);
  if (!data) return <PageState loading={loading} error={error} />;
  const summaryFor = model => dataset === 'all' ? model.summary : model.dataset_summaries[dataset];
  const rankedModels = models.filter(model => isRanked(model, summaryFor(model)));

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div><h1>Benchmark</h1></div>
        <div className="heading-controls">
          <Picker label="Dataset view" value={dataset} onChange={setDataset} options={[{ value: 'all', label: `Combined · ${data.benchmark.sample_count} cases` }, ...data.benchmark.datasets.map(item => ({ value: item.id, label: `${item.name} · ${item.count}` }))]} />
        </div>
      </header>

      <section className="ranking-section" aria-label="System ranking">
        <p className="empty-copy" id="ranking-scope">Ranks and the quality chart include complete runs with no known reference-derived hints. Quality averages use successful cases; completion and exact totals include every expected case. Model-native prompts differ, so ranks compare configurations.</p>
        <div className="table-scroll"><table className="ranking-table" aria-describedby="ranking-scope"><thead><tr><th>Rank / configuration</th><th>Completed / expected</th><th>Failed / missing</th><th>Edit similarity</th><th>chrF++</th><th>WER</th><th>Exact / expected</th><th>Mean latency</th><th>Median tok/s</th><th>Peak memory</th></tr></thead><tbody>{models.map((model, index) => {
          const summary = summaryFor(model);
          const memory = model.summary.peak_memory_gib;
          const note = rankingNote(model, summary);
          return <tr key={model.id}>
            <td>{!note && <span className="rank">{String(index + 1).padStart(2, '0')}</span>}<strong>{model.name}</strong><small>{model.runtime}</small>{note && <small>{note}</small>}</td>
            <td>{summary.successful_cases}/{summary.case_count}</td>
            <td>{summary.failed_cases}</td>
            <td>{percent(summary.mean_edit_similarity)}</td>
            <td>{percent(summary.mean_chrf)}</td>
            <td>{percent(summary.mean_wer)}</td>
            <td>{summary.exact_matches}/{summary.case_count}</td>
            <td>{summary.mean_generation_seconds == null ? 'Unavailable' : `${number(summary.mean_generation_seconds, 3)} s`}</td>
            <td>{number(summary.median_tokens_per_second, 1)}</td>
            <td>{memory == null ? 'Provider unavailable' : `${number(memory)} GiB`}</td>
          </tr>;
        })}</tbody></table></div>
      </section>

      <section className="plot-section" aria-labelledby="quality-field-heading"><div className="section-title quality-section-title"><h2 id="quality-field-heading">Quality field</h2><span className="quality-direction">Better <span aria-hidden="true">↗</span></span></div>{rankedModels.length ? <QualityPlot key={dataset} models={rankedModels} summaryFor={summaryFor} /> : <p className="empty-copy">No complete, reference-blind runs are available for this dataset. Recorded results remain in the table above.</p>}</section>

      <section className="model-list"><div className="section-title"><h2>Configurations</h2></div>{models.map((model, index) => <article key={model.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{model.name}</h3><strong>{model.runtime}</strong></div><p>{model.prompt_mode}</p></article>)}</section>
    </div>
  );
}
