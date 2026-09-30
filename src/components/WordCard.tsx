import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { categoryLabel, datasetSlug } from '@/lib/datasets.ts';
import { relationRows, type RelationRow } from '@/lib/enrichment.ts';
import { LABELS, type Status } from '@/lib/ratings.ts';
import type { WordEntry } from '@/lib/words.ts';
import { clearScrollTo, entryByWord, jumpToWord, setNote, syllablesOf, navigate as moveBy, partOfMap, rate, setShowMeaning, setTrail, showAll, statusOf, toggleReveal, undo, useAppState, type TrailEntry } from '@/state/store.ts';
import { WordActions } from '@/components/WordActions.tsx';
import { WordHoverCard } from '@/components/WordHoverCard.tsx';
import { cn } from '@/lib/utils.ts';

const STATE_CLASS: Record<Status, string> = {
  unreviewed: 'border-border bg-white text-foreground', definitely_know: 'border-know-line bg-know-soft text-know',
  not_sure: 'border-unsure-line bg-unsure-soft text-unsure', dont_know: 'border-dontknow-line bg-dontknow-soft text-dontknow',
};
const BADGE_CLASS: Record<Status, string> = { unreviewed: 'bg-[#f0f3f9] text-[#495771]', definitely_know: 'bg-[#e6f5ec] text-know', not_sure: 'bg-[#fff3d8] text-unsure', dont_know: 'bg-[#ffebee] text-dontknow' };

export function WordCard({ queue, keyHints = true }: { queue: WordEntry[]; keyHints?: boolean }) {
  const navigate = useNavigate();
  const ratings = useAppState(s => s.ratings);
  const view = useAppState(s => s.view);
  const config = useAppState(s => s.config);
  const data = useAppState(s => s.data);
  const loading = useAppState(s => s.loading);
  const canUndo = useAppState(s => s.canUndo);
  const enrichment = useAppState(s => s.enrichment);
  const showMeaning = useAppState(s => s.showMeaning);
  const revealed = useAppState(s => s.revealed);
  const trail = useAppState(s => s.trail);
  const notes = useAppState(s => s.notes);
  const scrollTo = useAppState(s => s.scrollTo);
  const index = queue.findIndex(r => r.id === view.current);
  const r = queue[index];
  const syllables = useAppState(() => (r ? syllablesOf(r.word) : undefined));
  const [englishOpen, setEnglishOpen] = useState(false);
  useEffect(() => setEnglishOpen(false), [r?.id]);
  // Entering a word by link (chip, list, story, root page, address bar) scrolls the card to the top, under the sticky
  // stats bar, so the meaning is in view without scrolling. Ratings and arrows advance without moving the page.
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!r || scrollTo !== r.id) return;
    // Instant, after layout settles: a smooth animation gets interrupted by scroll anchoring when the card's height changes.
    requestAnimationFrame(() => {
      clearScrollTo();
      const card = cardRef.current;
      if (!card) return;
      window.scrollTo({ top: Math.max(0, card.getBoundingClientRect().top + window.scrollY - 64), behavior: 'auto' });
    });
  }, [r?.id, scrollTo]);
  const slug = config ? datasetSlug(config.id) : '';
  const isDictionary = config?.kind === 'dictionary';
  const e = r && isDictionary ? enrichment.words[r.word.toLowerCase()] : undefined;
  const open = showMeaning || revealed;
  const allWords = isDictionary ? data.map(x => x.word.toLowerCase()) : [];
  const rows: RelationRow[] = r && isDictionary ? relationRows(r.word, enrichment, partOfMap(), w => !!entryByWord(w), allWords) : [];
  const trailLabel = (e: TrailEntry): string => e.kind === 'word' ? (data.find(x => x.id === e.id)?.word ?? e.id) : `Story ${e.n}${e.variant ? ' ' + e.variant.toUpperCase() : ''}`;
  const trailWords = trail.map(trailLabel);

  const href = (w: string): string => `/${slug}/w/${encodeURIComponent(w)}`;
  const go = (word: string): void => {
    const target = entryByWord(word);
    if (!target || !r) return;
    const nextTrail: TrailEntry[] = target.id === r.id ? trail : [...trail, { kind: 'word', id: r.id }];
    setTrail(nextTrail);
    jumpToWord(target.id);
    navigate(href(target.word), { state: { trail: nextTrail } });
  };
  const back = (): void => {
    const rest = [...trail];
    const to = rest.pop();
    if (!to) return;
    if (to.kind === 'story') {
      setTrail(rest);
      navigate(`/${slug}/stories/${to.n}${to.variant ? '/' + to.variant : ''}`, { state: { trail: rest, scrollY: to.scrollY } });
      return;
    }
    const w = data.find(x => x.id === to.id);
    if (!w) return;
    setTrail(rest);
    jumpToWord(w.id);
    navigate(href(w.word), { state: { trail: rest } });
  };

  if (!r) {
    const done = data.length > 0 && data.every(x => statusOf(ratings, x.id) !== 'unreviewed');
    return (
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border bg-white px-4 py-14 text-center" aria-label="Word review">
        <h2 className="text-2xl font-semibold">{loading ? 'Loading collection…' : done && view.filter === 'unreviewed' ? 'Every word reviewed.' : 'No words in this view.'}</h2>
        <p className="mt-2 text-muted-foreground">{loading ? '' : done ? 'Export “To study” to start learning the words you were unsure of or didn’t know.' : view.invert ? 'The inverted filter left nothing. Untick “Show the rest” or pick another status.' : 'Try another status, collection, or search.'}</p>
        {!loading && <Button variant="outline" className="mt-5" onClick={showAll}>Show all words</Button>}
      </section>
    );
  }
  const status = statusOf(ratings, r.id);
  const match = e?.root?.match;
  const mi = match ? r.word.toLowerCase().indexOf(match) : -1;
  return (
    <section ref={cardRef} className="flex min-h-[420px] flex-col rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6" aria-label="Word review">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{(index + 1).toLocaleString()} / {queue.length.toLocaleString()} · {categoryLabel(r.selection)}</span>
        <span className={cn('rounded-full px-2.5 py-1 text-[13px]', BADGE_CLASS[status])}>{LABELS[status]}</span>
      </div>
      {trail.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#c2d0ff] bg-accent px-3 py-2 text-sm">
          <Button variant="outline" size="sm" onClick={back} className="gap-1"><ArrowLeft className="h-3.5 w-3.5" />Back to {trailWords.at(-1)}</Button>
          <span className="text-muted-foreground">Trail: {trailWords.join(' → ')} → <b className="text-foreground">{r.word}</b></span>
        </div>
      )}
      <div className="flex flex-col items-center px-0 pb-6 pt-5 text-center">
        <h2 className="font-serif text-[clamp(36px,5vw,66px)] font-medium leading-tight tracking-tight [overflow-wrap:anywhere]">
          {mi >= 0 && match ? <>{r.word.slice(0, mi)}<span className="text-primary">{r.word.slice(mi, mi + match.length)}</span>{r.word.slice(mi + match.length)}</> : r.word}
        </h2>
        <p className="flex min-h-[26px] flex-wrap items-center justify-center gap-x-3 gap-y-0 text-[17px] text-muted-foreground">
          {syllables?.includes('·') && <span className="tracking-wide text-foreground/70" title="Syllables">{syllables}</span>}
          <span className="flex items-center gap-1">{r.phonetic ? `/${r.phonetic}/` : ''}<WordActions word={r.word} /></span>
        </p>
        {e?.root && <button type="button" onClick={() => navigate(`/${slug}/root/${encodeURIComponent(e.root!.key)}`)} className="mt-0.5 text-sm text-primary hover:underline" title="See every word with this root">词根 {e.root.key} · {e.root.meaning} →</button>}
        <div className="mx-auto mt-5 grid w-full max-w-[760px] grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
          {([['definitely_know', 'Definitely know'], ['dont_know', 'Don’t know'], ['not_sure', 'Not sure']] as const).map(([s, label]) => (
            <button key={s} type="button" disabled={loading} onClick={() => rate(s)} className={cn('rounded-lg border px-2 py-3 text-base font-semibold transition hover:brightness-95 sm:py-4 sm:text-[17px]', STATE_CLASS[s])}>{label}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4">
          {!showMeaning && <button type="button" onClick={toggleReveal} aria-expanded={open} className="rounded-md px-3 py-2 text-sm text-primary hover:bg-accent">{open ? 'Hide meaning ↑' : 'Show meaning ↓'}</button>}
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Switch id="always-show" checked={showMeaning} onCheckedChange={setShowMeaning} /><label htmlFor="always-show" className="cursor-pointer select-none">Always show meaning</label></div>
        </div>
        {open && (
          <div className="mx-auto mt-4 w-full max-w-[600px] border-t pt-4 text-left">
            {e?.gloss && <p className="mb-2 text-[19px] font-semibold leading-relaxed">{e.gloss}</p>}
            {e?.trap && <p className="mb-2.5 rounded-lg border border-[#e7d09b] bg-[#fff5dd] px-3 py-2 text-sm text-[#775012]">⚠ {e.trap}</p>}
            <p className={cn('whitespace-pre-wrap text-[17px] [overflow-wrap:anywhere]', e?.gloss && 'text-[15px] text-muted-foreground')}>{r.meaning_zh || 'No Chinese definition in the source.'}</p>
            {r.context && <p className="mt-3 whitespace-pre-wrap text-[15px] text-muted-foreground">{r.context}</p>}
            <label className="mt-3 block">
              <span className="text-xs text-muted-foreground">我的理解 · My note</span>
              <textarea value={notes[r.id] ?? ''} onChange={ev => setNote(r.id, ev.target.value)} rows={notes[r.id]?.includes('\n') ? 3 : 1} placeholder="自己的记法、辨析、例句…" className="mt-1 block w-full resize-y rounded-md border border-[#e7d09b] bg-[#fffdf5] px-3 py-1.5 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <details open={englishOpen} onToggle={ev => setEnglishOpen((ev.target as HTMLDetailsElement).open)} className="mt-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">English definitions / examples / replacements</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.details || 'No additional details in the source.'}</p>
            </details>
            {rows.length > 0 && (
              <div className="mt-3.5 flex flex-col gap-1.5 border-t pt-3">
                {rows.map(row => (
                  <div key={row.kind + row.label} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {row.rootKey ? <button type="button" onClick={() => navigate(`/${slug}/root/${encodeURIComponent(row.rootKey!)}`)} className="w-full text-left text-xs text-primary hover:underline sm:w-auto sm:min-w-[96px]">{row.label} →</button> : <span className="w-full sm:w-auto sm:min-w-[96px] text-xs text-muted-foreground">{row.label}</span>}
                    {row.words.map(w => { const t = entryByWord(w); const s: Status = t ? statusOf(ratings, t.id) : 'unreviewed'; return (
                      <WordHoverCard key={w} entry={t!} status={s} slug={slug} zh={enrichment.words[w]?.gloss} onOpen={go}>
                        <button type="button" onClick={() => go(w)} className={cn('rounded-full border px-2.5 py-0.5 text-[13px] leading-snug hover:brightness-95', STATE_CLASS[s])}>{w}</button>
                      </WordHoverCard>
                    ); })}
                    {row.extra && <span className="text-xs text-muted-foreground">{row.extra}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center sm:justify-between">
        <Button variant="outline" size="sm" disabled={index === 0} onClick={() => moveBy(-1)}><ArrowLeft className="mr-1 h-3.5 w-3.5" />Previous</Button>
        <Button variant="outline" size="sm" disabled={index >= queue.length - 1} onClick={() => moveBy(1)} className="sm:order-last">Skip<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
        <div className="col-span-2 flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={!canUndo} onClick={undo}><Undo2 className="mr-1 h-3.5 w-3.5" />Undo</Button>
          <Button variant="outline" size="sm" disabled={status === 'unreviewed'} onClick={() => rate('unreviewed')}>Unmark</Button>
        </div>
      </div>
      {keyHints && <p className="mt-3 hidden text-center text-[13px] text-muted-foreground sm:block">
        <kbd className="rounded border bg-white px-1 text-xs">1</kbd> know · <kbd className="rounded border bg-white px-1 text-xs">2</kbd> don’t know · <kbd className="rounded border bg-white px-1 text-xs">3</kbd> unsure · <kbd className="rounded border bg-white px-1 text-xs">S</kbd> / <kbd className="rounded border bg-white px-1 text-xs">Space</kbd> meaning · <kbd className="rounded border bg-white px-1 text-xs">←</kbd> <kbd className="rounded border bg-white px-1 text-xs">→</kbd> browse · <kbd className="rounded border bg-white px-1 text-xs">Z</kbd> undo
      </p>}
    </section>
  );
}
