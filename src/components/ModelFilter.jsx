import { useBenchmark } from '../context/BenchmarkContext.jsx';

export default function ModelFilter() {
  const { data, hiddenModelIds, setHiddenModelIds } = useBenchmark();
  const models = data.models;
  const visibleModels = models.filter(model => !hiddenModelIds.has(model.id));
  const toggleModel = id => setHiddenModelIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
      <fieldset className="benchmark-model-filter" aria-describedby="model-filter-help">
        <legend>Models shown</legend>
        <div className="model-filter-toolbar">
          <p id="model-filter-help">Model selections apply to Benchmark and Cases. Benchmark ranks keep their original positions.</p>
          <div className="model-filter-actions">
            <span role="status">{visibleModels.length} of {models.length} shown</span>
            <button type="button" disabled={visibleModels.length === models.length} onClick={() => setHiddenModelIds(new Set())}>Show all</button>
            <button type="button" disabled={!visibleModels.length} onClick={() => setHiddenModelIds(new Set(models.map(model => model.id)))}>Hide all</button>
          </div>
        </div>
        <div className="model-filter-options">
          {data.models.map(model => <label key={model.id}>
            <input type="checkbox" checked={!hiddenModelIds.has(model.id)} onChange={() => toggleModel(model.id)} />
            <span>{model.name}</span>
          </label>)}
        </div>
      </fieldset>
  );
}
