import { Link } from 'react-router-dom';
import PageState from '../components/PageState.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';
import { isRanked } from '../lib/benchmarkFairness.js';

export default function OverviewPage() {
  const { data, loading, error } = useBenchmark();
  if (!data) return <PageState loading={loading} error={error} />;
  const leader = data.models.filter(model => isRanked(model)).sort((a, b) => b.summary.mean_edit_similarity - a.summary.mean_edit_similarity)[0];

  return (
    <div className="page-stack overview-page">
      <header className="page-hero">
        <div className="hero-copy">
          <h1>Compare the systems. Inspect every transcript.</h1>
          <div className="hero-actions">
            <Link className="button primary" to="/viewer">Open JSONL viewer</Link>
            <Link className="button" to="/benchmark">View benchmark</Link>
          </div>
        </div>
        <section className="fact-line" aria-label="Research scope">
          <div><strong>{data.benchmark.sample_count}</strong><span>benchmark cases</span></div>
          <div><strong>{data.models.length}</strong><span>cleanup systems</span></div>
          <div><strong>{data.benchmark.datasets.length}</strong><span>labeled datasets</span></div>
          <div><strong>{leader ? `${(leader.summary.mean_edit_similarity * 100).toFixed(1)}%` : 'Unavailable'}</strong><span>best ranked similarity</span></div>
        </section>
      </header>

      <section className="editorial-split">
        <div>
          <h2>Two connected projects, kept distinct</h2>
        </div>
        <div className="split-copy">
          <article><h3>Comparison application</h3><p>Aggregate rankings, runtime measurements, per-case evidence, model outputs, and a dedicated JSONL review workspace.</p><Link to="/cases">Inspect benchmark cases</Link></article>
          <article><h3>Dataset generator</h3><p>The cleanup contract, category system, schema, and planned dataset composition.</p><Link to="/generator">Read dataset guidance</Link></article>
        </div>
      </section>

      <section className="finding-band">
        <div><span>Highest ranked configuration</span><strong>{leader?.name || 'No eligible complete run'}</strong></div>
        <p>Ranks require complete runs with no known reference-derived hints. Model-native prompts differ, and the two dataset sources remain separately labeled. Historical and incomplete results remain available for inspection.</p>
        <Link to="/methodology">Read methodology</Link>
      </section>
    </div>
  );
}
