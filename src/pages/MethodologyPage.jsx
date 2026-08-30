export default function MethodologyPage() {
  return (
    <div className="page-stack methodology-page">
      <header className="page-heading"><div><h1>Methodology</h1></div><div className="header-facts"><div><strong>100</strong><span>cases</span></div><div><strong>3</strong><span>systems</span></div><div><strong>2</strong><span>sources</span></div></div></header>
      <section className="method-sections">
        <article><span>Sampling</span><h2>Two labeled 50-case sources</h2><p>The VoiceInk validation source preserves the original 20 fixed-seed random cases and adds 30 fixed-seed cases from the longest 30 percent of remaining inputs. The curated source includes all 50 supplied cleanup pairs with category metadata intact.</p></article>
        <article><span>Local runs</span><h2>Sequential Apple Silicon inference</h2><p>VoiceInk uses MLX LM 4-bit. SpeakoFlow uses its Q8_0 GGUF through a persistent llama.cpp server.</p></article>
        <article><span>Measurement</span><h2>Quality and completion remain distinct</h2><p>Outputs are compared with the stored reference. Completion and exact-match totals include every expected case, including failures and missing results. Edit similarity, chrF++, WER, and runtime averages describe successful cases only. An all-failed run has unavailable quality scores, not a fabricated zero score.</p></article>
        <article><span>Limitations</span><h2>Compare recorded configurations</h2><p>Ranks and the chart require complete runs with no known reference-derived hints. Model-native prompts differ, the two datasets have different construction, and ranking eligibility does not establish human-reviewed references or rule out training-data overlap. Hosted runtime and memory remain unavailable.</p></article>
      </section>
      <section className="download-section"><div className="section-title"><h2>Download artifacts</h2></div><p className="empty-copy">Downloads are saved snapshots. Older exports may predate fairness reporting; running the scorer republishes counts and context provenance without changing model outputs.</p><div><a href={`${import.meta.env.BASE_URL}downloads/benchmark-results.json`} download>Saved benchmark results <span>JSON</span></a><a href={`${import.meta.env.BASE_URL}downloads/case-results.csv`} download>Per-case scores <span>CSV</span></a><a href={`${import.meta.env.BASE_URL}downloads/aggregate-results.csv`} download>Aggregate scores <span>CSV</span></a><a href="https://github.com/Beingpax/Dataset-VoiceInk-Cleanup/blob/main/comparison/benchmark/README.md">Reproduction notes <span>MD</span></a></div></section>
    </div>
  );
}
