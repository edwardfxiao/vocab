import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { WordHoverCard } from '@/components/WordHoverCard.tsx';
import { datasetSlug } from '@/lib/datasets.ts';
import type { Status } from '@/lib/ratings.ts';
import { entryByWord, getState, jumpToWord, setTrail, statusOf, trailWithCurrent, useAppState } from '@/state/store.ts';
import { cn } from '@/lib/utils.ts';

const STATE_CLASS: Record<Status, string> = {
  unreviewed: 'border-border bg-white', definitely_know: 'border-know-line bg-know-soft text-know',
  not_sure: 'border-unsure-line bg-unsure-soft text-unsure', dont_know: 'border-dontknow-line bg-dontknow-soft text-dontknow',
};

/** /:ds/root/:root — every word in the collection that shares one root, with the root letters highlighted. */
export function RootPage() {
  const { root = '' } = useParams();
  const navigate = useNavigate();
  const config = useAppState(s => s.config);
  const enrichment = useAppState(s => s.enrichment);
  const ratings = useAppState(s => s.ratings);
  const loading = useAppState(s => s.loading);
  const slug = config ? datasetSlug(config.id) : '';
  const group = enrichment.roots[root];
  const words = (group?.words ?? []).map(w => ({ word: w, entry: entryByWord(w) })).filter(x => x.entry);
  const counts = words.reduce<Record<Status, number>>((acc, x) => { const s = statusOf(ratings, x.entry!.id); acc[s]++; return acc; }, { unreviewed: 0, definitely_know: 0, not_sure: 0, dont_know: 0 });
  const open = (word: string): void => {
    const t = entryByWord(word);
    if (!t) return;
    const nextTrail = getState().view.current === t.id ? getState().trail : trailWithCurrent();
    setTrail(nextTrail);
    jumpToWord(t.id);
    navigate(`/${slug}/w/${encodeURIComponent(t.word)}`, { state: { trail: nextTrail } });
  };
  return (
    <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/${slug}`} className="text-sm text-primary hover:underline"><ArrowLeft className="mr-1 inline h-3.5 w-3.5" />Back to the checker</Link>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">词根 <span className="text-primary">{root}</span>{group ? ` · ${group.meaning}` : ''}</h2>
        </div>
        {group && <p className="text-sm text-muted-foreground">{words.length} words in {config?.label.split(' · ')[0]} · ✓ {counts.definitely_know} · ? {counts.not_sure} · ✗ {counts.dont_know} · unreviewed {counts.unreviewed}</p>}
      </div>
      {loading ? <p className="text-muted-foreground">Loading collection…</p> : !group ? <p className="text-muted-foreground">No root “{root}” in the enrichment data.</p> : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
          {words.map(({ word, entry }) => {
            const e = enrichment.words[word];
            const m = e?.root?.match ?? '';
            const i = m ? word.indexOf(m) : -1;
            const s = statusOf(ratings, entry!.id);
            return (
              <li key={word} className="h-full">
                <WordHoverCard entry={entry!} status={s} slug={slug} zh={e?.gloss} onOpen={open} side="bottom">
                  <button type="button" onClick={() => open(word)} className={cn('flex h-full w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left hover:brightness-95', STATE_CLASS[s])}>
                    <span className="text-lg font-semibold">{i >= 0 ? <>{word.slice(0, i)}<span className="underline decoration-primary decoration-2 underline-offset-4">{word.slice(i, i + m.length)}</span>{word.slice(i + m.length)}</> : word}</span>
                    <span className="text-sm text-muted-foreground">{e?.gloss || entry!.meaning_zh.split('\n')[0]}</span>
                  </button>
                </WordHoverCard>
              </li>
            );
          })}
        </ul>
      )}
      {group && <div className="mt-5"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back</Button></div>}
    </section>
  );
}
