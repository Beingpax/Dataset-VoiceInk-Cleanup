import { useEffect } from 'react';

function isEditingTarget(target) {
  return target instanceof HTMLElement && (
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [aria-haspopup="listbox"], [role="listbox"], [role="option"]')
  );
}

export default function useArrowNavigation({ previous, next, enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isEditingTarget(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, next, previous]);
}
