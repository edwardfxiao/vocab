import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { csvCell, parseCSV } from './csv.ts';
import { DATASETS, datasetFromSlug, datasetSlug, setDatasets } from './datasets.ts';
// @ts-expect-error plain ESM script shared with the build and the dev server
import { buildDataIndex } from '../../scripts/data-index.mjs';
import { coerceSaved, defaultView, statusMatches, viewMatches } from './ratings.ts';
import { buildCSV, fileStamp, parseRatingsImport } from './transfer.ts';
import { normalizeDataset, type WordEntry } from './words.ts';
import { relationRows, type Enrichment } from './enrichment.ts';
import { mergedIds, parseWordList, readPracticeList } from './practiceList.ts';
import { parseStoryBundle } from './storyBundle.ts';
import { storyKey, storyLabel, storyPath } from './stories.ts';

const root = path.resolve(__dirname, '../..');
const read = (p: string): string => fs.readFileSync(path.join(root, p), 'utf8');
beforeAll(() => { setDatasets((buildDataIndex(path.join(root, 'data'), () => {}) as { collections: unknown[] }).collections); });

describe('csv', () => {
  test('quotes, newlines, formula escaping, malformed input', () => {
    expect(parseCSV('﻿word,meaning\r\n"test","line 1, ""quoted""\nline 2"\r\n')).toEqual([['word', 'meaning'], ['test', 'line 1, "quoted"\nline 2']]);
    expect(() => parseCSV('word,status\n"broken,unknown')).toThrow(/Unclosed/);
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('-note')).toBe('"\'-note"');
  });
});

describe('datasets', () => {
  test('every collection under data/ (folders with dataset.json) loads, with the row count its manifest declares', () => {
    expect(DATASETS.length).toBeGreaterThan(0);
    for (const config of DATASETS) {
      const { data } = normalizeDataset(read(config.file), config);
      expect(data.length).toBeGreaterThan(0);
      expect(new Set(data.map(r => r.id)).size).toBe(data.length);
      const manifestPath = path.join(root, path.dirname(config.file), 'manifest.json');
      if (fs.existsSync(manifestPath)) { const m = JSON.parse(read(path.relative(root, manifestPath))) as { selected?: number }; if (typeof m.selected === 'number') expect(data.length).toBe(m.selected); }
    }
  });
  test('index rejects malformed entries and keeps folder order; slugs round-trip ids with slashes', () => {
    const before = [...DATASETS];
    expect(setDatasets([{ id: 'x', label: 'X', file: 'data/x/x.csv', kind: 'dictionary' }, { id: 'bad' }, { id: 'x', label: 'dup', file: 'f', kind: 'reading' }]).map(d => d.id)).toEqual(['x']);
    setDatasets(before);
    expect(datasetFromSlug(datasetSlug('a/b'))?.id ?? datasetSlug('a/b')).toBe('a~b');
  });
});

describe('ratings', () => {
  test('filters and inversion', () => {
    expect(statusMatches('not_sure', 'to_study')).toBe(true);
    expect(statusMatches('unreviewed', 'reviewed')).toBe(false);
    expect(viewMatches('dont_know', { filter: 'definitely_know', invert: true })).toBe(true);
    expect(viewMatches('unreviewed', { filter: 'definitely_know', invert: true })).toBe(false);
    expect(viewMatches('unreviewed', { filter: 'reviewed', invert: true })).toBe(true);
  });
  test('saved progress is coerced and legacy “unknown” migrates', () => {
    const ids = new Set(['a', 'b']);
    const { ratings, view } = coerceSaved({ ratings: { a: { status: 'unknown', reviewed_at: '' }, b: { status: 'typo' }, c: { status: 'not_sure' } }, view: { filter: 'to_study', invert: true, order: 'az', bogus: 1 } }, ids, new Set());
    expect(ratings).toEqual({ a: { status: 'dont_know', reviewed_at: '' } });
    expect(view).toEqual({ ...defaultView(), filter: 'to_study', invert: true, order: 'az' });
    expect(() => coerceSaved({ ratings: 'x' }, ids, new Set())).toThrow();
  });
});

describe('transfer', () => {
  // The first collection, loaded lazily (the registry is filled in beforeAll).
  let config: (typeof DATASETS)[number]; let data: WordEntry[]; let columns: string[];
  beforeAll(() => { config = DATASETS[0]; ({ data, columns } = normalizeDataset(read(config.file), config)); });
  test('export round-trips through import by id, cross-collection by word, legacy by word', () => {
    const ratings = { [data[0].id]: { status: 'definitely_know' as const, reviewed_at: '2026-09-18T00:00:00.000Z' } };
    const csv = buildCSV(data.slice(0, 3), [...columns, 'gloss_zh', 'trap'], config.id, ratings, r => ({ gloss_zh: `g:${r.word}`, trap: '' }));
    expect(csv).toContain('"g:the"');
    const same = parseRatingsImport(csv, config.id, data);
    expect(same.from).toBe('');
    expect(same.imported.get(data[0].id)?.status).toBe('definitely_know');
    const other = parseRatingsImport(csv, 'another-collection', data);
    expect(other.from).toBe(config.id);
    expect(other.imported.size).toBe(3);
    const legacy = parseRatingsImport('word,status\r\nthe,unknown\r\n', config.id, data);
    expect(legacy.imported.get(data[0].id)?.status).toBe('dont_know');
    expect(() => parseRatingsImport('word,status\nthe,typo\n', config.id, data)).toThrow(/Invalid status/);
    expect(() => parseRatingsImport('word,status\nthe,unknown\nthe,unknown\n', config.id, data)).toThrow(/Duplicate/);
  });
  test('file stamp is local time to the second', () => {
    expect(fileStamp(new Date(2026, 8, 18, 7, 5, 9))).toBe('2026-09-18_07-05-09');
  });
});

describe('enrichment', () => {
  test('relation rows are filtered to listed words and include root and suffix groups', () => {
    const enrichment: Enrichment = {
      words: { transcript: { gloss: 'g', trap: '', root: { key: 'scrib', meaning: '写', match: 'scrip' }, confusable: ['script', 'ghost'], synonyms: [], antonyms: [] } },
      roots: { scrib: { meaning: '写', words: ['describe', 'transcript', 'nowhere'] } },
      confusable: { transcript: ['script', 'ghost'] }, compounds: { overlook: ['over', 'look'] }, families: {}, variants: {}, synonyms: {}, antonyms: {},
    };
    const listed = new Set(['transcript', 'script', 'describe', 'overlook', 'over', 'look', 'applicant', 'consultant', 'assistant']);
    const rows = relationRows('transcript', enrichment, new Map([['look', ['overlook']]]), w => listed.has(w), [...listed]);
    expect(rows.map(r => r.kind)).toEqual(['confusable', 'root']);
    expect(rows[0].words).toEqual(['script']);
    expect(rows[1]).toMatchObject({ rootKey: 'scrib', words: ['describe'] });
    const suffix = relationRows('applicant', enrichment, new Map(), w => listed.has(w), [...listed]);
    expect(suffix.at(-1)).toMatchObject({ kind: 'suffix', label: '同后缀 -ant', words: ['consultant', 'assistant'] });
  });
});

import { buildExtrasCSV, isExtrasCSV, mergeExtras, parseExtrasImport, readExtras, readNotes } from './notes.ts';

test('notes travel in backups and extra words round-trip through CSV', () => {
  const data = [{ id: 'v1', word: 'inferior', meaning_zh: '', phonetic: '', selection: 'all', context: '', details: '', raw: { id: 'v1', word: 'inferior' } }] as unknown as WordEntry[];
  const csv = buildCSV(data, ['dataset', 'id', 'word', 'status', 'reviewed_at', 'note'], 'x', { v1: { status: 'not_sure', reviewed_at: '' } }, () => ({ note: '劣质；in(不)+下面' }));
  expect(csv).toContain('"劣质；in(不)+下面"');
  const back = parseRatingsImport(csv, 'x', data);
  expect(back.notes.get('v1')).toBe('劣质；in(不)+下面');
  expect(readNotes(JSON.stringify({ v1: 'a', v9: 'gone', v2: '   ' }), new Set(['v1', 'v2']))).toEqual({ v1: 'a' });
  const extras = readExtras(JSON.stringify([{ word: 'abbot', zh: '男修道院院长', added_at: '2026-09-24' }, { word: 'Abbot', zh: 'dup' }, { word: '' }]));
  expect(extras).toHaveLength(1);
  const out = buildExtrasCSV(extras);
  expect(isExtrasCSV(out)).toBe(true);
  expect(isExtrasCSV(csv)).toBe(false);
  expect(parseExtrasImport(out)).toEqual(extras);
  const merged = mergeExtras([{ word: 'abbot', zh: '', added_at: '' }], [{ word: 'abbot', zh: '院长', added_at: '' }, { word: 'abbess', zh: '女院长', added_at: '' }]);
  expect(merged.added).toBe(1);
  expect(merged.extras.map(x => x.zh)).toEqual(['院长', '女院长']);
});

test('practice lists load from exports by id, from any word column by spelling, and survive storage round trips', () => {
  const data: WordEntry[] = [
    { id: 'v1', word: 'the', meaning_zh: '那', selection: 'x', raw: { id: 'v1', word: 'the' } } as unknown as WordEntry,
    { id: 'v2', word: 'of', meaning_zh: '的', selection: 'x', raw: { id: 'v2', word: 'of' } } as unknown as WordEntry,
  ];
  const byId = parseWordList('dataset,id,word,status\r\nd,v2,of,dont_know\r\nd,v1,the,not_sure\r\nd,v2,of,dont_know\r\n', 'd', data);
  expect(byId.byId).toBe(true); expect(byId.entries.map(e => e.id)).toEqual(['v2', 'v1']); expect(byId.ignored).toBe(0);
  const byWord = parseWordList('word\r\nOF\r\nzzz\r\n', 'd', data);
  expect(byWord.byId).toBe(false); expect(byWord.entries.map(e => e.id)).toEqual(['v2']); expect(byWord.ignored).toBe(1);
  expect(() => parseWordList('foo\r\nbar\r\n', 'd', data)).toThrow('word column');
  const legacy = readPracticeList(JSON.stringify({ name: 'a.csv', ids: ['v1'], imported_at: '2026-09-24' }));
  expect(legacy?.sources.map(s => s.name)).toEqual(['a.csv']);
  const multi = readPracticeList(JSON.stringify({ sources: [{ name: 'story-1.csv', ids: ['v1', 'v2'] }, { name: 'story-2.csv', ids: ['v2', 'v3'] }] }));
  expect(multi && mergedIds(multi)).toEqual(['v1', 'v2', 'v3']);
  expect(readPracticeList('{"ids":"nope"}')).toBeNull();
});

test('story bundles keep variants (a second story on the same word group) and reject duplicates', () => {
  const st = (n: number, variant?: string) => ({ n, ...(variant ? { variant } : {}), title: `t${n}${variant ?? ''}`, summary_zh: '', words: ['a'], paragraphs: ['**a** x'], glossary: [{ word: 'a', zh: '甲' }] });
  const b = parseStoryBundle(JSON.stringify({ dataset: 'd', stories: [st(1, 'b'), st(1), st(2)] }));
  expect(b.stories.map(storyKey)).toEqual(['1', '1b', '2']);
  expect(storyLabel(b.stories[1])).toBe('Story 1 · B');
  expect(storyPath('d', 1, 'b')).toBe('/d/stories/1/b'); expect(storyPath('d', 1)).toBe('/d/stories/1');
  expect(() => parseStoryBundle(JSON.stringify({ dataset: 'd', stories: [st(1, 'b'), st(1, 'b')] }))).toThrow('1b');
});
