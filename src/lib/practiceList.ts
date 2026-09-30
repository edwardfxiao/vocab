import { csvRecords } from './csv.ts';
import { wordKey, type WordEntry } from './words.ts';

export interface PracticeSource { name: string; ids: string[]; imported_at: string }
/** Several imported CSVs (yesterday's story-1 misses, today's story-2 misses…) practised together. */
export interface PracticeList { sources: PracticeSource[] }
export const practiceListKey = (dataset: string): string => `word-by-word.practice-list.${dataset}.v1`;

/** Reads a word list out of any CSV with a `word` column (study-list exports, backups, missed-word exports, or a hand-made
 *  file). Rows of the same collection match by id; anything else matches by spelling. Keeps the file's order, drops
 *  duplicates and words the collection lacks. */
export function parseWordList(text: string, dataset: string, data: WordEntry[]): { entries: WordEntry[]; ignored: number; byId: boolean } {
  const { headers, rows } = csvRecords(text);
  if (!headers.includes('word')) throw new Error('The CSV needs a word column.');
  const byId = headers.includes('id') && headers.includes('dataset') && rows.length > 0 && rows.every(r => r.dataset === dataset);
  const idMap = new Map(data.map(r => [r.id, r]));
  const wordMap = new Map<string, WordEntry>();
  for (const r of data) if (!wordMap.has(wordKey(r.word))) wordMap.set(wordKey(r.word), r);
  const seen = new Set<string>(); const entries: WordEntry[] = []; let ignored = 0;
  for (const row of rows) {
    const match = (byId ? idMap.get(row.id) : undefined) ?? wordMap.get(wordKey(row.word));
    if (!match) { ignored++; continue; }
    if (seen.has(match.id)) continue;
    seen.add(match.id); entries.push(match);
  }
  if (!entries.length) throw new Error('None of the words in this CSV are in the current collection.');
  return { entries, ignored, byId };
}

/** Ids of every source in order, each word once. */
export function mergedIds(list: PracticeList): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const src of list.sources) for (const id of src.ids) if (!seen.has(id)) { seen.add(id); out.push(id); }
  return out;
}

const toSource = (o: unknown): PracticeSource | null => {
  const s = o as Partial<PracticeSource> | null;
  if (!s || !Array.isArray(s.ids) || !s.ids.every(x => typeof x === 'string')) return null;
  return { name: typeof s.name === 'string' ? s.name : 'list', ids: s.ids, imported_at: typeof s.imported_at === 'string' ? s.imported_at : '' };
};
/** Parses the stored list; a single-source record from the first version is upgraded to one source. */
export function readPracticeList(raw: string | null): PracticeList | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { sources?: unknown } | null;
    if (o && Array.isArray(o.sources)) { const sources = o.sources.map(toSource).filter((x): x is PracticeSource => !!x); return sources.length ? { sources } : null; }
    const single = toSource(o);
    return single ? { sources: [single] } : null;
  } catch { return null; }
}
