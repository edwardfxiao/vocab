import { csvCell, csvRecords } from './csv.ts';
import { isStatus, normalizeStatus, type Rating, type Ratings } from './ratings.ts';
import { wordKey, type WordEntry } from './words.ts';

export interface ExtraColumns { gloss_zh?: string; trap?: string; note?: string }

export function buildCSV(rows: WordEntry[], columns: string[], dataset: string, ratings: Ratings, extra: (row: WordEntry) => ExtraColumns = () => ({})): string {
  const matrix = [columns, ...rows.map(row => {
    const ex = extra(row) as Record<string, string | undefined>;
    return columns.map(column => {
      if (column === 'dataset') return dataset;
      if (column === 'status') return ratings[row.id]?.status ?? 'unreviewed';
      if (column === 'reviewed_at') return ratings[row.id]?.reviewed_at ?? '';
      if (column in ex) return ex[column] ?? '';
      return row.raw[column] ?? (column === 'word' ? row.word : '');
    });
  })];
  return '﻿' + matrix.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export interface ImportResult { imported: Map<string, Rating>; notes: Map<string, string>; ignored: number; from: string }

/** Parses a ratings backup. Same-collection backups match by dataset + id; backups from another collection (or legacy files) match by spelling. */
export function parseRatingsImport(text: string, dataset: string, data: WordEntry[]): ImportResult {
  const { headers, rows } = csvRecords(text);
  if (!headers.includes('word') || !headers.includes('status')) throw new Error('The CSV needs word and status columns.');
  const byId = new Map(data.map(row => [row.id, row]));
  const byWord = new Map<string, WordEntry[]>();
  for (const row of data) {
    const key = wordKey(row.word);
    byWord.set(key, [...(byWord.get(key) ?? []), row]);
  }
  const imported = new Map<string, Rating>();
  const notes = new Map<string, string>();
  let ignored = 0;
  const hasDataset = headers.includes('dataset');
  const from = hasDataset && rows.length && rows[0].dataset !== dataset ? (rows[0].dataset || 'an unspecified collection') : '';
  for (const row of rows) {
    if (hasDataset && (row.dataset || '') !== (from || dataset)) throw new Error('This CSV mixes rows from different collections.');
    let match: WordEntry | undefined;
    if (!from && hasDataset && headers.includes('id')) {
      match = byId.get(row.id);
      if (match && wordKey(match.word) !== wordKey(row.word)) throw new Error(`Record ${row.id} now has a different word. Check the source version before restoring.`);
    } else {
      const matches = byWord.get(wordKey(row.word)) ?? [];
      if (matches.length > 1) throw new Error(`Ambiguous word: ${row.word}. Use an export containing dataset and id columns.`);
      match = matches[0];
    }
    if (!match) { ignored++; continue; }
    if (imported.has(match.id)) { if (from) { ignored++; continue; } throw new Error(`Duplicate record in CSV: ${row.word}`); }
    const status = normalizeStatus(row.status);
    if (!isStatus(status)) throw new Error(`Invalid status for ${row.word}: ${row.status || '(blank)'}`);
    if (row.reviewed_at && Number.isNaN(Date.parse(row.reviewed_at))) throw new Error(`Invalid review date for ${row.word}.`);
    imported.set(match.id, { status, reviewed_at: row.reviewed_at || '' });
    if (row.note?.trim()) notes.set(match.id, row.note);
  }
  if (!imported.size) throw new Error('No matching words were found in this collection.');
  return { imported, notes, ignored, from };
}

export function fileStamp(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}
