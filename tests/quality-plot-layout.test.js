import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { qualityPercent, qualityPlotLayout } from '../src/components/quality-plot-layout.js';

const data = JSON.parse(readFileSync(new URL('../public/data/benchmark.json', import.meta.url), 'utf8'));
const datasets = ['all', ...data.benchmark.datasets.map(dataset => dataset.id)];
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

for (const width of [280, 350, 600, 900, 1178, 1312]) {
  for (const dataset of datasets) {
    test(`${dataset} at ${width}px: accurate points and separate, contained labels`, () => {
      const summaryFor = model => dataset === 'all' ? model.summary : model.dataset_summaries[dataset];
      const layout = qualityPlotLayout(data.models, summaryFor, width);
      assert.equal(layout.points.length, data.models.length);
      assert.deepEqual(layout.xTicks.map(tick => tick.value), [.8, .9, 1]);
      assert.deepEqual(layout.yTicks.map(tick => tick.value), [.4, .7, 1]);
      assert.equal(layout.points.filter(point => point.isLeader).length, 1);
      for (const point of layout.points) {
        const summary = summaryFor(data.models.find(model => model.id === point.id));
        assert.equal(point.similarity, summary.mean_edit_similarity);
        assert.equal(point.accuracy, 1 - summary.mean_wer);
        assert.ok(point.x >= layout.left && point.x <= layout.right);
        assert.ok(point.y >= layout.top && point.y <= layout.bottom);
        const label = point.labelBox;
        assert.ok(label.x >= 0 && label.x + label.width <= width);
        assert.ok(label.y >= 0 && label.y + label.height <= layout.bottom);
        for (const other of layout.points) {
          if (other.id !== point.id) assert.ok(!overlaps(label, other.labelBox), `${point.label} overlaps ${other.label}`);
        }
      }
    });
  }
}

test('missing quality values are omitted without fabricating a score', () => {
  const models = [{ id: 'missing', name: 'Missing', summary: { mean_edit_similarity: null, mean_wer: .1 } }];
  const layout = qualityPlotLayout(models, model => model.summary, 350);
  assert.deepEqual(layout.points, []);
  assert.ok(layout.xTicks.every(tick => Number.isFinite(tick.position)));
  assert.ok(layout.yTicks.every(tick => Number.isFinite(tick.position)));
});

test('a perfect score remains inside the chart', () => {
  const models = [{ id: 'perfect', name: 'Perfect', summary: { mean_edit_similarity: 1, mean_wer: 0 } }];
  const layout = qualityPlotLayout(models, model => model.summary, 280);
  assert.equal(layout.points[0].x, layout.right);
  assert.equal(layout.points[0].y, layout.top);
});

test('WER above 100% is represented honestly as negative word accuracy', () => {
  const models = [{ id: 'low', name: 'Low', summary: { mean_edit_similarity: .2, mean_wer: 1.4 } }];
  const layout = qualityPlotLayout(models, model => model.summary, 350);
  assert.ok(layout.yTicks[0].value < -.4);
  assert.ok(layout.points[0].y <= layout.bottom);
  assert.equal(qualityPercent(layout.points[0].accuracy), '-40.0%');
});
