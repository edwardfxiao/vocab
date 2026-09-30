import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils.ts';
import type { StatusFilter } from '@/lib/ratings.ts';
import { countStatuses, setView, useAppState } from '@/state/store.ts';

const CARDS: { filter: StatusFilter; label: string; color: string }[] = [
  { filter: 'unreviewed', label: 'Unreviewed · 未判断', color: 'text-primary' },
  { filter: 'reviewed', label: 'Reviewed · 已判断', color: 'text-foreground' },
  { filter: 'definitely_know', label: 'Definitely know · 认识', color: 'text-know' },
  { filter: 'not_sure', label: 'Not sure · 不确定', color: 'text-unsure' },
  { filter: 'dont_know', label: 'Don’t know · 不认识', color: 'text-dontknow' },
];

/** Sticky status cards; each is a filter button. */
export function StatsBar() {
  const data = useAppState(s => s.data);
  const ratings = useAppState(s => s.ratings);
  const view = useAppState(s => s.view);
  const counts = countStatuses(data, ratings);
  const values: Record<StatusFilter, number> = { ...counts, reviewed: data.length - counts.unreviewed, all: data.length, to_study: counts.not_sure + counts.dont_know };
  const done = data.length - counts.unreviewed;
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} className="-mt-px h-px" aria-hidden />
      <section aria-label="Vocabulary progress" className={cn('sticky top-0 z-10 -mx-2 grid grid-cols-2 gap-1.5 bg-background px-2 py-2 transition-shadow sm:grid-cols-3 sm:gap-2 lg:grid-cols-5', stuck && 'border-b shadow-[0_6px_16px_-8px_rgba(21,34,60,.25)]')}>
        {CARDS.map(c => {
          const active = view.filter === c.filter && !view.invert;
          return (
            <button key={c.filter} type="button" aria-pressed={active} onClick={() => setView({ filter: c.filter })}
              className={cn('flex min-w-0 items-baseline gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-accent sm:gap-2 sm:px-3 sm:py-2', active && 'border-primary bg-accent')}>
              <strong className={cn('text-lg leading-tight tracking-tight sm:text-xl', c.color)}>{values[c.filter].toLocaleString()}</strong>
              <span className="truncate text-[13px]">{c.label}</span>
            </button>
          );
        })}
      </section>
      <div className="mt-3 flex justify-between text-sm text-muted-foreground"><span>{done.toLocaleString()} of {data.length.toLocaleString()} reviewed</span><span>{(data.length ? 100 * done / data.length : 0).toFixed(1)}%</span></div>
      <progress className="mt-2 block h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-[#dce2ed] [&::-webkit-progress-value]:bg-primary" max={data.length || 1} value={done} aria-label="Words reviewed" />
    </>
  );
}
