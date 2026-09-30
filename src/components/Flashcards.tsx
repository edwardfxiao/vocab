import { useEffect, useMemo, useState } from 'react';
import { useKeenSlider } from 'keen-slider/react';
import 'keen-slider/keen-slider.min.css';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { WordHoverCard } from '@/components/WordHoverCard.tsx';
import type { StoryGlossaryEntry } from '@/lib/stories.ts';
import { withBase } from '@/lib/base.ts';
import { entryByWord, statusOf, useAppState } from '@/state/store.ts';
import { cn } from '@/lib/utils.ts';

function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** One slide: the word (click for its hover card) and, when the eye is open, its meaning. */
function Card({ g, slug, showZh }: { g: StoryGlossaryEntry; slug: string; showZh: boolean }) {
  const ratings = useAppState(s => s.ratings);
  const [open, setOpen] = useState(false);
  const entry = entryByWord(g.word);
  const cls = 'rounded px-2 font-serif text-5xl font-medium tracking-tight hover:bg-accent/60 sm:text-6xl';
  return (
    <div className="keen-slider__slide flex h-full flex-col items-center justify-center gap-4 px-4 py-6 text-center">
      {entry ? (
        <WordHoverCard entry={entry} status={statusOf(ratings, entry.id)} slug={slug} zh={g.zh} onOpen={w => window.open(withBase(`${slug}/w/${encodeURIComponent(w)}`), '_blank', 'noopener')} open={open} onOpenChange={setOpen}>
          <button type="button" onClick={() => setOpen(o => !o)} className={cls}>{g.word}</button>
        </WordHoverCard>
      ) : <p className={cls}>{g.word}</p>}
      <p className={cn('min-h-[2rem] max-w-[560px] text-xl transition-opacity', showZh ? 'opacity-100' : 'opacity-0')} aria-hidden={!showZh}>{g.zh}</p>
    </div>
  );
}

/** 单词卡: a keen-slider deck of the story's words. Swipe / drag or use the arrows; the eye shows or hides every meaning.
 *  No global keyboard shortcuts (the quiz above owns ← → Enter). */
export function Flashcards({ glossary, slug }: { glossary: StoryGlossaryEntry[]; slug: string }) {
  const [shuffled, setShuffled] = useState(true);
  const [seed, setSeed] = useState(0);
  const cards = useMemo(() => (shuffled ? shuffle(glossary) : glossary), [glossary, shuffled, seed]);   // `seed` reshuffles
  const [i, setI] = useState(0);
  const [showZh, setShowZh] = useState(false);
  const [ref, slider] = useKeenSlider<HTMLDivElement>({ loop: true, slides: { perView: 1 }, drag: true, slideChanged: s => setI(s.track.details.rel) });   // loop: the last card leads back to the first
  useEffect(() => { setI(0); slider.current?.update(undefined, 0); }, [cards, slider]);   // new order → back to the first card
  if (!cards.length) return null;
  return (
    <section aria-label="Flashcards" className="mt-8 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">单词卡 · Flashcards <span className="text-sm font-normal text-muted-foreground">{i + 1} / {cards.length}</span></h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={shuffled ? 'default' : 'outline'} onClick={() => { if (shuffled) setSeed(s => s + 1); else setShuffled(true); }} title="Shuffle (again)"><Shuffle className="mr-1 h-3.5 w-3.5" />乱序</Button>
          <Button size="sm" variant={shuffled ? 'outline' : 'default'} onClick={() => setShuffled(false)} title="Story order">按顺序</Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">左右滑动或拖动翻卡，也可用箭头，到底后回到第一张；点单词看卡片；眼睛按钮显示或隐藏释义。</p>
      <div className="mt-4 flex items-stretch gap-2">
        <Button variant="outline" size="icon" className="h-auto w-10 shrink-0 max-sm:hidden" onClick={() => slider.current?.prev()} aria-label="Previous card"><ArrowLeft className="h-4 w-4" /></Button>
        <div key={`deck-${seed}-${shuffled ? 's' : 'o'}-${cards.length}`} ref={ref} className="keen-slider h-[340px] flex-1 cursor-grab rounded-xl border bg-white active:cursor-grabbing sm:h-[400px]">
          {cards.map(g => <Card key={g.word} g={g} slug={slug} showZh={showZh} />)}
        </div>
        <Button variant="outline" size="icon" className="h-auto w-10 shrink-0 max-sm:hidden" onClick={() => slider.current?.next()} aria-label="Next card"><ArrowRight className="h-4 w-4" /></Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => slider.current?.prev()} className="sm:invisible"><ArrowLeft className="mr-1 h-3.5 w-3.5" />上一张</Button>
        <button type="button" onClick={() => setShowZh(v => !v)} aria-pressed={showZh} title={showZh ? 'Hide the meanings' : 'Show the meanings'}
          className={cn('grid h-11 w-11 place-items-center rounded-full border transition-colors', showZh ? 'border-primary bg-accent text-primary' : 'text-muted-foreground hover:border-primary hover:text-primary')}>
          {showZh ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
        <Button variant="outline" size="sm" onClick={() => slider.current?.next()} className="sm:invisible">下一张<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
      </div>
    </section>
  );
}
