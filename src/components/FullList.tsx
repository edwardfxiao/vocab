import { memo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import type { WordEntry } from '@/lib/words.ts';
import { entryByWord, getState, jumpToWord, setTrail, statusOf, trailWithCurrent, useAppState } from '@/state/store.ts';
import type { Ratings } from '@/lib/ratings.ts';
import { withBase } from '@/lib/base.ts';

/** One row per word: a plain anchor (not a router Link, which would subscribe 13,000 components to the router) with layout containment. */
const Row = memo(function Row({ word, href, status }: { word: string; href: string; status: string }) {
  // Styled in globals.css (.fullrow): Tailwind arbitrary values turn the underscore in data-[state=dont_know] into a space.
  return <a href={href} data-state={status} className="fullrow"><span className="fullrow-word">{word}</span></a>;
});

/** Plain-text mirror of the whole collection so the browser's Find (Cmd+F) can search every word. Clicks are delegated once. */
export function FullList({ data, ratings, label, slug, onOpen }: { data: WordEntry[]; ratings: Ratings; label: string; slug: string; onOpen: (word: string) => void }) {
  const onClick = (e: MouseEvent<HTMLDivElement>): void => {
    const a = (e.target as Element).closest('a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  // let modifier clicks open a new tab
    e.preventDefault();
    onOpen(a.querySelector('.fullrow-word')?.textContent ?? a.textContent ?? '');
  };
  return (
    <section aria-label="Full word list of the current dataset as plain text" className="mt-5 overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-baseline gap-3 border-b px-4 py-3">
        <strong className="text-sm">Full word list of current dataset: {label}</strong>
        <span className="text-sm text-muted-foreground">{data.length.toLocaleString()} words</span>
        <span className="text-sm text-muted-foreground">Every word, so the browser’s Find (Cmd+F / Ctrl+F) can search all of it. ✓ know · ? not sure · ✗ don’t know · no mark = unreviewed.</span>
      </div>
      <div onClick={onClick} className="grid max-h-[420px] auto-rows-[22px] grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-x-6 overflow-auto px-4 py-3">
        {data.map(r => <Row key={r.id} word={r.word} href={withBase(`${slug}/w/${encodeURIComponent(r.word)}`)} status={statusOf(ratings, r.id)} />)}
      </div>
    </section>
  );
}

export function FullListConnected({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const data = useAppState(s => s.data);
  const ratings = useAppState(s => s.ratings);
  const label = useAppState(s => s.config?.label.split(' · ')[0] ?? '—');
  const onOpen = (word: string): void => {
    const target = entryByWord(word);
    if (!target) return;
    const nextTrail = getState().view.current === target.id ? getState().trail : trailWithCurrent();
    setTrail(nextTrail);
    jumpToWord(target.id);
    navigate(`/${slug}/w/${encodeURIComponent(target.word)}`, { state: { trail: nextTrail } });   // router path (no base prefix); `href` is the plain link
  };
  return <FullList data={data} ratings={ratings} label={label} slug={slug} onOpen={onOpen} />;
}
