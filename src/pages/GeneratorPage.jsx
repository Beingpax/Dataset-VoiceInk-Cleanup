import { Link } from 'react-router-dom';

const coverage = ['Punctuation and capitalization', 'Fillers, repetitions, and stutters', 'False starts and self-corrections', 'Numbers, dates, times, and currency', 'Emails, URLs, filenames, and identifiers', 'Paragraphs, headings, lists, and quotations', 'Greetings and sign-offs', 'Literal formatting-command words'];

export default function GeneratorPage() {
  return (
    <div className="page-stack generator-page">
      <header className="page-heading"><div><p className="page-context">Separate authoring project</p><h1>Dataset Generator</h1><p>The rules, schema, distribution, and curated examples for teaching one consistent transcript-cleanup behavior.</p></div><Link className="button primary" to="/viewer">Open generated sample</Link></header>
      <section className="policy-banner"><div><span>Active policy</span><strong>polished-clean-v1</strong></div><p>Return finished writing while preserving the speaker’s meaning, tone, information, and order. Cleanup is not creative rewriting.</p></section>
      <section className="distribution-section"><div className="section-title"><h2>Dataset composition</h2><p>Teach isolated behavior clearly, then cover natural combinations. Keep a small no-change slice to discourage needless edits.</p></div><div className="distribution-bars"><div style={{ '--share': '50%' }}><span>Single principal error</span><strong>50%</strong><i /></div><div style={{ '--share': '45%' }}><span>Natural multi-error</span><strong>45%</strong><i /></div><div style={{ '--share': '5%' }}><span>No change required</span><strong>5%</strong><i /></div></div></section>
      <section className="generator-grid"><div><h2>Record contract</h2><dl><div><dt>Messages</dt><dd>System instruction, raw ASR user input, polished assistant output.</dd></div><div><dt>Primary category</dt><dd>The principal behavior demonstrated by the record.</dd></div><div><dt>Error types</dt><dd>Every cleanup behavior present in the input.</dd></div><div><dt>Formatting features</dt><dd>Document structure applied in the target.</dd></div><div><dt>Language</dt><dd>Explicit language code. No speaker ID.</dd></div></dl></div><div><h2>Coverage</h2><ul>{coverage.map(item => <li key={item}>{item}</li>)}</ul></div></section>
      <section className="generator-links"><a href="https://github.com/Beingpax/Dataset-VoiceInk-Cleanup/blob/main/dataset-generator/README.md">Read the complete dataset plan</a><a href={`${import.meta.env.BASE_URL}data/generator-sample.jsonl`} download>Download the curated 50-pair sample</a><a href="https://github.com/Beingpax/Dataset-VoiceInk-Cleanup/blob/main/dataset-generator/PROJECT_SUMMARY.md">Read the project summary</a></section>
    </div>
  );
}
