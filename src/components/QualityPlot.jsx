import { useEffect, useId, useRef, useState } from 'react';
import { qualityPercent, qualityPlotLayout } from './quality-plot-layout.js';

export default function QualityPlot({ models, summaryFor }) {
  const chartRef = useRef(null);
  const tooltipId = useId();
  const [width, setWidth] = useState(1000);
  const [activeId, setActiveId] = useState(null);
  const layout = qualityPlotLayout(models, summaryFor, width);

  useEffect(() => {
    const chart = chartRef.current;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="quality-panel" aria-label="Model quality. Edit similarity increases to the right; word accuracy, one minus WER, increases upward.">
      <p className="quality-axis-heading">Word accuracy <span>(1 − WER)</span> <span aria-hidden="true">↑</span></p>
      <div
        className="quality-chart"
        ref={chartRef}
        onPointerDown={event => { if (!event.target.closest('.quality-point')) setActiveId(null); }}
        onKeyDown={event => { if (event.key === 'Escape') { setActiveId(null); event.stopPropagation(); } }}
      >
        <svg className="quality-plot" viewBox={`0 0 ${width} ${layout.height}`} aria-hidden="true">
          {layout.yTicks.map(({ value, position }) => <g className="quality-grid" key={value}>
            <line x1={layout.left} x2={layout.right} y1={position} y2={position} />
            <text x={layout.left - 12} y={position + 4} textAnchor="end">{Math.round(value * 100)}%</text>
          </g>)}
          {layout.xTicks.map(({ value, position }) => <g className="quality-tick" key={value}>
            <line x1={position} x2={position} y1={layout.bottom} y2={layout.bottom + 5} />
            <text x={position} y={layout.bottom + 25} textAnchor="middle">{Math.round(value * 100)}%</text>
          </g>)}
        </svg>
        {layout.points.map(point => {
          const active = activeId === point.id;
          const tooltipWidth = Math.min(252, width - 8);
          const tooltipLeft = Math.max(4, Math.min(width - tooltipWidth - 4, point.x - tooltipWidth / 2));
          const tooltipTop = point.y > layout.height / 2 ? point.y - 126 : point.y + 24;
          const buttonLeft = Math.min(point.x - 16, point.labelBox.x);
          const buttonTop = Math.min(point.y - 16, point.labelBox.y);
          const buttonWidth = Math.max(point.x + 16, point.labelBox.x + point.labelBox.width) - buttonLeft;
          const buttonHeight = Math.max(point.y + 16, point.labelBox.y + point.labelBox.height) - buttonTop;
          return <div
            key={point.id}
            className={`quality-point${point.isLeader ? ' is-leader' : ''}${active ? ' is-active' : ''}`}
            style={{ left: `${point.x / width * 100}%`, top: point.y }}
            onPointerEnter={event => { if (event.pointerType === 'mouse') setActiveId(point.id); }}
            onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setActiveId(null); }}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActiveId(null); }}
          >
            <button
              type="button"
              className="quality-point-button"
              style={{ left: buttonLeft - point.x, top: buttonTop - point.y, width: buttonWidth, height: buttonHeight }}
              aria-label={`${point.name}: ${qualityPercent(point.similarity)} edit similarity, ${qualityPercent(point.accuracy)} word accuracy, ${qualityPercent(point.wer)} WER. Show values.`}
              aria-expanded={active}
              aria-describedby={active ? tooltipId : undefined}
              onFocus={() => setActiveId(point.id)}
              onClick={() => setActiveId(point.id)}
            >
              <span className="quality-dot" aria-hidden="true" style={{ left: point.x - buttonLeft, top: point.y - buttonTop }} />
              <span className="quality-model-name" aria-hidden="true" style={{ left: point.labelBox.x - buttonLeft, top: point.labelBox.y - buttonTop, width: point.labelBox.width, textAlign: point.labelBox.align }}>{point.label}</span>
            </button>
            {active && <div className="quality-tooltip" role="tooltip" id={tooltipId} style={{ left: tooltipLeft - point.x, top: tooltipTop - point.y, width: tooltipWidth }}>
              <strong>{point.label}</strong>
              <dl>
                <div><dt>Edit similarity</dt><dd>{qualityPercent(point.similarity)}</dd></div>
                <div><dt>Word accuracy</dt><dd>{qualityPercent(point.accuracy)}</dd></div>
                <div><dt>WER</dt><dd>{qualityPercent(point.wer)}</dd></div>
              </dl>
            </div>}
          </div>;
        })}
        {!layout.points.length && <p className="quality-empty">Quality metrics are unavailable for this dataset.</p>}
      </div>
      <figcaption className="quality-axis-caption">Edit similarity <span aria-hidden="true">→</span></figcaption>
    </figure>
  );
}
