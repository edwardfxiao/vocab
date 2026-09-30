export const STATES = ['unreviewed', 'definitely_know', 'not_sure', 'dont_know'] as const;
export type Status = (typeof STATES)[number];
export type RatedStatus = Exclude<Status, 'unreviewed'>;

export const LABELS: Record<Status, string> = { unreviewed: 'Unreviewed', definitely_know: 'Definitely know', not_sure: 'Not sure', dont_know: 'Don’t know' };
export const LIST_MARKS: Record<Status, string> = { unreviewed: '—', definitely_know: 'Know', not_sure: 'Unsure', dont_know: 'Don’t know' };

/** Older exports and saved progress used “unknown” for the third rating. */
const LEGACY_STATES: Record<string, Status> = { unknown: 'dont_know' };
export function normalizeStatus(status: unknown): string {
  return typeof status === 'string' ? (LEGACY_STATES[status] ?? status) : '';
}
export function isStatus(value: string): value is Status {
  return (STATES as readonly string[]).includes(value);
}

export interface Rating { status: Status; reviewed_at: string }
export type Ratings = Record<string, Rating>;

export type StatusFilter = Status | 'all' | 'to_study' | 'reviewed';
export const STATUS_FILTERS: readonly StatusFilter[] = ['unreviewed', 'reviewed', 'all', 'definitely_know', 'not_sure', 'dont_know', 'to_study'];
export type Order = 'frequency' | 'az' | 'za';

export interface ViewState {
  filter: StatusFilter;
  invert: boolean;
  source: string;
  search: string;
  order: Order;
  current: string | null;
}
export const defaultView = (): ViewState => ({ filter: 'unreviewed', invert: false, source: 'all', search: '', order: 'frequency', current: null });

export function statusMatches(status: Status, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'to_study') return status === 'not_sure' || status === 'dont_know';
  if (filter === 'reviewed') return status !== 'unreviewed';
  return status === filter;
}

/** Inverted filter: the complement within reviewed words, except Unreviewed/Reviewed which swap with each other. */
export function viewMatches(status: Status, view: Pick<ViewState, 'filter' | 'invert'>): boolean {
  if (!view.invert || view.filter === 'all') return statusMatches(status, view.filter);
  if (view.filter === 'unreviewed') return status !== 'unreviewed';
  if (view.filter === 'reviewed') return status === 'unreviewed';
  return status !== 'unreviewed' && !statusMatches(status, view.filter);
}

// ---- persistence (same keys as the original checker, so progress carries over) ----
export const storageKey = (datasetId: string): string => `word-by-word.${datasetId}.v2`;
export const LAST_DATASET_KEY = 'word-by-word.last-dataset.v2';
export const SHOW_MEANING_KEY = 'word-by-word.show-meaning.v1';

export interface SavedProgress { version: 2; ratings: Ratings; view: ViewState }

interface RawSaved { ratings?: unknown; view?: unknown }

/** Reads saved progress, keeping only ratings for ids present in the dataset and only valid view fields. Throws when the blob is corrupt. */
export function readSavedProgress(raw: string | null, ids: ReadonlySet<string>, sources: ReadonlySet<string>): { ratings: Ratings; view: ViewState } | null {
  if (!raw) return null;
  const saved = JSON.parse(raw) as RawSaved | null;
  if (!saved) return null;
  return coerceSaved(saved, ids, sources);
}

export function coerceSaved(saved: RawSaved, ids: ReadonlySet<string>, sources: ReadonlySet<string>): { ratings: Ratings; view: ViewState } {
  if (!saved.ratings || typeof saved.ratings !== 'object') throw new Error('Invalid ratings');
  const ratings: Ratings = {};
  for (const [id, entry] of Object.entries(saved.ratings as Record<string, unknown>)) {
    if (!ids.has(id) || !entry || typeof entry !== 'object') continue;
    const e = entry as { status?: unknown; reviewed_at?: unknown };
    const status = normalizeStatus(e.status);
    if (isStatus(status)) ratings[id] = { status, reviewed_at: typeof e.reviewed_at === 'string' ? e.reviewed_at : '' };
  }
  const view = defaultView();
  const v = saved.view;
  if (v && typeof v === 'object') {
    const o = v as Partial<Record<keyof ViewState, unknown>>;
    if (typeof o.filter === 'string' && (STATUS_FILTERS as readonly string[]).includes(o.filter)) view.filter = o.filter as StatusFilter;
    if (typeof o.source === 'string' && (o.source === 'all' || sources.has(o.source))) view.source = o.source;
    if (o.order === 'frequency' || o.order === 'az' || o.order === 'za') view.order = o.order;
    if (typeof o.search === 'string') view.search = o.search;
    if (typeof o.current === 'string') view.current = o.current;
    view.invert = o.invert === true;
  }
  return { ratings, view };
}

export function serializeProgress(ratings: Ratings, view: ViewState): string {
  const saved: SavedProgress = { version: 2, ratings, view };
  return JSON.stringify(saved);
}
