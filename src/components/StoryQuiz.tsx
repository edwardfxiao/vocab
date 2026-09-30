import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { WordHoverCard } from '@/components/WordHoverCard.tsx';
import { entryByWord, statusOf, useAppState } from '@/state/store.ts';
import { exportWords } from '@/state/export.ts';
import type { StoryGlossaryEntry } from '@/lib/stories.ts';
import { withBase } from '@/lib/base.ts';
import { cn } from '@/lib/utils.ts';

type Order = 'sequential' | 'shuffled';
/** en2zh: see the word, pick the meaning · zh2en: see the meaning, pick the word · spell: see the meaning, type the word. */
type Mode = 'en2zh' | 'zh2en' | 'spell';
const MODES: { mode: Mode; label: string; title: string }[] = [{ mode: 'en2zh', label: '看英选中', title: 'See the word, choose the meaning' }, { mode: 'zh2en', label: '看中选英', title: 'See the meaning, choose the word' }, { mode: 'spell', label: '看中拼写', title: 'See the meaning, type the word' }];
const MODE_KEY = 'word-by-word.quiz-mode.v1';
/** options are glosses (en2zh) or words (zh2en); a spell question has no options and answer 0 = typed correctly. */
interface Question { word: string; zh: string; options: string[]; answer: number }
const LETTERS = ['A', 'B', 'C', 'D'];
const UNKNOWN_KEY = 'word-by-word.quiz-unknown.v1';
const DONT_KNOW = -1;   // stored answer for “I don't know”: shows the answer, counts separately, never auto-advances

function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** One question per glossary entry (or per word in `only`); distractors are other words of the same story. */
function buildQuestions(glossary: StoryGlossaryEntry[], order: Order, only: ReadonlySet<string> | null, mode: Mode): Question[] {
  const pool = glossary.filter(g => g.zh);
  const chosen = only ? pool.filter(g => only.has(g.word)) : pool;
  const items = order === 'shuffled' ? shuffle(chosen) : chosen;
  return items.map(g => {
    if (mode === 'spell') return { word: g.word, zh: g.zh, options: [], answer: 0 };
    const key = mode === 'en2zh' ? 'zh' : 'word';
    const others = shuffle(pool.filter(o => o.word !== g.word && o.zh !== g.zh)).slice(0, 3).map(o => o[key]);
    const options = shuffle([g[key], ...others]);
    return { word: g.word, zh: g.zh, options, answer: options.indexOf(g[key]) };
  });
}
const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** 复习练习: pick the meaning of each story word from four choices, in story order or shuffled. Keys A–D / 1–4 answer, Enter or → continues. */
export function StoryQuiz({ glossary, slug, practiceHref, exportLabel = 'missed' }: { glossary: StoryGlossaryEntry[]; slug: string; practiceHref?: string; exportLabel?: string }) {
  const cardHref = (word: string): string => withBase(`${slug}/w/${encodeURIComponent(word)}`);   // opened in a new tab so the quiz keeps its place
  const ratings = useAppState(st => st.ratings);
  const [hover, setHover] = useState(false);

  const [order, setOrder] = useState<Order>('shuffled');   // shuffled by default
  const [mode, setMode] = useState<Mode>(() => { try { const m = localStorage.getItem(MODE_KEY); return MODES.some(x => x.mode === m) ? m as Mode : 'en2zh'; } catch { return 'en2zh'; } });
  const [typed, setTyped] = useState<string[]>([]);   // spell mode: what was typed per question
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [run, setRun] = useState(0);
  const [only, setOnly] = useState<ReadonlySet<string> | null>(null);   // retry round: just the words missed last time
  const [onlyUnknown, setOnlyUnknown] = useState<boolean>(() => { try { return localStorage.getItem(UNKNOWN_KEY) !== 'off'; } catch { return true; } });   // skip words already rated Definitely know
  const pool = useMemo(() => (onlyUnknown ? glossary.filter(g => { const e = entryByWord(g.word); return (e ? statusOf(ratings, e.id) : 'unreviewed') !== 'definitely_know'; }) : glossary), [glossary, onlyUnknown, ratings]);
  const questions = useMemo(() => buildQuestions(glossary, order, only ?? (pool.length < glossary.length ? new Set(pool.map(g => g.word)) : null), mode), [glossary, pool, order, only, run, mode]);   // `run` restarts with fresh shuffles
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);   // chosen option per question; stays when you go back
  const [autoFrom, setAutoFrom] = useState<number | null>(null);    // question just answered: advances by itself after a moment
  const q = questions[index];
  const picked = answers[index] ?? null;
  const done = index >= questions.length;
  const answered = questions.map((x, i) => ({ ...x, picked: answers[i] ?? null })).filter(x => x.picked !== null);
  const correct = answered.filter(x => x.picked === x.answer).length;
  const unknown = answered.filter(x => x.picked === DONT_KNOW).length;
  const missed = answered.filter(x => x.picked !== x.answer);

  const restart = (next: Order = order, subset: ReadonlySet<string> | null = null): void => { setOrder(next); setOnly(subset); setRun(r => r + 1); setIndex(0); setAnswers([]); setTyped([]); setDraft(''); setAutoFrom(null); setHover(false); };
  const switchMode = (m: Mode): void => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* storage unavailable */ } restart(order, null); };
  const submitSpelling = (): void => {
    if (!q || picked !== null) return;
    const text = draft; if (!normalize(text)) return;
    setTyped(t => { const b = [...t]; b[index] = text; return b; });
    pick(normalize(text) === normalize(q.word) ? 0 : 1);
  };
  const retryMissed = (): void => restart(order, new Set(missed.map(m => m.word)));
  const exportMissed = (): void => exportWords(missed.map(m => entryByWord(m.word)).filter((e): e is NonNullable<typeof e> => !!e), exportLabel);
  const pick = (i: number): void => {
    if (!q || picked !== null) return;
    setAnswers(a => { const b = [...a]; b[index] = i; return b; });
    setAutoFrom(index);
  };
  const next = (): void => { if (picked === null) return; setAutoFrom(null); setHover(false); setDraft(''); setIndex(i => i + 1); };
  const prev = (): void => { setAutoFrom(null); setHover(false); setDraft(''); setIndex(i => Math.max(0, i - 1)); };
  useEffect(() => { if (mode === 'spell' && picked === null) inputRef.current?.focus(); }, [mode, index, picked]);
  // Auto-advance after answering: a correct pick moves on almost at once (a short green flash), a wrong one waits 2 s so the
  // answer can be read. Going back or forward by hand cancels it, and revisited questions never auto-advance.
  useEffect(() => {
    if (autoFrom === null || autoFrom !== index || !q || picked === null || picked === DONT_KNOW) return;
    const t = window.setTimeout(() => { setAutoFrom(null); setIndex(i => i + 1); }, picked === q.answer ? 0 : 2000);
    return () => window.clearTimeout(t);
  }, [autoFrom, index, picked, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const letter = LETTERS.findIndex(l => l.toLowerCase() === k);
      const digit = '1234'.indexOf(k);
      if (e.key === 'ArrowLeft') { if (index > 0) { e.preventDefault(); prev(); } }
      else if (!done && mode !== 'spell' && picked === null && (letter >= 0 || digit >= 0)) { e.preventDefault(); pick(letter >= 0 ? letter : digit); }
      else if (!done && mode !== 'spell' && picked === null && (k === 'e' || k === '0' || k === '?')) { e.preventDefault(); pick(DONT_KNOW); }
      else if (!done && picked !== null && (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ')) { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleUnknown = (): void => { setOnlyUnknown(v => { try { localStorage.setItem(UNKNOWN_KEY, v ? 'off' : 'on'); } catch { /* storage unavailable */ } return !v; }); restart(order, null); };
  if (!glossary.length) return null;
  return (
    <section aria-label="Review quiz" className="mt-8 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">复习练习 · Quiz <span className="text-sm font-normal text-muted-foreground">{only ? '错题重练 · ' : ''}{Math.min(index + 1, questions.length)} / {questions.length}{answered.length ? ` · 对 ${correct} 错 ${answered.length - correct - unknown}${unknown ? ` 不知道 ${unknown}` : ''}` : ''}</span></h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex overflow-hidden rounded-md border" role="tablist" aria-label="Quiz mode">{MODES.map(m => <button key={m.mode} type="button" role="tab" aria-selected={mode === m.mode} title={m.title} onClick={() => switchMode(m.mode)} className={cn('px-2.5 py-1 text-sm', mode === m.mode ? 'bg-primary text-white' : 'hover:bg-accent/60')}>{m.label}</button>)}</span>
          <span className="text-xs text-muted-foreground">顺序</span>
          <Button size="sm" variant={order === 'sequential' ? 'default' : 'outline'} onClick={() => restart('sequential')} title="In story order">按顺序</Button>
          <Button size="sm" variant={order === 'shuffled' ? 'default' : 'outline'} onClick={() => restart('shuffled')} title="Shuffled">乱序</Button>
          <Button size="sm" variant="outline" onClick={() => restart()} title="Restart with new choices"><RotateCcw className="mr-1 h-3.5 w-3.5" />重来</Button>
          <Button size="sm" variant={onlyUnknown ? 'default' : 'outline'} onClick={toggleUnknown} aria-pressed={onlyUnknown} title="Skip words you already rate Definitely know">只考还不会的{onlyUnknown ? ` · ${pool.length}/${glossary.length}` : ''}</Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{mode === 'en2zh' ? '看单词选释义。' : mode === 'zh2en' ? '看释义选单词。' : '看释义拼出单词，回车提交（不分大小写）。'}答对立即进下一题，答错停 2 秒，“不知道”只显示答案不跳转；{mode === 'spell' ? 'Enter 提交 / 下一题，← 上一题。' : '键盘 A–D 或 1–4 选择，E 不知道，Enter / → 下一题，← 上一题。'}{practiceHref && <> · <Link to={practiceHref} className="text-primary hover:underline">Practice several stories together →</Link></>}</p>

      {!questions.length ? (
        <p className="mt-4 rounded-xl border bg-know-soft px-5 py-4 text-know">全部掌握 · Every word here is rated Definitely know. Switch off “只考还不会的” to practise them anyway.</p>
      ) : done ? (
        <div className="mt-4 rounded-xl border bg-[#f8f9fd] px-5 py-4">
          <p className="text-lg font-semibold">完成 · {questions.length} 题，答对 {correct}，答错 {questions.length - correct - unknown}{unknown ? `，不知道 ${unknown}` : ''}</p>
          {missed.length > 0 && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">答错的词 · Missed words (open the card in a new tab):</p>
              <ul className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-x-6 gap-y-1 text-[15px]">
                {missed.map(r => <li key={r.word} className="flex gap-2"><a href={cardHref(r.word)} target="_blank" rel="noopener" className={cn('font-semibold hover:underline', r.picked === DONT_KNOW ? 'text-unsure' : 'text-dontknow')}>{r.word}</a><span className="text-muted-foreground">{r.zh}</span></li>)}
              </ul>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={prev}><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back to the questions</Button>
            {missed.length > 0 && <Button onClick={retryMissed} className="bg-dontknow text-white hover:bg-dontknow hover:brightness-95">只练答错和不知道的 · Retry {missed.length}</Button>}
            {missed.length > 0 && <Button variant="outline" onClick={exportMissed} className="border-dontknow-line text-dontknow hover:bg-dontknow-soft hover:text-dontknow" title="CSV in the same format as the study-list exports"><Download className="mr-1 h-3.5 w-3.5" />导出答错和不知道的 · Export {missed.length}</Button>}
            <Button variant={missed.length ? 'outline' : 'default'} onClick={() => restart()}>{only ? 'All words again · 全部再来一遍' : 'Again · 再来一遍'}</Button>
          </div>
        </div>
      ) : q && (
        <div className="mt-4 rounded-xl border bg-white px-3 py-3 sm:px-5 sm:py-4">
          {mode !== 'en2zh' && <p className="text-xl font-medium leading-snug sm:text-2xl">{q.zh}</p>}
          {(mode === 'en2zh' || picked !== null) && (() => {   // the word, with the same hover card as in the story (shown after answering in the meaning-first modes)
            const entry = entryByWord(q.word);
            const cls = cn('rounded px-1 font-serif font-medium tracking-tight hover:bg-accent/60', mode === 'en2zh' ? 'text-2xl sm:text-3xl' : 'mt-2 text-xl sm:text-2xl', mode !== 'en2zh' && (picked === q.answer ? 'text-know' : 'text-dontknow'));
            if (!entry) return <p className={cls}>{q.word}</p>;
            return (
              <WordHoverCard entry={entry} status={statusOf(ratings, entry.id)} slug={slug} zh={q.zh} onOpen={w => window.open(cardHref(w), '_blank', 'noopener')} open={hover} onOpenChange={setHover}>
                <button type="button" onClick={() => setHover(h => !h)} className={cls}>{q.word}</button>
              </WordHoverCard>
            );
          })()}
          {mode === 'spell' && (
            <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); submitSpelling(); }}>
              <input ref={inputRef} value={picked === null ? draft : (typed[index] ?? '')} onChange={e => setDraft(e.target.value)} disabled={picked !== null} placeholder="Type the English word · 输入英文" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className={cn('h-11 min-w-0 flex-1 rounded-lg border px-3 font-mono text-lg outline-none focus:border-primary', picked === null ? 'bg-white' : picked === q.answer ? 'border-know-line bg-know-soft text-know' : 'border-dontknow-line bg-dontknow-soft text-dontknow line-through')} />
              <Button type="submit" disabled={picked !== null || !normalize(draft)}>提交</Button>
            </form>
          )}
          <ol className="mt-4 grid gap-2">
            {q.options.map((opt, i) => {
              const isAnswer = i === q.answer; const isPicked = i === picked;
              const state = picked === null ? 'idle' : isAnswer ? 'right' : isPicked ? 'wrong' : 'dim';
              return (
                <li key={i}>
                  <button type="button" onClick={() => pick(i)} disabled={picked !== null} aria-pressed={isPicked}
                    className={cn('flex w-full items-start gap-3 rounded-lg border px-4 py-2.5 text-left text-[15px] transition-colors',
                      state === 'idle' && 'hover:border-primary hover:bg-accent/40',
                      state === 'right' && 'border-know-line bg-know-soft text-know',
                      state === 'wrong' && 'border-dontknow-line bg-dontknow-soft text-dontknow',
                      state === 'dim' && 'opacity-50')}>
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs font-semibold">{LETTERS[i]}</span>
                    <span>{opt}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={() => pick(DONT_KNOW)} disabled={picked !== null} aria-pressed={picked === DONT_KNOW}
            className={cn('mt-2 flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-2 text-left text-sm text-muted-foreground transition-colors', picked === null ? 'hover:border-unsure-line hover:bg-unsure-soft hover:text-unsure' : picked === DONT_KNOW ? 'border-unsure-line bg-unsure-soft text-unsure' : 'opacity-50')}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded border text-xs font-semibold">E</span>不知道 · Show the answer
          </button>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={cn('text-sm', picked === null ? 'text-muted-foreground' : picked === q.answer ? 'text-know' : picked === DONT_KNOW ? 'text-unsure' : 'text-dontknow')}>
              {picked === null ? (mode === 'spell' ? 'Type the word and press Enter, or E if you don’t know.' : 'Pick A, B, C or D, or E if you don’t know.') : picked === q.answer ? '答对了 · Correct' : picked === DONT_KNOW ? (mode === 'spell' ? `正确拼写：${q.word} · take your time, then press 下一题.` : `正确答案是 ${LETTERS[q.answer]} · take your time, then press 下一题.`) : (mode === 'spell' ? `答错了 · 正确拼写：${q.word}` : `答错了 · The answer is ${LETTERS[q.answer]}.`)}
              {picked !== null && <> · <a href={cardHref(q.word)} target="_blank" rel="noopener" className="text-primary hover:underline">Open the card of {q.word} ↗</a></>}
            </span>
            <span className="flex gap-2">
              <Button variant="outline" disabled={index === 0} onClick={prev} title="Previous question (←)"><ArrowLeft className="mr-1 h-3.5 w-3.5" />上一题</Button>
              <Button disabled={picked === null} onClick={next} title="Next question (Enter / →)">{index + 1 >= questions.length ? 'See results' : '下一题'}<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
