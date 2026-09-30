import { withBase } from './base.ts';

export type DatasetKind = 'dictionary' | 'vocabulary' | 'reading' | 'listening' | 'spelling';

export interface DatasetConfig {
  id: string;
  label: string;
  file: string;
  kind: DatasetKind;
  notes?: string;
  description?: string;
  /** Folder of generated stories for this collection (index.json + story-NNN.json), made from one of its review exports. Absent = no Stories tab. */
  stories?: string;
}

/** The collections found under data/ (every folder with a dataset.json), in their declared order. Filled once at startup by
 *  loadDatasetIndex() from /data/index.json, which scripts/data-index.mjs generates (and the dev server / serve.py build live).
 *  Deleting a data folder removes its collections: nothing here names them. */
export const DATASETS: DatasetConfig[] = [];
const KINDS: readonly DatasetKind[] = ['dictionary', 'vocabulary', 'reading', 'listening', 'spelling'];

/** Validates one index entry (the file is generated, but a hand-edited copy should not crash the app). */
function asConfig(x: unknown): DatasetConfig | null {
  const o = x as Partial<Record<keyof DatasetConfig, unknown>> | null;
  if (!o || typeof o.id !== 'string' || typeof o.label !== 'string' || typeof o.file !== 'string' || !KINDS.includes(o.kind as DatasetKind)) return null;
  const c: DatasetConfig = { id: o.id, label: o.label, file: o.file, kind: o.kind as DatasetKind };
  if (typeof o.notes === 'string') c.notes = o.notes;
  if (typeof o.description === 'string') c.description = o.description;
  if (typeof o.stories === 'string') c.stories = o.stories;
  return c;
}
export function setDatasets(list: unknown[]): DatasetConfig[] {
  const seen = new Set<string>();
  DATASETS.length = 0;
  for (const x of list) { const c = asConfig(x); if (c && !seen.has(c.id)) { seen.add(c.id); DATASETS.push(c); } }
  return DATASETS;
}
/** Loads the collection index; resolves to the number of collections (0 when the index is missing or empty). */
export async function loadDatasetIndex(): Promise<number> {
  const r = await fetch(withBase('data/index.json'), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Could not read data/index.json (HTTP ${r.status}). Run \`node scripts/data-index.mjs\` or \`npm run build\`.`);
  const body = await r.json() as { collections?: unknown[] };
  return setDatasets(Array.isArray(body.collections) ? body.collections : []).length;
}

/** Dataset ids of multi-CSV folders contain a slash (folder/name); URLs use a dash-safe slug instead. */
export const datasetSlug = (id: string): string => id.replaceAll('/', '~');
export const datasetFromSlug = (slug: string): DatasetConfig | undefined => DATASETS.find(d => datasetSlug(d.id) === slug);

export function categoryLabel(value: string): string {
  const labels: Record<string, string> = { all: 'All categories', ielts_tag: 'IELTS tagged', common_supplement: 'Common supplement', extension: 'Extension · beyond the 8,000', academic: 'Academic lists · AWL / NAWL gaps' };
  return labels[value] ?? value;
}
