import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Moon, Sun } from 'lucide-react';
import { currentTheme, setTheme, watchSystemTheme, type Theme } from '@/lib/theme.ts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { DATASETS, datasetSlug } from '@/lib/datasets.ts';
import { clearNotice, useAppState } from '@/state/store.ts';
import { useDatasetRoute } from '@/hooks/useDatasetRoute.ts';
import { cn } from '@/lib/utils.ts';

export function Layout() {
  const { config, slug } = useDatasetRoute();
  const navigate = useNavigate();
  const section = useLocation().pathname.split('/')[2];   // switching collection keeps you on the stories / practice tab
  const keep = section === 'stories' || section === 'practice' ? `/${section}` : '';   // (practice/list is per collection: switching lands on the story picker)
  const loading = useAppState(s => s.loading);
  const storageOK = useAppState(s => s.storageOK);
  const loadError = useAppState(s => s.loadError);
  const notice = useAppState(s => s.notice);
  const total = useAppState(s => s.data.length);
  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  useEffect(() => watchSystemTheme(), []);
  const toggleTheme = (): void => { const next: Theme = theme === 'dark' ? 'light' : 'dark'; setTheme(next); setThemeState(next); };
  const saveStatus = loading ? 'Loading collection…' : loadError ? 'Collection unavailable' : storageOK ? 'Progress saved in this browser' : 'Auto-save unavailable · export a backup';
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-8 sm:py-4">
          <Link to={`/${slug}`} className="flex items-center gap-2.5 whitespace-nowrap text-lg font-bold tracking-tight hover:text-primary sm:gap-3 sm:text-[21px]" title="Checker">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-serif text-white sm:h-9 sm:w-9" aria-hidden>w</span> Word by word
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <NavLink to={`/${slug}`} end className={({ isActive }) => cn('text-sm hover:text-primary', isActive && 'font-semibold text-primary')}>Checker</NavLink>
            <NavLink to={`/${slug}/stories`} className={({ isActive }) => cn('text-sm hover:text-primary', isActive && 'font-semibold text-primary')}>Stories</NavLink>
            <NavLink to={`/${slug}/practice`} className={({ isActive }) => cn('text-sm hover:text-primary', isActive && 'font-semibold text-primary')}>Practice</NavLink>
            <div className="w-full text-xs text-muted-foreground md:w-auto md:text-right md:text-sm" role="status">{saveStatus}</div>
            <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? '亮色 · Light' : '暗色 · Dark'} className="grid h-9 w-9 place-items-center rounded-lg border text-muted-foreground hover:border-primary hover:text-primary">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-4 sm:px-8 sm:py-6">
        <div className="mb-4 flex flex-col items-start gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
          <div>
            <h1 className="mb-1 text-2xl font-bold leading-tight tracking-tight sm:mb-2 sm:text-3xl">Your vocabulary, one word at a time.</h1>
            <p className="text-muted-foreground">{config?.label.split(' · ')[0] ?? 'Loading collection'} · {total ? total.toLocaleString() : '—'} entries</p>
          </div>
          <p className="hidden text-right text-sm text-muted-foreground sm:block">先判断，再看释义。<br />Build a list of words to study.</p>
        </div>
        <div className="mb-4 max-w-[540px] sm:mb-5">
          <label className="mb-1 block text-sm text-muted-foreground">Vocabulary database</label>
          <Select value={slug} onValueChange={v => navigate(`/${v}${keep}`)}>
            <SelectTrigger className="h-11 text-base font-semibold sm:h-12 sm:text-[17px]"><SelectValue placeholder="Choose a collection" /></SelectTrigger>
            <SelectContent>{DATASETS.map(d => <SelectItem key={d.id} value={datasetSlug(d.id)}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {notice && (
          <div role="status" className={cn('mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm', notice.warn ? 'border-note-line bg-warn text-warn-foreground' : 'border-info bg-accent text-accent-foreground')}>
            <span>{notice.text}</span>
            <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={clearNotice} aria-label="Dismiss">✕</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
