const nativePromptModels = new Set(['gpt-5.6-sol-low', 'voiceink-refine-v1', 'speakoflow-mini']);

export const hasRecordedOutput = result => Boolean(result && !result.error && typeof result.output === 'string');

function comparisonContext(model) {
  if (typeof model.comparison?.reference_blind === 'boolean') return model.comparison;
  const known = nativePromptModels.has(model.id);
  return {
    reference_blind: known,
    context_source: known ? 'native_prompt' : 'unverified',
    note: known ? null : 'Unranked: inference context provenance is unverified.',
  };
}

function summarizeRecordedCases(cases, previous, expectedCount, expectedIds) {
  const occurrences = new Map();
  for (const result of cases) occurrences.set(result.id, (occurrences.get(result.id) || 0) + 1);
  const measured = cases.filter(result => hasRecordedOutput(result)
    && occurrences.get(result.id) === 1
    && (!expectedIds || expectedIds.has(result.id)));
  const exactMatches = measured.filter(result => result.metrics?.exact_match === true).length;
  const mean = key => {
    const values = measured.map(result => result.metrics?.[key]);
    return values.length && values.every(Number.isFinite)
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  };
  return {
    ...previous,
    case_count: expectedCount,
    recorded_cases: cases.length,
    duplicate_cases: cases.filter(result => occurrences.get(result.id) > 1).length,
    unexpected_cases: expectedIds ? cases.filter(result => !expectedIds.has(result.id)).length : 0,
    successful_cases: measured.length,
    failed_cases: Math.max(0, expectedCount - measured.length),
    success_rate: expectedCount ? measured.length / expectedCount : null,
    exact_matches: exactMatches,
    exact_match_rate: expectedCount ? exactMatches / expectedCount : null,
    mean_edit_similarity: mean('edit_similarity'),
    mean_chrf: mean('chrf'),
    mean_wer: mean('wer'),
    mean_generation_seconds: measured.length ? previous?.mean_generation_seconds ?? null : null,
    median_generation_seconds: measured.length ? previous?.median_generation_seconds ?? null : null,
    median_tokens_per_second: measured.length ? previous?.median_tokens_per_second ?? null : null,
  };
}

export function normalizeBenchmarkFairness(payload) {
  const { benchmark } = payload;
  const manifest = benchmark.case_manifest;
  const expectedIds = manifest ? new Set(manifest.map(item => item.id)) : null;
  return {
    ...payload,
    models: payload.models.map(model => ({
      ...model,
      comparison: comparisonContext(model),
      // Old snapshots have success-only denominators. Derive counts from their
      // recorded cases without changing outputs or rerunning string metrics.
      summary: summarizeRecordedCases(model.cases || [], model.summary, benchmark.sample_count, expectedIds),
      dataset_summaries: Object.fromEntries(benchmark.datasets.map(dataset => [dataset.id, summarizeRecordedCases(
        (model.cases || []).filter(result => result.dataset_id === dataset.id),
        model.dataset_summaries?.[dataset.id],
        dataset.count,
        manifest ? new Set(manifest.filter(item => item.dataset_id === dataset.id).map(item => item.id)) : null,
      )])),
    })),
  };
}

export function rankingNote(model, summary) {
  if (!model.comparison?.reference_blind) return model.comparison?.note || 'Unranked: reference-blind inference is unverified.';
  if (summary?.duplicate_cases || summary?.unexpected_cases || summary?.recorded_cases > summary?.case_count) return 'Unranked: invalid case coverage.';
  if (!summary?.case_count) return 'Unranked: no cases in this dataset.';
  if (summary.successful_cases !== summary.case_count) return 'Unranked: incomplete run. Failed and missing cases are included in completion and exact totals.';
  if (!Number.isFinite(summary.mean_edit_similarity)) return 'Unranked: quality metrics are unavailable.';
  return '';
}

export const isRanked = (model, summary = model.summary) => rankingNote(model, summary) === '';
