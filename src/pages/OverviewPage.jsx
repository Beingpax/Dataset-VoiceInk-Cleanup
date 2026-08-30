import { Link } from 'react-router-dom';
import PageState from '../components/PageState.jsx';
import { useBenchmark } from '../context/BenchmarkContext.jsx';

export default function OverviewPage() {
  const { data, loading, error } = useBenchmark();
  if (!data) return <PageState loading={loading} error={error} />;
  const leader = [...data.models].sort((a, b) => b.summary.mean_edit_similarity - a.summary.mean_edit_similarity)[0];

  return (
    <div className="page-stack overview-page">
      <header className="page-hero">
        <p className="page-context">Transcript cleanup research</p>
        <h1>Compare the systems. Inspect every transcript.</h1>
        <p>One application for benchmark evidence, model outputs, JSONL review, and the separate dataset-authoring project.</p>
        <div className="hero-actions">
          <Link className="button primary" to="/viewer">Open JSONL viewer</Link>
          <Link className="button" to="/benchmark">View benchmark</Link>
        </div>
      </header>

      <section className="fact-line" aria-label="Research scope">
        <div><strong>{data.benchmark.sample_count}</strong><span>benchmark cases</span></div>
        <div><strong>{data.models.length}</strong><span>cleanup systems</span></div>
        <div><strong>{data.benchmark.datasets.length}</strong><span>labeled datasets</span></div>
        <div><strong>{(leader.summary.mean_edit_similarity * 100).toFixed(1)}%</strong><span>best mean similarity</span></div>
      </section>

      <section className="editorial-split">
        <div>
          <h2>Two connected projects, kept distinct</h2>
        </div>
        <div className="split-copy">
          <article><h3>Comparison application</h3><p>Aggregate rankings, runtime measurements, per-case evidence, model outputs, and a dedicated JSONL review workspace.</p><Link to="/cases">Inspect benchmark cases</Link></article>
          <article><h3>Dataset generator</h3><p>The cleanup contract, category system, schema, dataset composition, and curated 50-pair demonstration.</p><Link to="/generator">Read dataset guidance</Link></article>
        </div>
      </section>

      <section className="finding-band">
        <div><span>Current benchmark leader</span><strong>{leader.name}</strong></div>
        <p>The ranking is evidence from a fixed 100-case experiment. Dataset-specific views remain available because the two sources were constructed differently.</p>
        <Link to="/methodology">Read methodology</Link>
      </section>
    </div>
  );
}
