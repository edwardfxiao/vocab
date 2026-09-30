import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Filters } from '@/components/Filters.tsx';
import { ExtrasPanel } from '@/components/ExtrasPanel.tsx';
import { FullListConnected } from '@/components/FullList.tsx';
import { StatsBar } from '@/components/StatsBar.tsx';
import { TransferPanel } from '@/components/TransferPanel.tsx';
import { WordCard } from '@/components/WordCard.tsx';
import { WordList } from '@/components/WordList.tsx';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { withBase } from '@/lib/base.ts';
import { datasetSlug } from '@/lib/datasets.ts';
import { buildQueue, datasetDescription, entryByWord, getState, jumpToWord, setTrail, trailFromState, useAppState } from '@/state/store.ts';

export function DatasetPage() {
  useShortcuts();
  const { word } = useParams();
  const navigate = useNavigate();
  const config = useAppState(s => s.config);
  const data = useAppState(s => s.data);
  const ratings = useAppState(s => s.ratings);
  const view = useAppState(s => s.view);
  const loading = useAppState(s => s.loading);
  const loadError = useAppState(s => s.loadError);
  useAppState(s => s.listIds);   // re-render when the practice-list page pins or releases the queue
  const queue = buildQueue(data, ratings, view);
  const current = data.find(r => r.id === view.current);
  const slug = config ? datasetSlug(config.id) : '';

  // URL ⇄ state. `applied` is the last word the two sides agreed on: a changed URL segment (deep link, chip click,
  // browser back/forward) is applied to the state; a changed current word (rating, list click, arrows) replaces the URL.
  const applied = useRef<string | undefined>(undefined);
  const location = useLocation();
  useEffect(() => {
    if (loading) return;
    setTrail(trailFromState(location.state));   // back/forward restore the trail stored with that history entry
    if (!word || word === applied.current) return;
    const target = entryByWord(word);
    if (!target) return;
    applied.current = word;
    jumpToWord(target.id);                       // selects the word, opens its meaning and scrolls the card into view
  }, [word, loading, location.key, location.state]);
  useEffect(() => {
    if (loading || !slug) return;
    const now = getState().view.current;
    const entry = now ? data.find(r => r.id === now) : undefined;
    if (!entry || entry.word === applied.current) return;
    applied.current = entry.word;
    if (word !== entry.word) navigate(`/${slug}/w/${encodeURIComponent(entry.word)}`, { replace: true, state: { trail: getState().trail } });
  }, [current?.word, loading, slug, data, word, navigate]);

  return (
    <>
      <StatsBar />
      <TransferPanel queue={queue} />
      <Filters />
      <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-5 max-[850px]:grid-cols-1">
        <WordList queue={queue} />
        {loadError ? (
          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border bg-white px-4 py-14 text-center">
            <h2 className="text-2xl font-semibold">Could not load this collection.</h2>
            <p className="mt-2 text-muted-foreground">{loadError} Start the dev server from the app folder with “npm run dev”.</p>
          </section>
        ) : <WordCard queue={queue} />}
      </div>
      <ExtrasPanel />
      <FullListConnected slug={slug} />
      {config && (
        <details className="my-5 text-sm text-muted-foreground">
          <summary className="cursor-pointer text-foreground">How to use this collection · 词表来源与使用说明</summary>
          <p className="my-3 max-w-[900px]">Mark each word, then export <strong>To study</strong> to combine “Not sure” and “Don’t know”. Send that CSV to your assistant and ask for articles using 15–25 target words at a time, with highlighted vocabulary and comprehension questions.</p>
          <p className="my-3 max-w-[900px]">Your ratings, notes (我的理解) and extra words are saved in this browser only. They do not sync between devices. Progress is separate for each collection and browser address. Use <strong>Back up all progress</strong> before moving the file or clearing browser data. <strong>Restore from backup CSV</strong> only updates the words listed in that CSV and shows a preview before anything changes.</p>
          {datasetDescription(config) && <p className="my-3 max-w-[900px]">{datasetDescription(config)}</p>}
          {config.notes && <p><a className="text-primary underline" href={withBase(config.notes)} target="_blank" rel="noopener">Source, selection method and usage terms</a></p>}
        </details>
      )}
    </>
  );
}
