import { buildCSV, fileStamp } from '@/lib/transfer.ts';
import type { WordEntry } from '@/lib/words.ts';
import { getState, notify } from '@/state/store.ts';

/** Triggers a browser download of `csv` under `name` and returns the name. */
export function downloadCSV(csv: string, name: string): string {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

/** Exports `rows` of the current collection in the same shape as the study-list exports (source columns + status,
 *  reviewed_at, gloss_zh, trap, note), named `<collection>-<label>-<stamp>.csv`. */
export function exportWords(rows: WordEntry[], label: string): void {
  const { config, columns, ratings, enrichment, notes, loading } = getState();
  if (loading || !config) return;
  if (!rows.length) { notify('There are no words to export in this selection.'); return; }
  const csv = buildCSV(rows, columns, config.id, ratings, r => { const e = enrichment.words[r.word.toLowerCase()]; return { gloss_zh: e?.gloss ?? '', trap: e?.trap ?? '', note: notes[r.id] ?? '' }; });
  const name = downloadCSV(csv, `${config.id.replaceAll('/', '-')}-${label}-${fileStamp()}.csv`);
  notify(`Exported ${rows.length.toLocaleString()} ${rows.length === 1 ? 'word' : 'words'} (${label.replaceAll('_', ' ')}) as ${name}.`);
}
