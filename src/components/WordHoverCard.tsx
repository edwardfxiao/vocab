import type { ReactNode } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card.tsx';
import { WordActions } from '@/components/WordActions.tsx';
import type { Status } from '@/lib/ratings.ts';
import { LABELS } from '@/lib/ratings.ts';
import { withBase } from '@/lib/base.ts';
import { cn } from '@/lib/utils.ts';
import type { WordEntry } from '@/lib/words.ts';
import { syllablesOf, useAppState } from '@/state/store.ts';

const BADGE_CLASS: Record<Status, string> = { unreviewed: 'bg-[#f0f3f9] text-[#495771]', definitely_know: 'bg-[#e6f5ec] text-know', not_sure: 'bg-[#fff3d8] text-unsure', dont_know: 'bg-[#ffebee] text-dontknow' };

/** Hover (or controlled) card for a word: syllables, phonetic, rating badge, gloss, copy / Google / Images, and “Open card”.
 *  The word itself opens the card in a new tab; `onOpen` navigates in-app. Used by story words, relation chips and root-page items. */
export function WordHoverCard({ entry, status, slug, zh, onOpen, open, onOpenChange, side = 'top', children }: {
  entry: WordEntry; status: Status; slug: string; zh?: string; onOpen: (word: string) => void;
  open?: boolean; onOpenChange?: (open: boolean) => void; side?: 'top' | 'bottom'; children: ReactNode;
}) {
  const syllables = useAppState(() => syllablesOf(entry.word));
  const note = useAppState(s => s.notes[entry.id]);
  return (
    <HoverCard open={open} onOpenChange={onOpenChange} openDelay={150} closeDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} align="start" className="w-80 max-w-[calc(100vw-1.5rem)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a href={withBase(`${slug}/w/${encodeURIComponent(entry.word)}`)} target="_blank" rel="noopener" className="text-[22px] font-semibold leading-tight tracking-tight text-primary hover:underline" title="Open in a new tab">{entry.word}</a>
            <div className="text-sm text-muted-foreground">{syllables?.includes('·') && <span className="mr-2 text-foreground/70">{syllables}</span>}{entry.phonetic ? `/${entry.phonetic}/` : ''}</div>
          </div>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs', BADGE_CLASS[status])}>{LABELS[status]}</span>
        </div>
        <p className="mt-2 text-[15px] leading-snug text-foreground">{zh || entry.meaning_zh.split('\n')[0]}</p>
        {note && <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-[#e7d09b] bg-[#fffdf5] px-2 py-1 text-[13px] leading-snug text-[#775012]">我的理解：{note}</p>}
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <WordActions word={entry.word} size={15} />
          <button type="button" onClick={() => onOpen(entry.word)} className="text-primary hover:underline">Open card →</button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
