import { useEffect, useId, useRef, useState } from 'react';

export default function Picker({ label, value, onChange, options, className = '' }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options[selectedIndex] || options[0];

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  const choose = option => {
    if (!option?.disabled) onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(options[activeIndex]); else setOpen(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setOpen(true);
    if (event.key === 'Home') setActiveIndex(0);
    else if (event.key === 'End') setActiveIndex(options.length - 1);
    else setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
  };

  return (
    <div className={`picker-field ${className}`} ref={rootRef}>
      <span className="picker-label">{label}</span>
      <button
        className="picker-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(current => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="picker-value">{selected?.label || 'Select'}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4.5 6 3.5 3.5L11.5 6" /></svg>
      </button>
      {open && (
        <div className="picker-menu" id={listId} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              className={`picker-option ${index === activeIndex ? 'is-active' : ''}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {option.value === value && <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.5 8.5 2.8 2.8 6.2-6.2" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
