import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen } from 'lucide-react';
import { StorySourceBar } from '@/components/StorySourceBar.tsx';
import { DATASETS, datasetSlug } from '@/lib/datasets.ts';
import { byRound, fetchStoryIndex, storyPath, type StoryIndex, type StorySummary } from '@/lib/stories.ts';
import { Button } from '@/components/ui/button.tsx';
import { entryByWord, hasStories, statusOf, useAppState } from '@/state/store.ts';

/** /:ds/stories — every generated story with how many of its words you still rate Not sure / Don’t know. */
export function StoriesPage() {
  const [index, setIndex] = useState<(StoryIndex & { imported: boolean }) | null>(null);
  const config = useAppState(s => s.config);
  const available = useAppState(hasStories);
  const imported = useAppState(s => s.storiesImported);
  const dir = config?.stories;
  const ratings = useAppState(s => s.ratings);
  const loading = useAppState(s => s.loading);
  useEffect(() => { setIndex(null); if (config && available) void fetchStoryIndex(config.id, dir).then(setIndex); }, [config, dir, available, imported]);
  const slug = config ? datasetSlug(config.id) : '';
  const stories = index?.stories ?? null;
  const [hideLearned, setHideLearned] = useState(false);   // hide word groups with nothing left to study
  // one card per word group; A, B … are the stories written on it
  const groups: StorySummary[][] = stories ? [...stories.reduce((m, s) => m.set(s.n, [...(m.get(s.n) ?? []), s]), new Map<number, StorySummary[]>()).values()] : [];
  const src = index?.source;
  if (config && !available) {
    const others = DATASETS.filter(d => d.stories);
    return (
      <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Stories · 单词故事</h2>
        <p className="mt-2 text-muted-foreground">No stories for {config.label.split(' · ')[0]} in this browser or in the data folder. Stories are made from one collection’s review (Not sure / Don’t know words), so each collection has its own set; a private set can be kept as a bundle file and imported here, like a ratings backup. 这个词库还没有故事：可以导入 bundle.json。</p>
        <div className="mt-4"><StorySourceBar /></div>
        {others.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">{others.map(d => <li key={d.id}><Link to={`/${datasetSlug(d.id)}/stories`} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:border-primary hover:bg-accent/40"><BookOpen className="h-3.5 w-3.5" />Open the stories of {d.label.split(' · ')[0]}</Link></li>)}</ul>}
        <p className="mt-4 text-sm text-muted-foreground">To generate stories for this collection: export “To study”, run make_inputs.py in data/{config.id}/stories, have the batches written, run validate.py, then point this collection’s config at the folder (see README).</p>
      </section>
    );
  }
  const toStudy = (words: string[]): number => words.filter(w => { const e = entryByWord(w); const s = e ? statusOf(ratings, e.id) : 'unreviewed'; return s === 'not_sure' || s === 'dont_know'; }).length;
  return (
    <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Stories · 单词故事</h2>
          <p className="mt-1 text-sm text-muted-foreground">Each story teaches 60–110 of your Not sure / Don’t know words, every one used two or three times in context. Bold words open the card.</p>
        </div>
        {stories && <p className="text-right text-sm text-muted-foreground">{stories.length} stories on {groups.length} word groups · {groups.reduce((a, g) => a + g[0].words.length, 0).toLocaleString()} words covered{src?.source ? <><br />from the review {src.generated ?? ''} · {src.source}</> : null}</p>}
      </div>
      <div className="mb-4"><StorySourceBar /></div>
      {stories && stories.length > 0 && !loading && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Button size="sm" variant="outline" aria-pressed={hideLearned} onClick={() => setHideLearned(v => !v)}>{hideLearned ? '显示全部故事' : '只看还有生词的故事'}</Button><span>Word colours, “still to study” counts and quizzes follow your current ratings; a new round of stories is only needed when few unknown words remain (see WORKFLOWS.md).</span></div>}
      {!stories ? <p className="text-muted-foreground">Loading…</p> : stories.length === 0 ? <p className="text-muted-foreground">No stories generated yet.</p> : byRound(stories).map(({ round, stories: list }, ri, all) => {
        const groups: StorySummary[][] = [...list.reduce((m, s) => m.set(s.n, [...(m.get(s.n) ?? []), s]), new Map<number, StorySummary[]>()).values()];
        const shown = hideLearned && !loading ? groups.filter(g => toStudy(g[0].words) > 0) : groups;
        const cards = (
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3">
            {shown.map(g => { const s = g[0]; return (
              <li key={s.n} className="flex h-full flex-col gap-1 rounded-lg border px-4 py-3 hover:border-primary">
                <Link to={storyPath(slug, s.n, s.variant ?? '')} className="flex flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-3.5 w-3.5" />Story {s.n} · {s.words.length} words · {s.wordCount.toLocaleString()} words of text</span>
                  <span className="text-lg font-semibold leading-snug">{s.title}</span>
                  <span className="text-sm text-muted-foreground">{s.summary_zh}</span>
                </Link>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  {!loading ? <span className={toStudy(s.words) ? 'text-dontknow' : 'text-know'}>{toStudy(s.words) ? `${toStudy(s.words)} still to study` : 'all learned ✓'}</span> : <span />}
                  {g.length > 1 && <span className="flex items-center gap-1 text-muted-foreground">{g.length} stories:{g.map(v => <Link key={v.variant ?? ''} to={storyPath(slug, v.n, v.variant ?? '')} title={v.title} className="rounded border px-1.5 py-0.5 font-semibold text-primary hover:bg-accent/60">{v.variant ? v.variant.toUpperCase() : 'A'}</Link>)}</span>}
                </span>
              </li>
            ); })}
          </ol>
        );
        if (all.length === 1) return <div key={round}>{cards}{shown.length === 0 && <p className="text-muted-foreground">Every word in these stories is learned. 全部掌握了。</p>}</div>;
        // several rounds: the latest is open, earlier ones fold away (still readable)
        return (
          <details key={round} open={ri === 0} className="mb-3 rounded-lg border bg-[#f8f9fd] px-4 py-2">
            <summary className="cursor-pointer text-sm"><b>Round {round} · 第 {round} 轮</b> <span className="text-muted-foreground">· {groups.length} word groups · {list.length} stories{ri === 0 ? ' · latest' : ''}{!loading ? ` · ${groups.reduce((a, g) => a + toStudy(g[0].words), 0).toLocaleString()} still to study` : ''}</span></summary>
            <div className="mt-2 pb-1">{cards}{shown.length === 0 && <p className="text-sm text-muted-foreground">Every word in this round is learned.</p>}</div>
          </details>
        );
      })}
    </section>
  );
}
