export const qualityPercent = value => `${(value * 100).toFixed(1)}%`;

const hasQuality = summary => Number.isFinite(summary?.mean_edit_similarity) && Number.isFinite(summary?.mean_wer);
const overlaps = (a, b, gap = 6) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

export function qualityPlotLayout(models, summaryFor, width, height = 560) {
  const entries = models.map(model => ({ model, summary: summaryFor(model) })).filter(entry => hasQuality(entry.summary));
  // Share a scale across dataset views so filtering never exaggerates a change.
  const summaries = models.flatMap(model => [model.summary, ...Object.values(model.dataset_summaries || {}), summaryFor(model)]).filter(hasQuality);
  const xMin = Math.max(0, Math.min(.9, Math.floor((Math.min(...summaries.map(item => item.mean_edit_similarity), 1) - .02) * 10) / 10));
  const yMin = Math.min(.8, Math.floor((Math.min(...summaries.map(item => 1 - item.mean_wer), 1) - .05) * 5) / 5);
  const left = 44, right = width - 18, top = 24, bottom = height - 38;
  const x = value => left + (value - xMin) / (1 - xMin) * (right - left);
  const y = value => bottom - (value - yMin) / (1 - yMin) * (bottom - top);
  const ticks = min => [min, (min + 1) / 2, 1];
  const bestSimilarity = Math.max(...entries.map(entry => entry.summary.mean_edit_similarity));
  const points = entries.map(({ model, summary }) => ({
    id: model.id,
    name: model.name,
    label: model.name.replace(' (low reasoning)', ''),
    similarity: summary.mean_edit_similarity,
    accuracy: 1 - summary.mean_wer,
    wer: summary.mean_wer,
    x: x(summary.mean_edit_similarity),
    y: y(1 - summary.mean_wer),
    isLeader: summary.mean_edit_similarity === bestSimilarity,
  }));
  const labels = [];
  // Place upper points first; close neighbors get labels above/below the cluster.
  for (const point of [...points].sort((a, b) => a.y - b.y)) {
    const labelWidth = Math.min(point.label.length * 8.5, width - left - 12);
    const before = point.x - labelWidth - 15;
    const after = point.x + 15;
    const sides = point.x > (left + right) / 2 ? [before, after] : [after, before];
    const candidates = [point.y - 10, point.y - 36, point.y + 16].flatMap(labelY => sides.map(labelX => ({
      x: Math.max(left, Math.min(width - labelWidth - 4, labelX)),
      y: Math.max(2, Math.min(bottom - 22, labelY)),
      width: labelWidth,
      height: 20,
    })));
    const label = candidates.find(candidate => !labels.some(other => overlaps(candidate, other)) && !points.some(other => overlaps(candidate, { x: other.x - 7, y: other.y - 7, width: 14, height: 14 }, 3))) || candidates[0];
    labels.push(label);
    point.labelBox = { ...label, align: label.x + label.width < point.x ? 'right' : 'left' };
  }
  return {
    width, height, left, right, top, bottom, points,
    xTicks: ticks(xMin).map(value => ({ value, position: x(value) })),
    yTicks: ticks(yMin).map(value => ({ value, position: y(value) })),
  };
}
