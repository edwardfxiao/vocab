import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import type { Rating, StatusFilter } from '@/lib/ratings.ts';
import { fileStamp, parseRatingsImport } from '@/lib/transfer.ts';
import type { WordEntry } from '@/lib/words.ts';
import { applyImport, countStatuses, getState, importExtras, notify, resetAll, statusOf, useAppState } from '@/state/store.ts';
import { downloadCSV, exportWords } from '@/state/export.ts';
import { buildExtrasCSV, isExtrasCSV, parseExtrasImport, type ExtraWord } from '@/lib/notes.ts';
import { statusMatches } from '@/lib/ratings.ts';
import { cn } from '@/lib/utils.ts';

type ExportKind = StatusFilter | 'filtered';
interface Pending { name: string; imported: Map<string, Rating>; notes: Map<string, string>; ignored: number; from: string; changes: number }
interface PendingExtras { name: string; extras: ExtraWord[] }

const STUDY: { kind: ExportKind; label: string; hint?: string; className: string }[] = [
  { kind: 'to_study', label: 'To study', hint: 'Not sure + Don’t know', className: '' },
  { kind: 'not_sure', label: 'Not sure', className: 'border-unsure-line bg-unsure-soft text-unsure hover:bg-unsure-soft hover:brightness-95' },
  { kind: 'dont_know', label: 'Don’t know', className: 'border-dontknow-line bg-dontknow-soft text-dontknow hover:bg-dontknow-soft hover:brightness-95' },
  { kind: 'definitely_know', label: 'Definitely know', className: 'border-know-line bg-know-soft text-know hover:bg-know-soft hover:brightness-95' },
  { kind: 'filtered', label: 'Current view', className: 'border-[#c2d0ff] bg-accent text-primary hover:bg-accent hover:brightness-95' },
];

function Count({ n, primary }: { n: number; primary?: boolean }) {
  return <span className={cn('rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums', primary ? 'bg-white/25 text-white' : 'bg-black/5 text-muted-foreground')}>{n.toLocaleString()}</span>;
}

export function TransferPanel({ queue }: { queue: WordEntry[] }) {
  const data = useAppState(s => s.data);
  const ratings = useAppState(s => s.ratings);
  const config = useAppState(s => s.config);
  const loading = useAppState(s => s.loading);
  const extras = useAppState(s => s.extras);
  const counts = countStatuses(data, ratings);
  const rated = data.length - counts.unreviewed;
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingExtras, setPendingExtras] = useState<PendingExtras | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const countFor = (kind: ExportKind): number => kind === 'all' ? data.length : kind === 'filtered' ? queue.length : kind === 'to_study' ? counts.not_sure + counts.dont_know : kind === 'reviewed' ? rated : counts[kind];

  const exportCSV = (kind: ExportKind): void => {
    if (loading || !config) return;
    const rows = kind === 'filtered' ? queue : data.filter(r => statusMatches(statusOf(ratings, r.id), kind));
    exportWords(rows, kind);
  };
  const exportExtras = (): void => {
    if (!extras.length) { notify('No extra words to export yet.'); return; }
    const name = downloadCSV(buildExtrasCSV(extras), `extra-words-${fileStamp()}.csv`);
    notify(`Exported ${extras.length.toLocaleString()} extra words as ${name}.`);
  };

  const readImport = async (file: File): Promise<void> => {
    if (loading || !config) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Use a CSV file smaller than 20 MB.');
      const text = await file.text();
      if (isExtrasCSV(text)) { setPendingExtras({ name: file.name, extras: parseExtrasImport(text) }); return; }
      const { data: current, ratings: currentRatings, config: currentConfig } = getState();
      if (currentConfig?.id !== config.id) return;
      const { imported, notes: importedNotes, ignored, from } = parseRatingsImport(text, config.id, current);
      const changes = [...imported].filter(([id, r]) => statusOf(currentRatings, id) !== r.status).length;
      setPending({ name: file.name, imported, notes: importedNotes, ignored, from, changes });
    } catch (error) {
      notify('Import failed: ' + (error instanceof Error ? error.message : String(error)), true);
    } finally { if (fileInput.current) fileInput.current.value = ''; }
  };

  return (
    <section aria-label="Export study lists, back up and restore progress" className="my-5 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3 max-[850px]:grid-cols-1">
      <div className="rounded-xl border bg-white px-4 py-3.5">
        <div className="mb-2.5 flex flex-col gap-0.5"><strong className="text-sm">Export study lists · 导出学习清单</strong><span className="text-sm text-muted-foreground">One CSV per status. Send “To study” to your assistant. 按状态导出，数字为词数。</span></div>
        <div className="flex flex-wrap gap-2">
          {STUDY.map(b => { const n = countFor(b.kind); const primary = b.kind === 'to_study'; return (
            <Button key={b.kind} variant={primary ? 'default' : 'outline'} size="sm" disabled={loading || n === 0} onClick={() => exportCSV(b.kind)} className={cn('gap-1.5', b.className)} title={b.kind === 'filtered' ? `Export the ${n.toLocaleString()} words in the list below` : `Export ${n.toLocaleString()} words`}>
              <Download className="h-3.5 w-3.5" />{b.label}{b.hint && <span className="hidden font-normal opacity-80 sm:inline">({b.hint})</span>}<Count n={n} primary={primary} />
            </Button>
          ); })}
        </div>
      </div>
      <div className="rounded-xl border border-dashed bg-[#f8f9fd] px-4 py-3.5">
        <div className="mb-2.5 flex flex-col gap-0.5"><strong className="text-sm">Back up &amp; restore · 备份与恢复</strong><span className="text-sm text-muted-foreground">Ratings and notes live in this browser only. Back up before clearing data; restore shows a preview first. 评分和笔记只存在本浏览器。</span></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={loading || !data.length} onClick={() => exportCSV('all')} className="gap-1.5"><Download className="h-3.5 w-3.5" />Back up all progress<Count n={data.length} /></Button>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => fileInput.current?.click()} className="gap-1.5"><Upload className="h-3.5 w-3.5" />Restore from backup CSV</Button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void readImport(f); }} />
          <Button variant="outline" size="sm" disabled={!extras.length} onClick={exportExtras} className="gap-1.5" title="Words you added that the collections lack, with your glosses"><Download className="h-3.5 w-3.5" />Extra words<Count n={extras.length} /></Button>
          <Button variant="outline" size="sm" disabled={loading || rated === 0} onClick={() => setResetOpen(true)} className="border-dontknow-line text-dontknow hover:bg-dontknow-soft hover:text-dontknow" title={rated ? `Clear ${rated.toLocaleString()} ratings in this collection` : 'No ratings to clear'}>Reset all ratings</Button>
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={open => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restore preview · 恢复预览</DialogTitle>
            <DialogDescription>
              {pending && <>“{pending.name}” lists {pending.imported.size.toLocaleString()} {pending.imported.size === 1 ? 'word' : 'words'} found in {config?.label}.
                {pending.from ? ` It was exported from ${pending.from}, so words were matched by spelling.` : ''}
                {pending.ignored ? ` ${pending.ignored.toLocaleString()} rows did not match any word here and will be skipped.` : ''}{' '}
                {pending.changes ? `Applying will change the rating of ${pending.changes.toLocaleString()} ${pending.changes === 1 ? 'word' : 'words'}; the other ${(pending.imported.size - pending.changes).toLocaleString()} already match.` : 'Nothing will change: every rating in this file already matches this browser.'}
                {data.length - pending.imported.size > 0 ? ` The ${(data.length - pending.imported.size).toLocaleString()} words not in this file keep their current ratings.` : ''}
                {pending.notes.size ? ` ${pending.notes.size.toLocaleString()} notes (我的理解) will be restored too.` : ''}</>}
            </DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => { if (pending) applyImport(pending.imported, pending.notes); setPending(null); }}>Apply ratings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingExtras} onOpenChange={open => { if (!open) setPendingExtras(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add extra words · 导入补充词</DialogTitle>
            <DialogDescription>{pendingExtras && <>“{pendingExtras.name}” is an extra-words export with {pendingExtras.extras.length.toLocaleString()} {pendingExtras.extras.length === 1 ? 'word' : 'words'}. Words you already have keep your gloss; new ones are added to the list on this page.</>}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingExtras(null)}>Cancel</Button>
            <Button onClick={() => { if (pendingExtras) importExtras(pendingExtras.extras); setPendingExtras(null); }}>Add words</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-dontknow">Reset this collection · 清空确认</DialogTitle>
            <DialogDescription>This clears the ratings of {rated.toLocaleString()} {rated === 1 ? 'word' : 'words'} in {config?.label} and sets every word back to Unreviewed. Other collections are not affected. This cannot be undone: use “Back up all progress” first if you may want them back.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" autoFocus onClick={() => setResetOpen(false)}>Keep my ratings</Button>
            <Button variant="destructive" onClick={() => { resetAll(); setResetOpen(false); }}>Yes, clear all ratings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
