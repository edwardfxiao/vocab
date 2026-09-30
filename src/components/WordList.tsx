import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { LIST_MARKS } from '@/lib/ratings.ts';
import type { WordEntry } from '@/lib/words.ts';
import { setCurrent, statusOf, useAppState } from '@/state/store.ts';
import { cn } from '@/lib/utils.ts';

const PAGE = 20;   // items per list page; the list stretches to the card's height and scrolls inside

/** Sidebar list, 40 words per page; the page follows the current word. */
export function WordList({ queue }: { queue: WordEntry[] }) {
  const ratings = useAppState(s => s.ratings);
  const current = useAppState(s => s.view.current);
  const loading = useAppState(s => s.loading);
  const pages = Math.max(1, Math.ceil(queue.length / PAGE));
  const currentIndex = queue.findIndex(r => r.id === current);
  const [page, setPage] = useState(0);
  useEffect(() => { if (currentIndex >= 0) setPage(Math.floor(currentIndex / PAGE)); }, [currentIndex, queue]);
  const shown = Math.min(Math.max(0, page), pages - 1);
  return (
    // The wrapper takes the row height from the card (the aside is absolutely positioned, so its own content never makes the row taller).
    <div className="relative min-h-[440px] max-[850px]:hidden">
    <aside aria-label="Filtered word list" className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3 text-sm"><strong>In this view</strong><span>{queue.length.toLocaleString()}</span></div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {queue.slice(shown * PAGE, (shown + 1) * PAGE).map(r => (
          <button key={r.id} type="button" disabled={loading} aria-current={r.id === current ? 'true' : undefined} onClick={() => setCurrent(r.id)}
            className={cn('flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent/60', r.id === current && 'bg-accent text-primary')}>
            <b className="font-medium [overflow-wrap:anywhere]">{r.word}</b>
            <span className="shrink-0 text-xs text-muted-foreground">{LIST_MARKS[statusOf(ratings, r.id)]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between border-t p-2">
        <Button variant="outline" size="icon" aria-label="Previous list page" disabled={shown === 0} onClick={() => setPage(shown - 1)}><ArrowLeft className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground">{shown + 1} / {pages}</span>
        <Button variant="outline" size="icon" aria-label="Next list page" disabled={shown >= pages - 1} onClick={() => setPage(shown + 1)}><ArrowRight className="h-4 w-4" /></Button>
      </div>
    </aside>
    </div>
  );
}
