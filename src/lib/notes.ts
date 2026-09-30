/** Personal layer: a free-text note per word (“我的理解”) and extra words that the collections lack (e.g. abbot).
 *  Both live in localStorage; notes travel in backups as a `note` column, extra words as their own CSV. */
import { csvCell, csvRecords } from './csv.ts';

export type Notes = Record<string, string>;                       // word id → note
export interface ExtraWord { word: string; zh: string; added_at: string }

export const notesKey = (datasetId: string): string => `word-by-word.notes.${datasetId}.v1`;
export const EXTRAS_KEY = 'word-by-word.extras.v1';
export const EXTRAS_DATASET = 'extra-words';

export function readNotes(raw: string | null, ids: ReadonlySet<string>): Notes {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return {};
  const out: Notes = {};
  for (const [id, note] of Object.entries(parsed as Record<string, unknown>)) if (ids.has(id) && typeof note === 'string' && note.trim()) out[id] = note;
  return out;
}

export const extraKey = (word: string): string => word.toLowerCase().trim();

export function readExtras(raw: string | null): ExtraWord[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: ExtraWord[] = [];
  for (const x of parsed as unknown[]) {
    if (!x || typeof x !== 'object') continue;
    const { word, zh, added_at } = x as Record<string, unknown>;
    if (typeof word !== 'string' || !word.trim() || seen.has(extraKey(word))) continue;
    seen.add(extraKey(word));
    out.push({ word: word.trim(), zh: typeof zh === 'string' ? zh : '', added_at: typeof added_at === 'string' ? added_at : '' });
  }
  return out;
}

export function buildExtrasCSV(extras: ExtraWord[]): string {
  const rows = [['dataset', 'word', 'zh', 'added_at'], ...extras.map(x => [EXTRAS_DATASET, x.word, x.zh, x.added_at])];
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** True when a CSV is an extra-words export (dataset column = extra-words) rather than a ratings backup. */
export function isExtrasCSV(text: string): boolean {
  try { const { headers, rows } = csvRecords(text); return headers.includes('zh') && rows.length > 0 && rows[0].dataset === EXTRAS_DATASET; } catch { return false; }
}

export function parseExtrasImport(text: string): ExtraWord[] {
  const { headers, rows } = csvRecords(text);
  if (!headers.includes('word') || !headers.includes('zh')) throw new Error('An extra-words CSV needs word and zh columns.');
  return readExtras(JSON.stringify(rows.map(r => ({ word: r.word, zh: r.zh, added_at: r.added_at ?? '' }))));
}

/** Merges imported extras into the current list: new words are appended, existing words get the imported gloss when theirs is empty. */
export function mergeExtras(current: ExtraWord[], imported: ExtraWord[]): { extras: ExtraWord[]; added: number } {
  const byKey = new Map(current.map(x => [extraKey(x.word), x]));
  let added = 0;
  for (const x of imported) {
    const k = extraKey(x.word);
    const have = byKey.get(k);
    if (!have) { byKey.set(k, x); added++; }
    else if (!have.zh && x.zh) byKey.set(k, { ...have, zh: x.zh });
  }
  return { extras: [...byKey.values()], added };
}
