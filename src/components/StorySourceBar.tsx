import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { deleteStoryBundle, getStoryBundle, parseStoryBundle, putStoryBundle, type StoryBundle } from '@/lib/storyBundle.ts';
import { hasStories, notify, setStoriesImported, useAppState } from '@/state/store.ts';

/** Where the current collection's stories come from, with import / replace / remove of a stories bundle (bundle.json from
 *  scripts/stories/validate.py). Shown on the Stories and Practice pages; an imported bundle wins over the data folder. */
export function StorySourceBar() {
  const config = useAppState(s => s.config);
  const imported = useAppState(s => s.storiesImported);
  const available = useAppState(hasStories);
  const [bundle, setBundle] = useState<StoryBundle | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setBundle(undefined); if (config && imported) void getStoryBundle(config.id).then(setBundle); }, [config, imported]);

  const importBundle = async (file: File): Promise<void> => {
    if (!config) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Use a bundle smaller than 50 MB.');
      const b = parseStoryBundle(await file.text());
      if (b.dataset !== config.id) throw new Error(`This bundle belongs to ${b.dataset}, not ${config.id}. Switch collection first.`);
      await putStoryBundle({ ...b, imported_at: new Date().toISOString(), name: file.name });
      setStoriesImported(true);
      notify(`Imported ${b.stories.length} stories from ${file.name} into this browser.`);
    } catch (error) { notify('Import failed: ' + (error instanceof Error ? error.message : String(error)), true); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const removeBundle = async (): Promise<void> => { if (!config) return; await deleteStoryBundle(config.id); setStoriesImported(false); notify('Imported stories removed from this browser.'); };
  if (!config) return null;
  const folder = config.stories;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-[#f8f9fd] px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        <b className="text-foreground">Stories source · 故事来源：</b>{' '}
        {imported ? <>imported bundle{bundle ? ` · ${bundle.stories.length} stories · ${bundle.name ?? 'bundle.json'}${bundle.imported_at ? ` · ${new Date(bundle.imported_at).toLocaleString()}` : ''}` : ''}{folder ? ` (overrides ${folder})` : ''}</>
          : folder ? <>data folder <code>{folder}</code></> : <>none · import a bundle.json</>}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={available ? 'outline' : 'default'} onClick={() => fileInput.current?.click()} className="gap-1.5" title="stories/bundle.json written by scripts/stories/validate.py"><Upload className="h-3.5 w-3.5" />{imported ? 'Replace bundle · 替换' : 'Import stories bundle · 导入故事'}</Button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void importBundle(f); }} />
        {imported && <Button size="sm" variant="outline" onClick={() => void removeBundle()} className="gap-1.5 border-dontknow-line text-dontknow hover:bg-dontknow-soft hover:text-dontknow"><Trash2 className="h-3.5 w-3.5" />Remove bundle · 移除</Button>}
      </span>
    </div>
  );
}
