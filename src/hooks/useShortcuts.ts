import { useEffect } from 'react';
import { getState, navigate as moveBy, rate, toggleReveal, undo } from '@/state/store.ts';

/** 1 / 2 / 3 rate (know / don’t know / not sure), S or Space toggles the meaning, ← → browse, Z undoes. Disabled while typing. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target instanceof Element ? e.target : null;
      if (getState().loading || e.ctrlKey || e.metaKey || e.altKey || e.repeat || target?.closest('input,select,textarea,summary,[role=combobox],[role=dialog]')) return;
      if (target?.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.key === '1') rate('definitely_know');
      else if (e.key === '2') rate('dont_know');
      else if (e.key === '3') rate('not_sure');
      else if (e.key === ' ' || e.key.toLowerCase() === 's') { e.preventDefault(); toggleReveal(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveBy(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveBy(1); }
      else if (e.key.toLowerCase() === 'z') undo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
