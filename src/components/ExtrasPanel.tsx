import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { addExtra, entryByWord, notify, removeExtra, useAppState } from '@/state/store.ts';

/** Words the collections lack (abbot, abbess…) with my own gloss. Stored in this browser, shared by every collection,
 *  highlighted in the stories, exported/restored through the backup panel. */
export function ExtrasPanel() {
  const extras = useAppState(s => s.extras);
  const [word, setWord] = useState('');
  const [zh, setZh] = useState('');
  const submit = (): void => {
    const w = word.trim();
    if (!w) return;
    const existing = entryByWord(w);
    if (existing) { notify(`“${existing.word}” is already in this collection (${existing.meaning_zh.split('\n')[0]}). Write a note on its card instead.`); return; }
    if (addExtra(w, zh)) { setWord(''); setZh(''); }
  };
  return (
    <section aria-label="Extra words" className="my-5 rounded-xl border bg-white px-4 py-3.5">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <strong className="text-sm">Extra words · 词表外补充</strong>
        <span className="text-sm text-muted-foreground">Words the collection lacks (abbot…) with your own gloss. They are highlighted in the stories and included in “Extra words” exports. 不在词表里的词，记在这里。</span>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
        <Input value={word} onChange={e => setWord(e.target.value)} placeholder="word" aria-label="Extra word" className="h-9 w-44" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <Input value={zh} onChange={e => setZh(e.target.value)} placeholder="释义 / my gloss" aria-label="Gloss" className="h-9 min-w-[240px] flex-1" />
        <Button type="submit" size="sm" disabled={!word.trim()} className="h-9 gap-1"><Plus className="h-3.5 w-3.5" />Add</Button>
      </form>
      {extras.length > 0 && (
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-4 gap-y-1 text-[15px]">
          {[...extras].sort((a, b) => a.word.localeCompare(b.word)).map(x => (
            <li key={x.word} className="flex items-baseline gap-2">
              <button type="button" onClick={() => { setWord(x.word); setZh(x.zh); }} className="font-semibold text-primary hover:underline" title="Edit">{x.word}</button>
              <span className="min-w-0 flex-1 truncate text-muted-foreground" title={x.zh}>{x.zh}</span>
              <button type="button" onClick={() => removeExtra(x.word)} className="text-muted-foreground hover:text-dontknow" aria-label={`Remove ${x.word}`}><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
