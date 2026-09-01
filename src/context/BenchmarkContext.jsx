import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeBenchmarkFairness } from '../lib/benchmarkFairness.js';

const BenchmarkContext = createContext(null);

export function BenchmarkProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dataset, setDataset] = useState('all');
  const [hiddenModelIds, setHiddenModelIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/benchmark.json`)
      .then(response => {
        if (!response.ok) throw new Error(`Benchmark data returned HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => { if (!cancelled) setData(normalizeBenchmarkFairness(payload)); })
      .catch(reason => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ data, error, loading: !data && !error, dataset, setDataset, hiddenModelIds, setHiddenModelIds }), [data, error, dataset, hiddenModelIds]);
  return <BenchmarkContext.Provider value={value}>{children}</BenchmarkContext.Provider>;
}

export function useBenchmark() {
  return useContext(BenchmarkContext);
}
