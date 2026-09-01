import { useEffect, useMemo, useState } from 'react';
import Picker from '../components/Picker.jsx';
import RichText from '../components/RichText.jsx';

const label = value => String(value || '').replaceAll('_', ' ');
const percent = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'Unavailable';

export default function PromptOutputPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [prompt, setPrompt] = useState('all');
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    fetch('/data/voiceink-prompt-output.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Prompt-output data returned HTTP ${response.status}`);
        return response.json();
      })
      .then(payload => {
        setData(payload);
        setCaseId(payload.cases?.[0]?.id || '');
      })
      .catch(reason => setError(reason.message));
  }, []);

  const categories = useMemo(() => [...new Set(data?.cases?.map(item => item.category) || [])].sort(), [data]);
  const cases = useMemo(() => (data?.cases || []).filter(item =>
    (category === 'all' || item.category === category) &&
    (prompt === 'all' || item.prompt_type === prompt)
  ), [data, category, prompt]);
  const selected = cases.find(item => item.id === caseId) || cases[0];
  const position = Math.max(0, cases.findIndex(item => item.id === selected?.id));

  useEffect(() => {
    if (cases.length && !cases.some(item => item.id === caseId)) setCaseId(cases[0].id);
  }, [cases, caseId]);

  useEffect(() => {
    const move = event => {
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName) || cases.length < 2) return;
      if (event.key === 'ArrowLeft') setCaseId(cases[(position - 1 + cases.length) % cases.length].id);
      if (event.key === 'ArrowRight') setCaseId(cases[(position + 1) % cases.length].id);
    };
    window.addEventListener('keydown', move);
    return () => window.removeEventListener('keydown', move);
  }, [cases, position]);

  if (error) return <div className="page-stack"><div className="page-heading"><div><h1>Prompt Output</h1><p>{error}</p></div></div></div>;
  if (!data) return <div className="page-stack"><div className="page-heading"><div><h1>Prompt Output</h1><p>Loading prompt evaluation data…</p></div></div></div>;

  const move = offset => setCaseId(cases[(position + offset + cases.length) % cases.length].id);
  return (
    <div className="page-stack prompt-output-page">
      <header className="page-heading prompt-output-heading">
        <div><h1>VoiceInk prompt output</h1><p>Default and Email prompt results generated through VoiceInk, stored with the dataset evidence.</p></div>
        <div className="prompt-output-controls">
          <Picker label="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...categories.map(value => ({ value, label: label(value) }))]} />
          <Picker label="Prompt" value={prompt} onChange={setPrompt} options={[{ value: 'all', label: 'Both prompts' }, { value: 'default', label: 'Default' }, { value: 'email', label: 'Email' }]} />
          <Picker label="Case" value={selected?.id || ''} onChange={setCaseId} options={cases.map(item => ({ value: item.id, label: `${item.id} · ${label(item.category)}` }))} />
          <div className="case-actions"><span className="case-position"><strong>{cases.length ? position + 1 : 0}</strong><span>of {cases.length}</span></span><div className="case-nav"><button type="button" onClick={() => move(-1)} disabled={cases.length < 2}>Previous</button><button className="primary" type="button" onClick={() => move(1)} disabled={cases.length < 2}>Next case</button></div></div>
        </div>
      </header>
      {selected ? <>
        <div className="case-meta"><span>{selected.id}</span><strong>{label(selected.category)}</strong><span>{selected.prompt_type} prompt</span></div>
        <section className="prompt-output-comparison">
          <article><h2>Raw ASR input</h2><div className="prompt-output-copy"><RichText text={selected.input} /></div></article>
          <article><h2>Reference output</h2><div className="prompt-output-copy"><RichText text={selected.reference} /></div></article>
        </section>
        <section className="prompt-output-result">
          <header><div><h2>VoiceInk output</h2><p>{data.model} · {data.provider}</p></div><strong>{selected.metrics?.exact_match ? 'Exact match' : `${percent(selected.metrics?.edit_similarity)} similar`}</strong></header>
          <div className="prompt-output-copy"><RichText text={selected.voiceink_output} /></div>
          <dl><div><dt>chrF++</dt><dd>{percent(selected.metrics?.chrf)}</dd></div><div><dt>WER</dt><dd>{percent(selected.metrics?.wer)}</dd></div><div><dt>Latency</dt><dd>{selected.latency_ms ? `${(selected.latency_ms / 1000).toFixed(3)} s` : 'Unavailable'}</dd></div></dl>
        </section>
        <details className="prompt-disclosure"><summary>View final constructed {selected.prompt_type} prompt</summary><pre>{data.prompts?.[selected.prompt_type]}</pre></details>
      </> : <section className="prompt-output-empty"><h2>No matching cases</h2><p>Change the category or prompt filter.</p></section>}
    </div>
  );
}
