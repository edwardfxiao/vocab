import type { Story, StorySource } from './stories.ts';

/** Every story of one collection in a single file (data/<collection>/stories/bundle.json, written by validate.py), so private
 *  stories can be kept out of a public repository and loaded into the browser instead — like a ratings backup. */
export interface StoryBundle { dataset: string; source: StorySource; stories: Story[]; imported_at?: string; name?: string }

const isStory = (x: unknown): x is Story => {
  const s = x as Partial<Story> | null;
  return !!s && typeof s.n === 'number' && typeof s.title === 'string' && Array.isArray(s.paragraphs) && s.paragraphs.every(p => typeof p === 'string')
    && Array.isArray(s.words) && s.words.every(w => typeof w === 'string') && Array.isArray(s.glossary);
};
export function parseStoryBundle(text: string): StoryBundle {
  let o: unknown;
  try { o = JSON.parse(text); } catch { throw new Error('This file is not JSON.'); }
  const b = o as Partial<StoryBundle> | null;
  if (!b || typeof b.dataset !== 'string' || !Array.isArray(b.stories)) throw new Error('This is not a stories bundle (expected dataset and stories).');
  const stories = b.stories.filter(isStory).map(s => ({ n: s.n, ...(typeof s.variant === 'string' && /^[b-z]$/.test(s.variant) ? { variant: s.variant } : {}), ...(typeof s.round === 'number' && s.round > 0 ? { round: s.round } : {}), title: s.title, summary_zh: typeof s.summary_zh === 'string' ? s.summary_zh : '', words: s.words, paragraphs: s.paragraphs, glossary: s.glossary.filter(g => g && typeof g.word === 'string').map(g => ({ word: g.word, zh: typeof g.zh === 'string' ? g.zh : '' })) }));
  if (!stories.length) throw new Error('The bundle holds no valid stories.');
  const seen = new Set<string>();
  for (const s of stories) { const k = `${s.n}${s.variant ?? ''}`; if (seen.has(k)) throw new Error(`Story ${k} appears twice.`); seen.add(k); }
  const src = (b.source && typeof b.source === 'object' ? b.source : {}) as StorySource;
  return { dataset: b.dataset, source: src, stories: stories.sort((a, c) => a.n - c.n || (a.variant ?? '').localeCompare(c.variant ?? '')) };
}

// ---- IndexedDB (one record per collection id) ----
const DB = 'word-by-word'; const STORE = 'stories';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is not available in this browser.')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the browser database.'));
  });
}
function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode); const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error('Browser database error.'));
    t.oncomplete = () => db.close();
  }));
}
export const getStoryBundle = (dataset: string): Promise<StoryBundle | undefined> => tx('readonly', s => s.get(dataset) as IDBRequest<StoryBundle | undefined>).catch(() => undefined);
export const putStoryBundle = (bundle: StoryBundle): Promise<void> => tx('readwrite', s => s.put(bundle, bundle.dataset)).then(() => undefined);
export const deleteStoryBundle = (dataset: string): Promise<void> => tx('readwrite', s => s.delete(dataset)).then(() => undefined);
export const hasStoryBundle = (dataset: string): Promise<boolean> => getStoryBundle(dataset).then(b => !!b);
