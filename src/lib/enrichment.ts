/** Learner-oriented layer generated into layers/enrichment/enrichment.json (see layers/enrichment/PROMPT.md). */

export interface RootInfo { key: string; meaning: string; match: string }
export interface WordEnrichment {
  gloss: string;
  trap: string;
  root: RootInfo | null;
  confusable: string[];
  synonyms: string[];
  antonyms: string[];
}
export interface RootGroup { meaning: string; words: string[] }
export interface Enrichment {
  words: Record<string, WordEnrichment>;
  roots: Record<string, RootGroup>;
  confusable: Record<string, string[]>;
  compounds: Record<string, [string, string]>;
  families: Record<string, string[]>;
  variants: Record<string, string[]>;
  synonyms: Record<string, string[]>;
  antonyms: Record<string, string[]>;
}

export const EMPTY_ENRICHMENT: Enrichment = { words: {}, roots: {}, confusable: {}, compounds: {}, families: {}, variants: {}, synonyms: {}, antonyms: {} };

export const SUFFIXES = ['ology', 'ism', 'ist', 'ant', 'ent', 'ee', 'ify', 'ize', 'ise', 'ous', 'ive', 'able', 'ible', 'ment', 'ness', 'ship', 'hood', 'ward', 'wise', 'less', 'ful', 'ly'] as const;

export type RelationKind = 'confusable' | 'root' | 'family' | 'synonyms' | 'antonyms' | 'variants' | 'compound' | 'partOf' | 'suffix';
export interface RelationRow { kind: RelationKind; label: string; words: string[]; rootKey?: string; extra?: string }

export function buildPartOf(enrichment: Enrichment): Map<string, string[]> {
  const partOf = new Map<string, string[]>();
  for (const [w, parts] of Object.entries(enrichment.compounds)) for (const p of parts) partOf.set(p, [...(partOf.get(p) ?? []), w]);
  return partOf;
}

/** Relation rows for one word; `exists` filters to words present in the loaded dataset, `allWords` powers the suffix row. */
export function relationRows(word: string, enrichment: Enrichment, partOf: Map<string, string[]>, exists: (w: string) => boolean, allWords: readonly string[]): RelationRow[] {
  const w = word.toLowerCase();
  const e = enrichment.words[w];
  const rows: RelationRow[] = [];
  const listed = (ws: readonly string[] | undefined): string[] => [...new Set(ws ?? [])].filter(x => x !== w && exists(x));
  const add = (kind: RelationKind, label: string, ws: readonly string[] | undefined, more: Partial<RelationRow> = {}): void => {
    const l = listed(ws);
    if (l.length) rows.push({ kind, label, words: l, ...more });
  };
  add('confusable', '形近易混', enrichment.confusable[w]);
  const rootKey = e?.root?.key;
  if (rootKey && enrichment.roots[rootKey]) add('root', `同根 ${rootKey} · ${enrichment.roots[rootKey].meaning}`, enrichment.roots[rootKey].words, { rootKey });
  add('family', '同族衍生', enrichment.families[w]);
  add('synonyms', '近义 / 同类', enrichment.synonyms[w]);
  add('antonyms', '反义', enrichment.antonyms[w]);
  add('variants', '拼写变体', enrichment.variants[w]);
  add('compound', '复合词拆分', enrichment.compounds[w]);
  add('partOf', '含此词的复合词', partOf.get(w));
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      const all = allWords.filter(x => x.endsWith(s) && x !== w && x.length - s.length >= 3);
      if (all.length >= 2) rows.push({ kind: 'suffix', label: `同后缀 -${s}`, words: all.slice(0, 12), extra: all.length > 12 ? `共 ${all.length.toLocaleString()} 个` : undefined });
      break;
    }
  }
  return rows;
}
