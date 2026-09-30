import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { StoryQuiz } from '@/components/StoryQuiz.tsx';
import { StorySourceBar } from '@/components/StorySourceBar.tsx';
import { datasetSlug } from '@/lib/datasets.ts';
import { byRound, fetchStory, fetchStoryIndex, type Story, type StoryGlossaryEntry, type StorySummary } from '@/lib/stories.ts';
import { entryByWord, hasStories, statusOf, useAppState } from '@/state/store.ts';
import { cn } from '@/lib/utils.ts';

const storyCache = new Map<string, Promise<Story | null>>();
const loadStory = (dataset: string, dir: string | undefined, n: number, imported: boolean): Promise<Story | null> => {
  const key = `${dataset}/${imported ? 'imported' : dir}/${n}`;
  let p = storyCache.get(key);
  if (!p) { p = fetchStory(dataset, dir, n); storyCache.set(key, p); }
  return p;
};
const parseSelection = (raw: string | null): number[] => (raw ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);

/** /:ds/practice?s=1,2 — pick one or more stories and quiz their glossaries together (the same quiz as on a story page). */
export function PracticePage() {
  const [params, setParams] = useSearchParams();
  const config = useAppState(s => s.config);
  const ratings = useAppState(s => s.ratings);
  const dir = config?.stories;
  const available = useAppState(hasStories);
  const imported = useAppState(s => s.storiesImported);
  const slug = config ? datasetSlug(config.id) : '';
  const [index, setIndex] = useState<StorySummary[] | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const selected = useMemo(() => parseSelection(params.get('s')), [params]);
  const selectedKey = selected.join(',');

  useEffect(() => { setIndex(null); if (config && available) void fetchStoryIndex(config.id, dir).then(i => setIndex(i.stories.filter((s, k, all) => all.findIndex(o => o.n === s.n) === k))); }, [config, dir, available, imported]);   // one entry per word group (variants share the words)
  useEffect(() => {
    if (!config || !available) return;
    let live = true;
    void Promise.all(selected.map(n => loadStory(config.id, dir, n, imported))).then(list => { if (live) setStories(list.filter((s): s is Story => !!s)); });
    return () => { live = false; };
  }, [config, dir, available, imported, selectedKey]);   // selectedKey stands in for `selected`

  const setSelection = (ns: number[]): void => { const next = new URLSearchParams(params); if (ns.length) next.set('s', [...ns].sort((a, b) => a - b).join(',')); else next.delete('s'); setParams(next, { replace: true }); };
  const toggle = (n: number): void => setSelection(selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n]);
  const glossary = useMemo(() => {
    const seen = new Set<string>(); const out: StoryGlossaryEntry[] = [];
    for (const s of stories) for (const g of s.glossary) { const k = g.word.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(g); } }
    return out;
  }, [stories]);
  const toStudy = (words: string[]): number => words.filter(w => { const e = entryByWord(w); const s = e ? statusOf(ratings, e.id) : 'unreviewed'; return s === 'not_sure' || s === 'dont_know'; }).length;

  if (config && !available) return <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6"><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Practice · 练习</h2><p className="mt-2 text-muted-foreground">Practice uses the story glossaries, and {config.label.split(' · ')[0]} has no stories yet. <Link to={`/${slug}/stories`} className="text-primary hover:underline">See which collections have stories</Link> · <Link to={`/${slug}/practice/list`} className="text-primary hover:underline">Practice from a CSV →</Link></p><div className="mt-4"><StorySourceBar /></div></section>;
  return (
    <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Practice · 练习</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tick one or more stories (a word group with several stories counts once); their glossaries are combined into one quiz. 勾选故事，合并练习。 · <Link to={`/${slug}/practice/list`} className="text-primary hover:underline">Practice from an exported CSV instead →</Link></p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!index} onClick={() => setSelection((index ?? []).map(s => s.n))}>Select all</Button>
          <Button size="sm" variant="outline" disabled={!selected.length} onClick={() => setSelection([])}>Clear</Button>
        </div>
      </div>
      <div className="mb-4"><StorySourceBar /></div>
      {!index ? <p className="text-muted-foreground">Loading stories…</p> : byRound(index).map(({ round, stories: list }, ri, all) => {
        const grid = (
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-2">
            {list.map(s => { const on = selected.includes(s.n); return (
              <li key={s.n}>
                <label className={cn('flex h-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm hover:border-primary', on && 'border-primary bg-accent/40')}>
                  <input type="checkbox" checked={on} onChange={() => toggle(s.n)} className="mt-1 accent-primary" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpen className="h-3 w-3" />Story {s.n} · {s.words.length} words · <span className="text-dontknow">{toStudy(s.words)} to study</span></span>
                    <span className="block truncate font-medium" title={s.title}>{s.title}</span>
                  </span>
                </label>
              </li>
            ); })}
          </ol>
        );
        if (all.length === 1) return <div key={round}>{grid}</div>;
        return (
          <details key={round} open={ri === 0} className="mb-3 rounded-lg border bg-[#f8f9fd] px-3 py-2">
            <summary className="cursor-pointer text-sm"><b>Round {round} · 第 {round} 轮</b> <span className="text-muted-foreground">· {list.length} word groups{ri === 0 ? ' · latest' : ''}</span></summary>
            <div className="mt-2">{grid}</div>
          </details>
        );
      })}
      {selected.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{selected.length} {selected.length === 1 ? 'story' : 'stories'} selected · {glossary.length.toLocaleString()} words{stories.length < selected.length ? ' · loading…' : ''} · <Link to={`/${slug}/stories/${selected[0]}`} className="text-primary hover:underline">read Story {selected[0]}</Link></p>
      )}
      {glossary.length > 0 && stories.length === selected.length ? <StoryQuiz key={selectedKey} glossary={glossary} slug={slug} exportLabel={`stories-${selected.join('-')}-missed`} /> : selected.length === 0 && index && <p className="mt-6 text-muted-foreground">Pick a story above to start.</p>}
    </section>
  );
}
