/** Light / dark theme: stored per browser, defaults to the system preference. index.html applies the stored choice
 *  before the first paint (no flash); this module keeps it in sync and exposes the toggle. */
export type Theme = 'light' | 'dark';
const KEY = 'word-by-word.theme.v1';
const META_COLORS: Record<Theme, string> = { light: '#2b50df', dark: '#141a2b' };

export function systemTheme(): Theme { return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
export function storedTheme(): Theme | null { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } }
export function currentTheme(): Theme { return document.documentElement.classList.contains('dark') ? 'dark' : 'light'; }
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
}
export function setTheme(theme: Theme): void { applyTheme(theme); try { localStorage.setItem(KEY, theme); } catch { /* preference only */ } }
/** Follow the system until the user picks one. */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => undefined;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onChange = (): void => { if (!storedTheme()) applyTheme(mq.matches ? 'dark' : 'light'); };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
