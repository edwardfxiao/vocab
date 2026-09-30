import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { StoryQuiz } from '@/components/StoryQuiz.tsx';
import { WordHoverCard } from '@/components/WordHoverCard.tsx';
import { datasetSlug } from '@/lib/datasets.ts';
import { LABELS, type Status } from '@/lib/ratings.ts';
import { fetchStory, fetchStoryIndex, segments, storyLabel, storyPath, targetFor, type Story, type StorySummary } from '@/lib/stories.ts';
import type { WordEntry } from '@/lib/words.ts';
import { entryByWord, getState, hasStories, jumpToWord, setTrail, statusOf, useAppState, type TrailEntry } from '@/state/store.ts';
import type { ExtraWord } from '@/lib/notes.ts';
import { exportWords } from '@/state/export.ts';
import { cn } from '@/lib/utils.ts';

const WORD_CLASS: Record<Status, string> = {
  unreviewed: 'bg-accent text-primary', definitely_know: 'bg-know-soft text-know',
  not_sure: 'bg-unsure-soft text-unsure', dont_know: 'bg-dontknow-soft text-dontknow',
};

const scrollKey = (ds: string, n: number, variant: string): string => `word-by-word.story-scroll.${ds}.${n}${variant}`;
const GLOSS_KEY = 'word-by-word.story-gloss.v1';
const HIGHLIGHT_KEY = 'word-by-word.story-highlight.v1';
const readHighlight = (): boolean => { try { return localStorage.getItem(HIGHLIGHT_KEY) !== 'off'; } catch { return true; } };
const readShowGloss = (): boolean => { try { return localStorage.getItem(GLOSS_KEY) !== 'hidden'; } catch { return true; } };

/** A bold target word, coloured by your rating; hover (or tap) opens the word card popover. */
function WordToken({ token, target, entry, zh, status, slug, onOpen }: { token: string; target: string | undefined; entry: WordEntry | undefined; zh: string; status: Status; slug: string; onOpen: (word: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!target || !entry) return <span className="font-semibold">{token}</span>;
  return (
    <WordHoverCard entry={entry} status={status} slug={slug} zh={zh} onOpen={() => onOpen(target)} open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(o => !o)} className={cn('rounded px-0.5 font-semibold hover:brightness-95', WORD_CLASS[status])}>{token}</button>
    </WordHoverCard>
  );
}

/** Other words worth noticing inside plain text: my extra words (abbot…) and, when enabled, every word I currently rate
 *  Not sure / Don’t know that is not one of this story's targets (pier in a story about other words). */
const OTHERS_KEY = 'word-by-word.story-others.v1';
const readShowOthers = (): boolean => { try { return localStorage.getItem(OTHERS_KEY) !== 'off'; } catch { return true; } };
const OTHER_CLASS: Record<Status, string> = { unreviewed: 'decoration-primary', definitely_know: 'decoration-know', not_sure: 'decoration-unsure', dont_know: 'decoration-dontknow' };

/** Candidate base forms of an inflected token, most specific first. */
function lemmas(token: string): string[] {
  const t = token.toLowerCase(); const out = [t];
  for (const [suffix, repl] of [['ies', 'y'], ['ied', 'y'], ['ing', ''], ['ing', 'e'], ['ed', ''], ['ed', 'e'], ['es', ''], ['s', ''], ['er', ''], ['est', ''], ['ly', '']] as const) {
    if (t.endsWith(suffix) && t.length - suffix.length >= 3) { const stem = t.slice(0, -suffix.length) + repl; out.push(stem); if (stem.length > 3 && stem[stem.length - 1] === stem[stem.length - 2]) out.push(stem.slice(0, -1)); }
  }
  return out;
}

function OtherWord({ token, entry, status, zh, slug, onOpen }: { token: string; entry: WordEntry; status: Status; zh: string; slug: string; onOpen: (word: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <WordHoverCard entry={entry} status={status} slug={slug} zh={zh} onOpen={() => onOpen(entry.word)} open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(o => !o)} className={cn('rounded-sm underline decoration-dotted underline-offset-4 hover:bg-accent/60', OTHER_CLASS[status])} title={`${entry.word} · ${LABELS[status]}`}>{token}</button>
    </WordHoverCard>
  );
}

function PlainText({ text, extras, others, targets, slug, statusFor, zhFor, onOpen }: { text: string; extras: ExtraWord[]; others: Map<string, WordEntry> | null; targets: Set<string>; slug: string; statusFor: (w: string) => Status; zhFor: (w: string) => string; onOpen: (word: string) => void }) {
  if (!extras.length && !others) return <span>{text}</span>;
  const extraByWord = new Map(extras.map(x => [x.word.toLowerCase(), x]));
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    const token = m[0]; const forms = lemmas(token);
    const extra = forms.map(f => extraByWord.get(f)).find(Boolean);
    const other = !extra && others ? forms.map(f => (targets.has(f) ? undefined : others.get(f))).find(Boolean) : undefined;
    if (!extra && !other) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (extra) parts.push(<span key={m.index} className="cursor-help underline decoration-primary decoration-dotted underline-offset-4" title={`${extra.word}：${extra.zh || '(no gloss yet)'}`}>{token}</span>);
    else if (other) parts.push(<OtherWord key={m.index} token={token} entry={other} status={statusFor(other.word)} zh={zhFor(other.word.toLowerCase())} slug={slug} onOpen={onOpen} />);
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** /:ds/stories/:n — the story text with every target word bold, coloured by your rating; hover for the meaning, click through for the card. */
export function StoryPage() {
  const { n = '', variant: variantParam = '' } = useParams();
  const variant = /^[b-z]$/.test(variantParam) ? variantParam : '';
  const navigate = useNavigate();
  const location = useLocation();
  const [story, setStory] = useState<Story | null | undefined>(undefined);
  const [siblings, setSiblings] = useState<StorySummary[]>([]);   // every story on this word group (A, B, …)
  const config = useAppState(s => s.config);
  const ratings = useAppState(s => s.ratings);
  const enrichment = useAppState(s => s.enrichment);
  const trail = useAppState(s => s.trail);
  const extras = useAppState(s => s.extras);
  const [showGloss, setShowGloss] = useState(readShowGloss);
  const [highlight, setHighlight] = useState(readHighlight);   // off = plain text: no bold, colours, underlines or hover cards
  const [showOthers, setShowOthers] = useState(readShowOthers);   // underline my other Not sure / Don’t know words in the text
  const toggleOthers = (): void => { setShowOthers(v => { try { localStorage.setItem(OTHERS_KEY, v ? 'off' : 'on'); } catch { /* storage unavailable */ } return !v; }); };
  const data = useAppState(s => s.data);
  const others = useMemo(() => { if (!showOthers) return null; const m = new Map<string, WordEntry>(); for (const e of data) { const st = statusOf(ratings, e.id); if (st === 'not_sure' || st === 'dont_know') m.set(e.word.toLowerCase(), e); } return m; }, [data, ratings, showOthers]);
  const toggleHighlight = (): void => { setHighlight(v => { try { localStorage.setItem(HIGHLIGHT_KEY, v ? 'off' : 'on'); } catch { /* storage unavailable */ } return !v; }); };
  const toggleGloss = (): void => { setShowGloss(v => { try { localStorage.setItem(GLOSS_KEY, v ? 'hidden' : 'shown'); } catch { /* storage unavailable */ } return !v; }); };
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());   // glossary words ticked for export (per visit)
  const toggleChecked = (w: string): void => setChecked(c => { const next = new Set(c); if (next.has(w)) next.delete(w); else next.add(w); return next; });
  const exportChecked = (): void => exportWords([...checked].map(entryByWord).filter((e): e is NonNullable<typeof e> => !!e), `story-${number}-selected`);
  const number = Number(n);
  const dir = config?.stories;
  const available = useAppState(hasStories);
  const imported = useAppState(s => s.storiesImported);
  useEffect(() => { setStory(undefined); setChecked(new Set()); if (config && available) void fetchStory(config.id, dir, number, variant).then(setStory); else if (config) setStory(null); }, [dir, config, available, imported, number, variant]);
  useEffect(() => { setSiblings([]); if (config && available) void fetchStoryIndex(config.id, dir).then(i => setSiblings(i.stories.filter(s => s.n === number))); }, [config, dir, available, imported, number]);
  // Restore the reading position when coming back (in-app Back passes scrollY; browser back finds it in sessionStorage).
  useEffect(() => {
    if (!story) return;
    const st = location.state as { scrollY?: unknown } | null;
    let y = typeof st?.scrollY === 'number' ? st.scrollY : NaN;
    if (Number.isNaN(y)) { try { y = Number(sessionStorage.getItem(scrollKey(config?.id ?? '', story.n, story.variant ?? '')) ?? NaN); } catch { /* storage unavailable */ } }
    if (!Number.isNaN(y)) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [story, location.state, config?.id]);
  const slug = config ? datasetSlug(config.id) : '';
  const statusFor = (w: string): Status => { const e = entryByWord(w); return e ? statusOf(ratings, e.id) : 'unreviewed'; };
  const open = (word: string): void => {
    const t = entryByWord(word);
    if (!t || !story) return;
    try { sessionStorage.setItem(scrollKey(config?.id ?? '', story.n, story.variant ?? ''), String(window.scrollY)); } catch { /* storage unavailable */ }
    const nextTrail: TrailEntry[] = [...getState().trail, { kind: 'story', n: story.n, ...(story.variant ? { variant: story.variant } : {}), scrollY: window.scrollY }];
    setTrail(nextTrail);
    jumpToWord(t.id);
    navigate(`/${slug}/w/${encodeURIComponent(t.word)}`, { state: { trail: nextTrail } });
  };
  if (story === undefined) return <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6 text-muted-foreground">Loading story…</section>;
  if (!story) return <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6"><p className="text-muted-foreground">{available ? `Story ${n}${variant ? ' ' + variant.toUpperCase() : ''} does not exist in this collection.` : 'This collection has no stories yet.'}</p><Link to={`/${slug}/stories`} className="text-primary hover:underline">All stories</Link></section>;
  const zhFor = (w: string): string => story.glossary.find(g => g.word.toLowerCase() === w)?.zh ?? enrichment.words[w]?.gloss ?? '';
  const targetSet = new Set(story.words.map(w => w.toLowerCase()));
  const trailBack = trail.at(-1);
  return (
    <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm sm:mb-5 sm:gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/${slug}/stories`} className="text-primary hover:underline"><ArrowLeft className="mr-1 inline h-3.5 w-3.5" />All stories</Link>
          {trailBack?.kind === 'word' && <button type="button" onClick={() => { const rest = trail.slice(0, -1); const w = entryByWord(getState().data.find(x => x.id === trailBack.id)?.word ?? ''); if (!w) return; setTrail(rest); jumpToWord(w.id); navigate(`/${slug}/w/${encodeURIComponent(w.word)}`, { state: { trail: rest } }); }} className="text-primary hover:underline"><ArrowLeft className="mr-1 inline h-3.5 w-3.5" />Back to {getState().data.find(x => x.id === trailBack.id)?.word}</button>}
        </div>
        <span className="flex flex-wrap items-center gap-3 text-muted-foreground">{storyLabel(story)} · {story.words.length} target words{highlight ? ' · hover a bold word for its meaning' : ' · plain text'}<Button variant="outline" size="sm" onClick={toggleHighlight} aria-pressed={!highlight} title="Show the story as plain text, without bold target words">{highlight ? '隐藏标注 · Plain text' : '显示标注 · Highlight words'}</Button>{highlight && <Button variant="outline" size="sm" onClick={toggleOthers} aria-pressed={showOthers} title="Dotted underline under every other word you rate Not sure / Don’t know">{showOthers ? '其他生词：开' : '其他生词：关'}</Button>}</span>
      </div>
      {siblings.length > 1 && (
        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">Same words, {siblings.length} stories · 同一组词的故事：
          {siblings.map(s => { const v = s.variant ?? ''; const here = v === (story.variant ?? ''); return here
            ? <span key={v} className="rounded-md bg-primary px-2 py-0.5 font-semibold text-white">{v ? v.toUpperCase() : 'A'}</span>
            : <Link key={v} to={storyPath(slug, story.n, v)} className="rounded-md border px-2 py-0.5 font-semibold text-primary hover:bg-accent/60" title={s.title}>{v ? v.toUpperCase() : 'A'}</Link>; })}
        </p>
      )}
      <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{story.title}</h2>
      <p className="mt-1 text-muted-foreground">{story.summary_zh}</p>
      <article className="mx-auto mt-5 max-w-[760px] text-[17px] leading-[1.75] sm:mt-6 sm:text-[18px] sm:leading-[1.8]">
        {story.paragraphs.map((p, i) => (
          <p key={i} className="mb-5">
            {segments(p).map((seg, j) => {
              if (!highlight) return <span key={j}>{seg.text}</span>;
              if (seg.kind === 'text') return <PlainText key={j} text={seg.text} extras={extras} others={others} targets={targetSet} slug={slug} statusFor={statusFor} zhFor={zhFor} onOpen={open} />;
              const target = targetFor(seg.text, story.words);
              return <WordToken key={j} token={seg.text} target={target} entry={target ? entryByWord(target) : undefined} zh={target ? zhFor(target) : ''} status={target ? statusFor(target) : 'unreviewed'} slug={slug} onOpen={open} />;
            })}
          </p>
        ))}
      </article>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <h3 className="text-lg font-semibold">词表 · Glossary <span className="text-sm font-normal text-muted-foreground">{story.glossary.length} words</span></h3>
        <div className="flex flex-wrap items-center gap-2">
          {checked.size > 0 && <><Button size="sm" onClick={exportChecked} title="CSV in the same format as the study-list exports"><Download className="mr-1 h-3.5 w-3.5" />导出已勾选 · Export {checked.size}</Button><Button variant="outline" size="sm" onClick={() => setChecked(new Set())}>Clear</Button></>}
          <Button variant="outline" size="sm" onClick={() => setChecked(new Set(story.glossary.map(g => g.word.toLowerCase())))} disabled={checked.size === story.glossary.length}>Select all</Button>
          <Button variant="outline" size="sm" onClick={toggleGloss} aria-pressed={!showGloss}>{showGloss ? '隐藏释义 · Hide meanings' : '显示释义 · Show meanings'}</Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Tick the words that will not stick and export them as a CSV. 勾选记不住的词，导出成 CSV。</p>
      <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-x-6 gap-y-1.5 text-[15px]">
        {story.glossary.map(g => { const w = g.word.toLowerCase(); return (
          <li key={g.word} className="flex items-baseline gap-2"><input type="checkbox" checked={checked.has(w)} onChange={() => toggleChecked(w)} aria-label={`Select ${g.word}`} className="relative top-0.5 shrink-0 accent-primary" /><WordToken token={g.word} target={w} entry={entryByWord(w)} zh={g.zh} status={statusFor(w)} slug={slug} onOpen={open} />{showGloss && <span className="text-muted-foreground">{g.zh}</span>}</li>
        ); })}
      </ol>
      <StoryQuiz key={`${story.n}${story.variant ?? ''}`} glossary={story.glossary} slug={slug} exportLabel={`story-${story.n}${story.variant ?? ''}-missed`} practiceHref={`/${slug}/practice?s=${story.n}`} />
      <div className="mt-6 flex justify-between">
        <Button variant="outline" disabled={story.n <= 1} onClick={() => navigate(`/${slug}/stories/${story.n - 1}`)}><ArrowLeft className="mr-1 h-3.5 w-3.5" />Story {story.n - 1}</Button>
        <Button variant="outline" onClick={() => navigate(`/${slug}/stories/${story.n + 1}`)}>Story {story.n + 1}<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
      </div>
    </section>
  );
}
