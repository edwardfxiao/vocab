import { withBase } from './base.ts';
import { getStoryBundle } from './storyBundle.ts';

/** Generated vocabulary stories (data/<dataset>/stories, see DatasetConfig.stories, or a bundle imported into the browser):
 *  each teaches ~60–110 of that collection's Not sure / Don’t know words, bolded as **word** in the text. */
export interface StoryGlossaryEntry { word: string; zh: string }
/** `n` is the word group (batch number); `variant` ('b', 'c' …) marks a further story on the same words, the first has none. */
export interface StorySummary { n: number; variant?: string; round?: number; title: string; summary_zh: string; words: string[]; wordCount: number }
/** Stories grouped by round (latest first); a story without `round` is round 1. */
export function byRound<T extends { round?: number }>(stories: T[]): { round: number; stories: T[] }[] {
  const m = new Map<number, T[]>();
  for (const s of stories) { const r = s.round ?? 1; m.set(r, [...(m.get(r) ?? []), s]); }
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([round, list]) => ({ round, stories: list }));
}
export const storyKey = (s: { n: number; variant?: string }): string => `${s.n}${s.variant ?? ''}`;
export const storyLabel = (s: { n: number; variant?: string }): string => `Story ${s.n}${s.variant ? ' · ' + s.variant.toUpperCase() : ''}`;
export const storyPath = (slug: string, n: number, variant = ''): string => `/${slug}/stories/${n}${variant ? '/' + variant : ''}`;
export interface Story extends Omit<StorySummary, 'wordCount'> { paragraphs: string[]; glossary: StoryGlossaryEntry[] }
/** Which review export the stories were generated from (batches/meta.json, copied into index.json by validate.py). */
export interface StorySource { source?: string; dataset?: string; study_words?: number; batches?: number; generated?: string }
export interface StoryIndex { source: StorySource; stories: StorySummary[] }

export const wordCount = (paragraphs: string[]): number => (paragraphs.join('\n').match(/[A-Za-z']+/g) ?? []).length;

/** Stories imported into this browser (IndexedDB) win over the collection's stories folder; either may be absent. */
export async function fetchStoryIndex(dataset: string, dir?: string): Promise<StoryIndex & { imported: boolean }> {
  const bundle = await getStoryBundle(dataset);
  if (bundle) return { imported: true, source: bundle.source, stories: bundle.stories.map(s => ({ n: s.n, ...(s.variant ? { variant: s.variant } : {}), ...(s.round ? { round: s.round } : {}), title: s.title, summary_zh: s.summary_zh, words: s.words, wordCount: wordCount(s.paragraphs) })) };
  if (!dir) return { imported: false, source: {}, stories: [] };
  const r = await fetch(withBase(`${dir}/index.json`));
  if (!r.ok) return { imported: false, source: {}, stories: [] };
  const data = await r.json() as { source?: StorySource; stories?: StorySummary[] };
  return { imported: false, source: data.source ?? {}, stories: data.stories ?? [] };
}
export async function fetchStory(dataset: string, dir: string | undefined, n: number, variant = ''): Promise<Story | null> {
  const bundle = await getStoryBundle(dataset);
  if (bundle) return bundle.stories.find(s => s.n === n && (s.variant ?? '') === variant) ?? null;
  if (!dir) return null;
  const r = await fetch(withBase(`${dir}/story-${String(n).padStart(3, '0')}${variant ? '-' + variant : ''}.json`));
  return r.ok ? (await r.json() as Story) : null;
}

export type Segment = { kind: 'text'; text: string } | { kind: 'word'; text: string };
/** Splits "a **bold** b" into text and bold segments. */
export function segments(paragraph: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of paragraph.matchAll(re)) {
    if (m.index > last) out.push({ kind: 'text', text: paragraph.slice(last, m.index) });
    out.push({ kind: 'word', text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < paragraph.length) out.push({ kind: 'text', text: paragraph.slice(last) });
  return out;
}
/** Maps an inflected bold token back to one of the story's target words. Phrasal verbs are bolded whole (“hemmed in”): the verb decides. */
export function targetFor(token: string, words: readonly string[]): string | undefined {
  const b = token.toLowerCase().trim().split(' ')[0];
  return words.find(w => b === w) ?? words.find(w => b.startsWith(w)) ?? words.find(w => (w.endsWith('e') ? b.startsWith(w.slice(0, -1)) : false) || (w.endsWith('y') && b.startsWith(w.slice(0, -1) + 'i')));
}
