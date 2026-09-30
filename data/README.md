# data/ — collections

Every folder here that contains a `dataset.json` is a collection the app offers in its dropdown. Nothing in the app's
source names a collection: add a folder and it appears, delete the folder and it is gone (checker, stories, practice).
Folders without `dataset.json` are ignored. The cross-collection layers (`../layers/enrichment`, `../layers/syllables`)
are keyed by spelling and apply to every collection of kind `dictionary`, so a new word list gets glosses, roots,
relations and syllable divisions for every word it shares with them.

Every collection folder has the same shape and holds data only; build tooling lives under `scripts/`:

```
data/
  13000-vocabulary/        one collection
    dataset.json           how the app shows it (below)                        required
    vocabulary.csv         the words (below)                                    required
    README.md              where the list comes from, how it was selected,      recommended; linked from the app via `notes`
                           usage terms
    manifest.json          row count and checksums; `selected` is checked       recommended
                           by `npm test`
    ECDICT-LICENSE.txt     the source's licence text, when it requires one      as needed
    stories/               generated stories, git-ignored (scripts/stories/,    optional
                           or import bundle.json in the app)
  my-lists/                one folder, several CSVs = several collections (see below)
```

How a list was produced does not matter to the app and is not part of this repository: bring your own CSV in this
shape. The bundled `13000-vocabulary` folder is a sample collection; its README describes the source and selection
rules in prose.

## dataset.json

One collection per folder (its id is the folder name; paths are relative to the folder):

```json
{
  "order": 3,
  "label": "13000-vocabulary · 13,000 words",
  "file": "vocabulary.csv",
  "kind": "dictionary",
  "notes": "README.md",
  "stories": "stories",
  "description": "One or two sentences shown under “How to use this collection”."
}
```

| field | required | meaning |
| --- | --- | --- |
| `label` | yes | Text in the collection dropdown; the part before ` · ` is used as the short name. |
| `file` | yes | The CSV, relative to the folder. |
| `kind` | yes | `dictionary` (gets the enrichment and syllable layers, category filter, relation chips), `vocabulary`, `reading`, `listening` (plain word lists with the columns below), or `spelling` (British/American pairs). |
| `order` | no | Sort key in the dropdown; the first collection is the default landing page. Missing = after the numbered ones, by folder name. |
| `notes` | no | A Markdown/text file linked as “Source, selection method and usage terms”. |
| `description` | no | Shown in the “How to use this collection” panel. |
| `stories` | no | Folder with `index.json` + `story-NNN.json` (see `scripts/stories/`). Only listed when the index exists. |

Several CSVs in one folder: put the shared fields at the top level and list the collections; ids become
`<folder>/<name>`:

```json
{ "order": 4, "notes": "README.md", "description": "…",
  "collections": [
    { "name": "vocabulary", "label": "my-lists · Main vocabulary", "file": "vocabulary.csv", "kind": "vocabulary" },
    { "name": "spelling",   "label": "my-lists · British / American spelling", "file": "spelling.csv", "kind": "spelling" }
  ] }
```

Entries whose file is missing or whose label/kind is invalid are skipped with a warning by `scripts/data-index.mjs`
(run by `npm run build`; the dev server and `scripts/serve.py` rebuild the index on every request).

## The CSV

UTF-8 (a BOM is fine), RFC 4180 quoting (quote fields that contain commas, quotes or line breaks; double the quotes),
one header row, no duplicate or empty column names. Row order is the “source order” of the checker; for a dictionary
list put the most frequent words first.

Required columns:

| column | meaning |
| --- | --- |
| `id` | Unique, non-empty, stable across rebuilds: ratings, notes and backups are keyed by it (`v00001`, `1`, …). |
| `word` | The headword. For `kind: spelling` the columns are `british` and `american` instead, and `british` is the word. |

Recognised optional columns (anything else is kept and included in exports, but not shown):

| column | shown as |
| --- | --- |
| `meaning_zh` | The Chinese meaning (main text of the revealed card; also searched). `meanings_zh_json` (a JSON array of strings) is accepted instead. |
| `phonetic` | IPA next to the word (the syllable division comes from the layer, not the CSV). |
| `part_of_speech` | First item of the grey context line. `part_of_speech_json` (JSON array) is accepted instead. |
| `definition_en` | English definition, under a “Show English definition” toggle. |
| `selection` | Category used by the “All categories” filter (`ielts_tag`, `common_supplement`, `extension`, `academic` get friendly labels; other values are shown as-is). `category` or `chapter` are used when `selection` is absent. |
| `wordlists` | e.g. `AWL`, `NAWL`, `AWL NAWL`; shown as “Academic lists: …”. |
| `variants_json` | JSON array of inflected forms, shown as “Forms: …”. |
| `example`, `notes`, `replacements_json` | Shown under the definition (`notes` of `-` is ignored). |
| `american` | For spelling lists; shown as “American: …”. |
| `status`, `reviewed_at`, `dataset` | Ignored on load and overwritten on export: ratings live in the browser, not in the CSV. |

Minimal example:

```csv
id,word,phonetic,part_of_speech,meaning_zh,definition_en,selection
w0001,maverick,ˈmævərɪk,n,特立独行的人；不合群者,an unorthodox or independent-minded person,core
w0002,prudent,ˈpruːdnt,adj,谨慎的；精明的,acting with or showing care and thought for the future,core
```

## Exports and backups

Every export (`To study`, per-status lists, `Back up all progress`, missed words, ticked glossary words) is a CSV
with the columns `dataset`, the CSV's own columns (`gloss_zh` and `trap` added for dictionary collections), then
`word`, `status`, `reviewed_at`, `note`. `status` is `unreviewed`, `definitely_know`, `not_sure` or `dont_know`.
**Restore from backup CSV** matches rows by `dataset` + `id` when the dataset matches, otherwise by spelling, so a
backup can move between two collections that share words. **Practice a list** accepts any CSV with a `word` column.

## Adding a collection, step by step

(The full checklists, including layers and stories, are in [WORKFLOWS.md](../WORKFLOWS.md).)

1. Create `data/<id>/`, put the CSV there, write `dataset.json` (above). Reload the dev server page or run
   `npm run build`; the collection is in the dropdown.
2. `npm test` loads every collection and fails on duplicate ids or malformed CSV.
3. Optional layers (dictionary kind): words already covered by `layers/enrichment/enrichment.json` and
   `layers/syllables/syllables.json` show their glosses, traps, roots, relation chips and syllables at once. To cover the
   rest: `python3 layers/enrichment/make_inputs.py` (writes input batches for the uncovered words of every dictionary
   collection) → annotate each following `layers/enrichment/PROMPT.md` → `python3 layers/enrichment/merge.py`; and
   `python3 layers/syllables/build.py --moby mhyph.txt --cmu cmudict.dict` (all dictionary collections by default).
4. Optional stories: rate the words, export **To study**, then `python3 scripts/stories/make_inputs.py <export.csv>`
   (`--append` for a later review), `scripts/prompt.py story <id> <n>` for each batch, `python3 scripts/stories/validate.py <id>`,
   and add `"stories": "stories"` to `dataset.json`. Stories are git-ignored; keep `stories/bundle.json` and import
   it on the Stories page in any browser. See the README's Stories section for the phrasal-verb pass.

## Licences

Each collection keeps its own upstream terms in its README (the sample derives from ECDICT, MIT). Check the terms of
any source you import before publishing a collection built from it.
