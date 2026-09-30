import { Input } from '@/components/ui/input.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { categoryLabel } from '@/lib/datasets.ts';
import type { Order, StatusFilter } from '@/lib/ratings.ts';
import { setView, useAppState } from '@/state/store.ts';
import { cn } from '@/lib/utils.ts';

const SHOW: { value: StatusFilter; label: string }[] = [
  { value: 'unreviewed', label: 'Unreviewed' }, { value: 'reviewed', label: 'Reviewed' }, { value: 'all', label: 'All words' },
  { value: 'definitely_know', label: 'Definitely know' }, { value: 'not_sure', label: 'Not sure' }, { value: 'dont_know', label: 'Don’t know' }, { value: 'to_study', label: 'To study' },
];
const ORDERS: { value: Order; label: string }[] = [{ value: 'frequency', label: 'Source order' }, { value: 'az', label: 'A → Z' }, { value: 'za', label: 'Z → A' }];

export function Filters() {
  const view = useAppState(s => s.view);
  const loading = useAppState(s => s.loading);
  const categories = useAppState(s => s.data).reduce<string[]>((acc, r) => (acc.includes(r.selection) ? acc : [...acc, r.selection]), []).filter(c => c !== 'all');
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="flex min-w-[155px] flex-[1.5] flex-col gap-1">
        <label htmlFor="search" className="text-sm text-muted-foreground">Find a word</label>
        <Input id="search" type="search" placeholder="Search English or 中文" autoComplete="off" value={view.search} disabled={loading} onChange={e => setView({ search: e.target.value })} className="h-11" />
      </div>
      <div className="flex min-w-[155px] flex-1 flex-col gap-1">
        <label className="text-sm text-muted-foreground">Show</label>
        <Select value={view.filter} onValueChange={v => setView({ filter: v as StatusFilter })} disabled={loading}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{SHOW.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Invert</span>
        <div className={cn('flex h-11 items-center gap-2 whitespace-nowrap rounded-md border bg-white px-3 text-sm', view.invert && 'border-primary bg-accent text-primary', (loading || view.filter === 'all') && 'opacity-50')}>
          <Switch id="invert" checked={view.invert} disabled={loading || view.filter === 'all'} onCheckedChange={v => setView({ invert: v })} /><label htmlFor="invert" className="cursor-pointer select-none">Show the rest · 反选</label>
        </div>
      </div>
      <div className="flex min-w-[155px] flex-1 flex-col gap-1">
        <label className="text-sm text-muted-foreground">Category</label>
        <Select value={view.source} onValueChange={v => setView({ source: v })} disabled={loading}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex min-w-[155px] flex-1 flex-col gap-1">
        <label className="text-sm text-muted-foreground">Order</label>
        <Select value={view.order} onValueChange={v => setView({ order: v as Order })} disabled={loading}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{ORDERS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
