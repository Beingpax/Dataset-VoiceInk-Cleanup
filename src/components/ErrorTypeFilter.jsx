import { useId } from 'react';
import { errorLabel } from '../utils/jsonl.js';

export default function ErrorTypeFilter({ options, values, onChange, mode, onModeChange }) {
  const id = useId();
  const toggle = value => onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);

  return (
    <section className="error-filter" aria-label="Error type filters">
      <details onKeyDown={event => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}>
        <summary>Error types (subcategories)<span>{values.length ? `${values.length} selected · match ${mode}` : 'All error types'}</span></summary>
        <div className="error-filter-panel">
          <p>Select multiple errors across categories. With no selection, every record is included.</p>
          <fieldset className="error-match-mode">
            <legend>Matching behavior</legend>
            <label><input type="radio" name={id} value="any" checked={mode === 'any'} onChange={() => onModeChange('any')} />Match any selected error</label>
            <label><input type="radio" name={id} value="all" checked={mode === 'all'} onChange={() => onModeChange('all')} />Match all selected errors</label>
          </fieldset>
          <fieldset className="error-options">
            <legend>Choose error types</legend>
            {options.map(value => <label key={value}><input type="checkbox" checked={values.includes(value)} onChange={() => toggle(value)} />{errorLabel(value)}</label>)}
          </fieldset>
          <button type="button" disabled={!values.length} onClick={() => onChange([])}>Clear selected errors</button>
        </div>
      </details>
      {values.length > 0 && <div className="selected-errors" aria-label="Selected error filters">{values.map(value => <button key={value} type="button" onClick={() => toggle(value)} aria-label={`Remove ${errorLabel(value)} filter`}>{errorLabel(value)} <span aria-hidden="true">×</span></button>)}</div>}
    </section>
  );
}
