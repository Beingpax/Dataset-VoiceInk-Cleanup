function parseBlocks(text) {
  const blocks = [];
  let type = 'p';
  let lines = [];
  const flush = () => {
    if (lines.length) blocks.push({ type, lines });
    lines = [];
  };

  String(text || '').split(/\r?\n/).forEach(original => {
    const line = original.trim();
    if (!line) { flush(); type = 'p'; return; }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s?(.+)$/);
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { flush(); blocks.push({ type: 'heading', lines: [heading[1]] }); type = 'p'; }
    else if (bullet) { if (type !== 'ul') { flush(); type = 'ul'; } lines.push(bullet[1]); }
    else if (ordered) { if (type !== 'ol') { flush(); type = 'ol'; } lines.push(ordered[1]); }
    else if (quote) { if (type !== 'quote') { flush(); type = 'quote'; } lines.push(quote[1]); }
    else { if (type !== 'p') { flush(); type = 'p'; } lines.push(line); }
  });
  flush();
  return blocks;
}

export default function RichText({ text }) {
  const blocks = parseBlocks(text);
  if (!blocks.length) return <p className="empty-copy">No text provided.</p>;
  return blocks.map((block, index) => {
    if (block.type === 'ul') return <ul key={index}>{block.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>;
    if (block.type === 'ol') return <ol key={index}>{block.lines.map((line, i) => <li key={i}>{line}</li>)}</ol>;
    if (block.type === 'quote') return <blockquote key={index}>{block.lines.join('\n')}</blockquote>;
    if (block.type === 'heading') return <h4 key={index}>{block.lines[0]}</h4>;
    return <p key={index}>{block.lines.map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</p>;
  });
}
