/** Application state: one loaded collection, its ratings and view, undo history, enrichment. Persists to the same
 * localStorage keys as the original checker so progress carries over. Exposed through useSyncExternalStore. */
import { useSyncExternalStore } from 'react';
import { DATASETS, type DatasetConfig } from '@/lib/datasets.ts';
import { hasStoryBundle } from '@/lib/storyBundle.ts';
import { withBase } from '@/lib/base.ts';
import { EMPTY_ENRICHMENT, buildPartOf, type Enrichment } from '@/lib/enrichment.ts';
import {
  LAST_DATASET_KEY, SHOW_MEANING_KEY, defaultView, readSavedProgress, serializeProgress, storageKey, viewMatches,
  type Rating, type Ratings, type Status, type ViewState,
} from '@/lib/ratings.ts';
import { normalizeDataset, wordKey, type WordEntry } from '@/lib/words.ts';
import { EXTRAS_KEY, extraKey, mergeExtras, notesKey, readExtras, readNotes, type ExtraWord, type Notes } from '@/lib/notes.ts';

export interface Notice { text: string; warn: boolean }
export type TrailEntry = { kind: 'word'; id: string } | { kind: 'story'; n: number; variant?: string; scrollY: number };
interface HistoryEntry { id: string; old: Rating | null; view: ViewState }

export interface AppState {
  config: DatasetConfig | null;
  data: WordEntry[];
  columns: string[];
  ratings: Ratings;
  notes: Notes;           // my own understanding per word id (word-by-word.notes.<dataset>.v1)
  extras: ExtraWord[];    // words the collections lack, with my gloss (word-by-word.extras.v1, shared by all collections)
  view: ViewState;
  loading: boolean;
  loadError: string | null;
  storageOK: boolean;
  notice: Notice | null;
  canUndo: boolean;
  enrichment: Enrichment;
  syllables: Record<string, string>;   // word → 'mav·er·ick' (layers/syllables/syllables.json)
  showMeaning: boolean;   // global "always show meaning" switch
  revealed: boolean;      // per-card reveal when the global switch is off
  scrollTo: string | null; // word id the card should scroll into view for (set by jumps, not by ratings)
  trail: TrailEntry[];    // where the Back button leads: words visited through chips/links, or a story page with its scroll position
  listIds: string[] | null; // practice-list page: the queue is pinned to these ids (mirrors `listQueue` so components re-render)
  storiesImported: boolean; // a stories bundle for the current collection is stored in this browser (IndexedDB)
}

const history: HistoryEntry[] = [];
let loadVersion = 0;
let partOf = new Map<string, string[]>();
let byWord = new Map<string, WordEntry>();
let listQueue: string[] | null = null;   // practice-list page: the queue is this fixed list of ids instead of the filtered collection

const readShowMeaning = (): boolean => { try { return localStorage.getItem(SHOW_MEANING_KEY) === '1'; } catch { return false; } };
const readExtrasStored = (): ExtraWord[] => { try { return readExtras(localStorage.getItem(EXTRAS_KEY)); } catch { return []; } };

let state: AppState = {
  config: null, data: [], columns: [], ratings: {}, notes: {}, extras: readExtrasStored(), view: defaultView(), loading: true, loadError: null, storageOK: true,
  notice: null, canUndo: false, enrichment: EMPTY_ENRICHMENT, syllables: {}, showMeaning: readShowMeaning(), revealed: false, scrollTo: null, trail: [], listIds: null, storiesImported: false,
};
const listeners = new Set<() => void>();
function set(patch: Partial<AppState>): void {
  state = { ...state, ...patch, canUndo: history.length > 0 };
  for (const l of listeners) l();
}
export const getState = (): AppState => state;
export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => selector(state), () => selector(state));
}

// ---- derived helpers ----
export const statusOf = (ratings: Ratings, id: string): Status => ratings[id]?.status ?? 'unreviewed';
export function entryByWord(word: string): WordEntry | undefined { return byWord.get(wordKey(word)); }
export function partOfMap(): Map<string, string[]> { return partOf; }

export function buildQueue(data: WordEntry[], ratings: Ratings, view: ViewState): WordEntry[] {
  if (listQueue) { const byId = new Map(data.map(r => [r.id, r])); return listQueue.map(id => byId.get(id)).filter((r): r is WordEntry => !!r); }
  const q = view.search.trim().toLowerCase();
  const queue = data.filter(r => viewMatches(statusOf(ratings, r.id), view) && (view.source === 'all' || r.selection === view.source)
    && (!q || r.word.toLowerCase().includes(q) || r.meaning_zh.includes(q)));
  if (view.order !== 'frequency') queue.sort((a, b) => a.word.localeCompare(b.word, 'en') * (view.order === 'az' ? 1 : -1));
  return queue;
}
/** Keeps `current` on a word that is actually in the queue (first item when it is missing). */
export function ensureCurrent(data: WordEntry[], ratings: Ratings, view: ViewState): ViewState {
  const queue = buildQueue(data, ratings, view);
  return queue.some(r => r.id === view.current) ? view : { ...view, current: queue[0]?.id ?? null };
}
export interface Counts { unreviewed: number; definitely_know: number; not_sure: number; dont_know: number }
export function countStatuses(data: WordEntry[], ratings: Ratings): Counts {
  const c: Counts = { unreviewed: 0, definitely_know: 0, not_sure: 0, dont_know: 0 };
  for (const r of data) c[statusOf(ratings, r.id)]++;
  return c;
}

// ---- persistence ----
function save(): void {
  if (!state.config) return;
  try {
    localStorage.setItem(storageKey(state.config.id), serializeProgress(state.ratings, state.view));
    localStorage.setItem(notesKey(state.config.id), JSON.stringify(state.notes));
    if (!state.storageOK) set({ storageOK: true });
  } catch {
    set({ storageOK: false, notice: { text: 'This browser could not save your progress. Use “Back up all progress” before closing this page.', warn: true } });
  }
}
export function notify(text: string, warn = false): void { set({ notice: { text, warn } }); }
export function clearNotice(): void { set({ notice: null }); }

let enrichmentPromise: Promise<Enrichment> | null = null;
function loadEnrichment(): Promise<Enrichment> {
  enrichmentPromise ??= fetch(withBase('layers/enrichment/enrichment.json'))
    .then(async r => (r.ok ? { ...EMPTY_ENRICHMENT, ...(await r.json() as Partial<Enrichment>) } : EMPTY_ENRICHMENT))
    .catch(() => EMPTY_ENRICHMENT)
    .then(e => { partOf = buildPartOf(e); return e; });
  return enrichmentPromise;
}
let syllablesPromise: Promise<Record<string, string>> | null = null;
function loadSyllables(): Promise<Record<string, string>> {
  syllablesPromise ??= fetch(withBase('layers/syllables/syllables.json'))
    .then(async r => (r.ok ? await r.json() as Record<string, string> : {}))
    .catch(() => ({}));
  return syllablesPromise;
}
export const syllablesOf = (word: string): string | undefined => state.syllables[word] ?? state.syllables[word.toLowerCase()];

export function lastDatasetId(): string {
  try { const saved = localStorage.getItem(LAST_DATASET_KEY); if (saved && DATASETS.some(d => d.id === saved)) return saved; } catch { /* storage unavailable */ }
  return DATASETS[0].id;
}

export async function loadDataset(id: string): Promise<void> {
  const config = DATASETS.find(d => d.id === id);
  if (!config) return;
  if (state.config?.id === id && !state.loadError) return;
  const version = ++loadVersion;
  history.length = 0;
  set({ loading: true, loadError: null, notice: null, config, data: [], revealed: false, trail: [], storiesImported: false });
  void hasStoryBundle(id).then(has => { if (version === loadVersion) set({ storiesImported: has }); });
  try {
    const isDict = config.kind === 'dictionary';
    const [response, enrichment, syllables] = await Promise.all([fetch(withBase(config.file)), isDict ? loadEnrichment() : Promise.resolve(EMPTY_ENRICHMENT), isDict ? loadSyllables() : Promise.resolve({})]);
    if (!response.ok) throw new Error(`Could not read ${config.file} (HTTP ${response.status}).`);
    const parsed = normalizeDataset(await response.text(), config);
    if (version !== loadVersion) return;
    byWord = new Map(parsed.data.map(r => [wordKey(r.word), r]));
    let columns = parsed.columns;
    if (config.kind === 'dictionary' && Object.keys(enrichment.words).length) {
      columns = [...new Set([...columns.filter(c => !['word', 'status', 'reviewed_at'].includes(c)), 'gloss_zh', 'trap', 'word', 'status', 'reviewed_at'])];
    }
    columns = [...columns, 'note'];
    let ratings: Ratings = {}; let notes: Notes = {}; let view = defaultView(); let storageOK = true; let notice: Notice | null = null;
    const ids = new Set(parsed.data.map(r => r.id)); const sources = new Set(parsed.data.map(r => r.selection));
    try {
      let saved = readSavedProgress(localStorage.getItem(storageKey(id)), ids, sources);
      if (saved) { ratings = saved.ratings; view = saved.view; }
      notes = readNotes(localStorage.getItem(notesKey(id)), ids);
    } catch {
      storageOK = false;
      notice = { text: 'Saved progress could not be loaded. Restore a CSV backup before continuing; the saved copy has not been overwritten.', warn: true };
    }
    set({ config, data: parsed.data, columns, ratings, notes, view: ensureCurrent(parsed.data, ratings, view), loading: false, storageOK, notice, enrichment, syllables, trail: [] });
    try { localStorage.setItem(LAST_DATASET_KEY, id); } catch { /* ratings save reports failures */ }
  } catch (error) {
    if (version !== loadVersion) return;
    set({ loading: false, data: [], loadError: error instanceof Error ? error.message : String(error) });
  }
}

export function datasetDescription(config: DatasetConfig): string { return config.description ?? ''; }
export function setStoriesImported(has: boolean): void { set({ storiesImported: has }); }
/** Stories exist for the current collection: a folder listed in dataset.json, or a bundle imported into this browser. */
export const hasStories = (s: AppState): boolean => !!s.config?.stories || s.storiesImported;

// ---- view / navigation ----
export function setView(patch: Partial<ViewState>): void {
  if (state.loading) return;
  const view = { ...state.view, ...patch };
  if (view.filter === 'all') view.invert = false;
  const queue = buildQueue(state.data, state.ratings, view);
  if (!queue.some(r => r.id === view.current)) view.current = queue[0]?.id ?? null;
  set({ view, revealed: false });
  save();
}
/** Pins the queue to a fixed list of word ids (practice-list page) or releases it (null); rating and arrows then move within the list. */
export function setListQueue(ids: string[] | null): void {
  listQueue = ids;
  if (state.loading) { set({ listIds: ids }); return; }
  set({ listIds: ids, view: ensureCurrent(state.data, state.ratings, state.view), revealed: false });
}
export function showAll(): void { setView({ filter: 'all', invert: false, source: 'all', search: '', current: null }); }
export function setCurrent(id: string | null): void {
  if (state.loading) return;
  set({ view: { ...state.view, current: id }, revealed: false });
  save();
}
/** Jump to a word from a relation chip / list link and open its meaning. The trail itself travels in the browser
 * history entry's state (see DatasetPage), so back/forward restore it; callers pass the new trail when navigating. */
export function jumpToWord(id: string): void {
  if (state.loading) return;
  const view = { ...state.view };
  if (!buildQueue(state.data, state.ratings, view).some(r => r.id === id)) { view.filter = 'all'; view.invert = false; view.search = ''; }
  view.current = id;
  set({ view, revealed: true, scrollTo: id });
  save();
}
export function clearScrollTo(): void { if (state.scrollTo) set({ scrollTo: null }); }
const sameEntry = (a: TrailEntry, b: TrailEntry): boolean => a.kind === 'word' ? b.kind === 'word' && a.id === b.id : b.kind === 'story' && a.n === b.n && (a.variant ?? '') === (b.variant ?? '') && a.scrollY === b.scrollY;
export function setTrail(trail: TrailEntry[]): void {
  if (trail.length === state.trail.length && trail.every((x, i) => sameEntry(x, state.trail[i]))) return;
  set({ trail });
}
/** Reads a trail out of a history entry's state (plain strings are legacy word ids). */
export function trailFromState(historyState: unknown): TrailEntry[] {
  const st = historyState as { trail?: unknown } | null | undefined;
  if (!Array.isArray(st?.trail)) return [];
  const out: TrailEntry[] = [];
  for (const x of st.trail) {
    if (typeof x === 'string') out.push({ kind: 'word', id: x });
    else if (x && typeof x === 'object') {
      const o = x as { kind?: unknown; id?: unknown; n?: unknown; variant?: unknown; scrollY?: unknown };
      if (o.kind === 'word' && typeof o.id === 'string') out.push({ kind: 'word', id: o.id });
      else if (o.kind === 'story' && typeof o.n === 'number') out.push({ kind: 'story', n: o.n, ...(typeof o.variant === 'string' && o.variant ? { variant: o.variant } : {}), scrollY: typeof o.scrollY === 'number' ? o.scrollY : 0 });
    }
  }
  return out;
}
/** Trail with the current word appended (used when leaving a word through a chip or link). */
export function trailWithCurrent(): TrailEntry[] {
  const cur = state.view.current;
  return cur ? [...state.trail, { kind: 'word', id: cur }] : state.trail;
}
export function navigate(delta: number): void {
  if (state.loading) return;
  const queue = buildQueue(state.data, state.ratings, state.view);
  const i = queue.findIndex(r => r.id === state.view.current) + delta;
  if (i < 0 || i >= queue.length) return;
  setCurrent(queue[i].id);
}
export function toggleReveal(): void { set({ revealed: !state.revealed }); }
export function setShowMeaning(on: boolean): void {
  set({ showMeaning: on });
  try { localStorage.setItem(SHOW_MEANING_KEY, on ? '1' : '0'); } catch { /* preference only */ }
}

// ---- ratings ----
export function rate(status: Status): void {
  if (state.loading) return;
  const queue = buildQueue(state.data, state.ratings, state.view);
  const i = queue.findIndex(r => r.id === state.view.current);
  const r = queue[i];
  if (!r) return;
  history.push({ id: r.id, old: state.ratings[r.id] ? { ...state.ratings[r.id] } : null, view: { ...state.view } });
  if (history.length > 100) history.shift();
  const ratings = { ...state.ratings, [r.id]: { status, reviewed_at: new Date().toISOString() } };
  const next = buildQueue(state.data, ratings, state.view);
  let idx = next.findIndex(x => x.id === r.id);
  idx = idx >= 0 ? Math.min(idx + 1, next.length - 1) : Math.min(i, next.length - 1);
  set({ ratings, view: { ...state.view, current: next[idx]?.id ?? null }, revealed: false });
  save();
}
export function undo(): void {
  if (state.loading) return;
  const h = history.pop();
  if (!h) return;
  const ratings = { ...state.ratings };
  if (h.old) ratings[h.id] = h.old; else delete ratings[h.id];
  set({ ratings, view: ensureCurrent(state.data, ratings, { ...h.view }), revealed: false });
  save();
}
export function applyImport(imported: Map<string, Rating>, importedNotes: Map<string, string> = new Map()): void {
  if (state.loading) return;
  const ratings = { ...state.ratings };
  for (const [id, r] of imported) ratings[id] = r;
  const notes = { ...state.notes };
  for (const [id, n] of importedNotes) notes[id] = n;
  history.length = 0;
  const noteText = importedNotes.size ? ` and ${importedNotes.size.toLocaleString()} notes` : '';
  set({ ratings, notes, view: ensureCurrent(state.data, ratings, state.view), revealed: false, notice: { text: `Restored ratings for ${imported.size.toLocaleString()} words${noteText} from the backup.`, warn: !state.storageOK } });
  save();
}
export function setNote(id: string, text: string): void {
  const notes = { ...state.notes };
  if (text.trim()) notes[id] = text; else delete notes[id];
  set({ notes });
  save();
}
function saveExtras(extras: ExtraWord[]): void {
  set({ extras });
  try { localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras)); } catch { set({ storageOK: false }); }
}
/** Adds an extra word (or updates its gloss). Returns false when the spelling is empty. */
export function addExtra(word: string, zh: string): boolean {
  const w = word.trim();
  if (!w) return false;
  const rest = state.extras.filter(x => extraKey(x.word) !== extraKey(w));
  const prior = state.extras.find(x => extraKey(x.word) === extraKey(w));
  saveExtras([...rest, { word: w, zh: zh.trim(), added_at: prior?.added_at || new Date().toISOString() }]);
  return true;
}
export function removeExtra(word: string): void { saveExtras(state.extras.filter(x => extraKey(x.word) !== extraKey(word))); }
export function importExtras(imported: ExtraWord[]): number {
  const { extras, added } = mergeExtras(state.extras, imported);
  saveExtras(extras);
  set({ notice: { text: `Added ${added.toLocaleString()} extra ${added === 1 ? 'word' : 'words'} from the CSV (${extras.length.toLocaleString()} in total).`, warn: false } });
  return added;
}
export function resetAll(): void {
  if (state.loading || !state.config) return;
  const rated = state.data.length - countStatuses(state.data, state.ratings).unreviewed;
  history.length = 0;
  set({ ratings: {}, view: ensureCurrent(state.data, {}, { ...state.view, current: null }), revealed: false, trail: [], notice: { text: `Cleared ${rated.toLocaleString()} ${rated === 1 ? 'rating' : 'ratings'} in ${state.config.label}. Every word is Unreviewed again.`, warn: !state.storageOK } });
  save();
}
