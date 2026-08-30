export default function MethodologyPage() {
  return (
    <div className="page-stack methodology-page">
      <header className="page-heading"><div><h1>Methodology</h1></div><div className="header-facts"><div><strong>100</strong><span>cases</span></div><div><strong>4</strong><span>systems</span></div><div><strong>2</strong><span>sources</span></div></div></header>
      <section className="method-sections">
        <article><span>Sampling</span><h2>Two labeled 50-case sources</h2><p>The VoiceInk validation source preserves the original 20 fixed-seed random cases and adds 30 fixed-seed cases from the longest 30 percent of remaining inputs. The curated source includes all 50 supplied cleanup pairs with category metadata intact.</p></article>
        <article><span>Local runs</span><h2>Sequential Apple Silicon inference</h2><p>VoiceInk uses MLX LM 4-bit. SpeakoFlow uses its Q8_0 GGUF through a persistent llama.cpp server. S1-mini uses BF16 Transformers on MPS with the model card’s control line and thinking disabled.</p></article>
        <article><span>Measurement</span><h2>Quality and runtime remain distinct</h2><p>Exact match, edit similarity, chrF++, and WER compare each output with one human reference. Local latency, output tokens per second, and approximate peak RSS are recorded separately.</p></article>
        <article><span>Limitations</span><h2>An evidence browser, not a universal ranking</h2><p>References encode one preferred rendering and string metrics penalize reasonable alternatives. The curated and validation datasets have different construction. Provider-side runtime and memory were unavailable for the hosted baseline.</p></article>
      </section>
      <section className="download-section"><div className="section-title"><h2>Download artifacts</h2></div><div><a href={`${import.meta.env.BASE_URL}downloads/benchmark-results.json`} download>Complete benchmark results <span>JSON</span></a><a href={`${import.meta.env.BASE_URL}downloads/case-results.csv`} download>Per-case scores <span>CSV</span></a><a href={`${import.meta.env.BASE_URL}downloads/aggregate-results.csv`} download>Aggregate scores <span>CSV</span></a><a href="https://github.com/Beingpax/Dataset-VoiceInk-Cleanup/blob/main/comparison/benchmark/README.md">Reproduction notes <span>MD</span></a></div></section>
    </div>
  );
}
