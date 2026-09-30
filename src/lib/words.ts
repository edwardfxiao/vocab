import { csvRecords, type CsvRecord } from './csv.ts';
import type { DatasetConfig } from './datasets.ts';

/** A normalized vocabulary entry. `raw` keeps every source column for exports. */
export interface WordEntry {
  id: string;
  word: string;
  meaning_zh: string;
  phonetic: string;
  selection: string;
  context: string;
  details: string;
  raw: CsvRecord;
}

export interface Dataset { config: DatasetConfig; data: WordEntry[]; columns: string[] }

const joined = (value: string | undefined): string => (value ? (JSON.parse(value) as string[]).join(' / ') : '');

export function normalizeDataset(text: string, config: DatasetConfig): { data: WordEntry[]; columns: string[] } {
  const { headers, rows } = csvRecords(text);
  const required = config.kind === 'spelling' ? ['id', 'british', 'american', 'meaning_zh'] : ['id', 'word'];
  if (required.some(h => !headers.includes(h))) throw new Error('The source CSV is missing required columns.');
  const ids = new Set<string>();
  const data = rows.map(raw => {
    if (!raw.id || ids.has(raw.id)) throw new Error(`Missing or duplicate record ID: ${raw.id}`);
    ids.add(raw.id);
    const word = config.kind === 'spelling' ? raw.british : raw.word;
    if (!word || !word.trim()) throw new Error(`Empty word at ID ${raw.id}.`);
    return {
      id: raw.id,
      word,
      meaning_zh: raw.meaning_zh ?? joined(raw.meanings_zh_json),
      phonetic: raw.phonetic ?? '',
      selection: raw.selection || raw.category || raw.chapter || 'all',
      context: [raw.part_of_speech || joined(raw.part_of_speech_json),
        raw.wordlists ? `Academic lists: ${raw.wordlists}` : '',
        raw.variants_json ? `Forms: ${joined(raw.variants_json)}` : '',
        raw.american ? `American: ${raw.american}` : ''].filter(Boolean).join(' · '),
      details: [raw.definition_en, raw.example ? `Example: ${raw.example}` : '',
        raw.replacements_json ? `Replacements: ${joined(raw.replacements_json)}` : '',
        raw.notes && raw.notes !== '-' ? `Notes: ${raw.notes}` : ''].filter(Boolean).join('\n\n'),
      raw,
    } satisfies WordEntry;
  });
  return { data, columns: [...new Set(['dataset', ...headers, 'word', 'status', 'reviewed_at'])] };
}

export const wordKey = (word: string): string => word.toLowerCase().trim();
