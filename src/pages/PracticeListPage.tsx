import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { StoryQuiz } from '@/components/StoryQuiz.tsx';
import { WordCard } from '@/components/WordCard.tsx';
import { WordList } from '@/components/WordList.tsx';
import { datasetSlug } from '@/lib/datasets.ts';
import { mergedIds, parseWordList, practiceListKey, readPracticeList, type PracticeList } from '@/lib/practiceList.ts';
import type { StoryGlossaryEntry } from '@/lib/stories.ts';
import type { WordEntry } from '@/lib/words.ts';
import { notify, setCurrent, setListQueue, useAppState } from '@/state/store.ts';

const readStored = (dataset: string): PracticeList | null => { try { return readPracticeList(localStorage.getItem(practiceListKey(dataset))); } catch { return null; } };
const writeStored = (dataset: string, list: PracticeList | null): void => { try { if (list) localStorage.setItem(practiceListKey(dataset), JSON.stringify(list)); else localStorage.removeItem(practiceListKey(dataset)); } catch { /* storage unavailable */ } };

/** /:ds/practice/list — import a CSV of words (a missed-words or study-list export, or any CSV with a word column), review them
 *  in the checker's card and quiz them below. The list is remembered per collection in this browser until you clear it. */
export function PracticeListPage() {
  const config = useAppState(s => s.config);
  const data = useAppState(s => s.data);
  const loading = useAppState(s => s.loading);
  const enrichment = useAppState(s => s.enrichment);
  const slug = config ? datasetSlug(config.id) : '';
  const [list, setList] = useState<PracticeList | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Load the remembered list for this collection; pin the queue to it while the page is open.
  useEffect(() => { if (config) setList(readStored(config.id)); }, [config]);
  useEffect(() => {
    if (loading || !config) return;
    setListQueue(list ? mergedIds(list) : null);   // no list: the queue stays the ordinary one
    return () => setListQueue(null);
  }, [list, loading, config]);

  // The list's entries in file order (the store's queue is pinned to the same ids while this page is open).
  const ids = useMemo(() => (list ? mergedIds(list) : []), [list]);
  const entries = useMemo<WordEntry[]>(() => { if (loading) return []; const byId = new Map(data.map(r => [r.id, r])); return ids.map(id => byId.get(id)).filter((r): r is WordEntry => !!r); }, [data, ids, loading]);
  const glossary = useMemo<StoryGlossaryEntry[]>(() => entries.map(e => ({ word: e.word, zh: enrichment.words[e.word.toLowerCase()]?.gloss || e.meaning_zh.split('\n')[0] })), [entries, enrichment]);

  const importFile = async (file: File): Promise<void> => {
    if (!config || loading) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Use a CSV file smaller than 20 MB.');
      const { entries: found, ignored, byId } = parseWordList(await file.text(), config.id, data);
      const source = { name: file.name, ids: found.map(e => e.id), imported_at: new Date().toISOString() };
      const before = list ? new Set(mergedIds(list)) : new Set<string>();
      const added = source.ids.filter(id => !before.has(id)).length;
      const next: PracticeList = { sources: [...(list?.sources.filter(s => s.name !== file.name) ?? []), source] };   // re-importing a file replaces its earlier copy
      writeStored(config.id, next); setList(next);
      if (!before.size) setCurrent(source.ids[0]);
      notify(`Added ${file.name}: ${found.length.toLocaleString()} words${before.size ? `, ${added.toLocaleString()} new to the list` : ''}${byId ? '' : ' (matched by spelling)'}${ignored ? `; ${ignored.toLocaleString()} rows did not match this collection` : ''}.`);
    } catch (error) { notify('Import failed: ' + (error instanceof Error ? error.message : String(error)), true); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const clear = (): void => { if (config) writeStored(config.id, null); setList(null); };
  const removeSource = (name: string): void => { if (!config || !list) return; const sources = list.sources.filter(s => s.name !== name); const next = sources.length ? { sources } : null; writeStored(config.id, next); setList(next); };

  return (
    <>
      <section className="mb-5 rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Practice a list · 按清单练习</h2>
            <p className="mt-1 text-sm text-muted-foreground">Import a CSV you exported (missed words, a study list, a backup) or any CSV with a <code>word</code> column. Review each word in the card, then quiz yourself below. 导入导出的 CSV，上面看释义，下面做练习。 · <Link to={`/${slug}/practice`} className="text-primary hover:underline">Practice by story →</Link></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={loading} onClick={() => fileInput.current?.click()} className="gap-1.5"><Upload className="h-3.5 w-3.5" />{list ? 'Add another CSV · 再导入一份' : 'Import CSV · 导入'}</Button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
            {list && <Button size="sm" variant="outline" onClick={clear} className="gap-1"><X className="h-3.5 w-3.5" />Clear all</Button>}
          </div>
        </div>
        {list && !loading && (
          <div className="mt-3 text-sm text-muted-foreground">
            <ul className="flex flex-wrap gap-2">
              {list.sources.map(src => (
                <li key={src.name} className="flex items-center gap-2 rounded-lg border bg-[#f8f9fd] py-1 pl-3 pr-1" title={src.imported_at ? `Imported ${new Date(src.imported_at).toLocaleString()}` : undefined}>
                  <b className="text-foreground">{src.name}</b><span>{src.ids.length.toLocaleString()} words</span>
                  <button type="button" onClick={() => removeSource(src.name)} aria-label={`Remove ${src.name}`} className="rounded p-1 hover:bg-black/5 hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <p className="mt-2">{list.sources.length > 1 ? `${list.sources.length} files · ` : ''}{entries.length.toLocaleString()} distinct words{ids.length !== entries.length ? ` (${(ids.length - entries.length).toLocaleString()} no longer in this collection)` : ''} · kept in this browser for {config?.label.split(' · ')[0]}</p>
          </div>
        )}
      </section>
      {loading ? <p className="text-muted-foreground">Loading collection…</p> : !list ? (
        <section className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border bg-white px-4 py-10 text-center">
          <p className="text-lg font-semibold">No list yet.</p>
          <p className="mt-1 max-w-[520px] text-sm text-muted-foreground">Export “答错和不知道的” from a quiz or tick words in a story glossary, then import that file here. Ratings you give in the card are saved like anywhere else.</p>
        </section>
      ) : entries.length === 0 ? (
        <section className="rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6 text-muted-foreground">None of the listed words are in this collection. Import another CSV or switch collection.</section>
      ) : (
        <>
          <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-5 max-[850px]:grid-cols-1">
            <WordList queue={entries} />
            <WordCard queue={entries} keyHints={false} />
          </div>
          <section className="mt-5 rounded-xl border bg-white px-4 py-5 sm:px-8 sm:py-6">
            <StoryQuiz key={ids.join(',')} glossary={glossary} slug={slug} exportLabel="list-missed" />
          </section>
        </>
      )}
    </>
  );
}
