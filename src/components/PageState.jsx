export default function PageState({ loading, error }) {
  if (loading) return <div className="page-state"><strong>Loading benchmark data</strong></div>;
  if (error) return <div className="page-state is-error" role="alert"><strong>Benchmark data could not load</strong><p>{error}</p></div>;
  return null;
}
