# Vocabulary databases

CSV collections live in `data/<collection>/` (column reference and how to add one: [data/README.md](data/README.md)).
A folder is a collection when it contains a `dataset.json`; the app builds
its collection list from those files at startup, so **adding a folder adds a collection and deleting the folder removes
it everywhere** (checker, dropdown, stories, practice). Nothing in `src/` names a collection. The cross-collection
layers keyed by spelling (`layers/enrichment`, `layers/syllables`) live outside `data/`: they are not collections, and
they apply to any `dictionary` collection whose words they cover.

`dataset.json` for one collection (its id is the folder name; paths are relative to the folder):

```json
{ "order": 3, "label": "13000-vocabulary · 13,000 words", "file": "vocabulary.csv", "kind": "dictionary",
  "notes": "README.md", "stories": "stories", "description": "Shown under “How to use this collection”." }
```

`kind` is one of `dictionary` (gets the enrichment and syllable layers), `vocabulary`, `reading`, `listening`,
`spelling`. A folder holding several CSVs lists them under `"collections": [{ "name", "label", "file", "kind" }, …]`
(ids become `folder/name`); `notes` and `description` at the top level apply to all.
Entries with a missing file, label or kind are skipped with a warning. `scripts/data-index.mjs` writes the resulting
`data/index.json` (generated, git-ignored) during `npm run build`; the dev server and `scripts/serve.py` rebuild it on
every request, so a deleted folder disappears on the next reload. Deleting a collection leaves its ratings in the
browser's storage untouched; `layers/enrichment/merge.py` and `layers/syllables/build.py` read the 13000 CSV by default.

Step-by-step checklists for adding collections, growing the layers and generating stories: [WORKFLOWS.md](WORKFLOWS.md).
AI agents (Claude Code, Codex, Cursor…): read the section [For AI agents](#for-ai-agents--runbooks) at the end, which has
the runbooks in command form.

## Use the vocabulary checker

The checker is a React app (TypeScript, react-router, Tailwind v3, shadcn components, built with rspack) living in
`src/`; the CSV collections and generated data live in `data/`.

```sh
npm install      # first time only
npm run build    # writes dist/
npm start        # python3 scripts/serve.py → http://127.0.0.1:8766/
```

Open **http://127.0.0.1:8766/**. The server serves `dist/` with a history fallback and `data/` as static files, so
deep links work: `/:dataset/w/:word` opens a word (e.g. `/13000-vocabulary/w/criteria`), `/:dataset/root/:root`
lists every word sharing a root (e.g. `/13000-vocabulary/root/scrib`), `/:dataset/stories/:n` opens a story. Rebuild
and restart `npm start` after changing `src/`.

To publish on GitHub Pages: `npm run deploy` (builds for the repository's sub-path, assembles `site/`, pushes the
`gh-pages` branch; details in [WORKFLOWS.md](WORKFLOWS.md) §4).

For development run `npm run dev` (rspack dev server with hot reload on **http://127.0.0.1:8767/**, serving `/data`
from this folder). `npm run check` runs the type check, eslint and the vitest suite (`npm run typecheck`,
`npm run lint`, `npm test` individually).

Card features: a global **Always show meaning** switch (remembered), the meaning area grows to fit, relation chips (look-alikes, same root, family, synonyms, antonyms, variants, compounds, suffix) jump to that word and record a trail, and **Back to …** retraces the chain word by word. Clicking the root line opens the root page.

The app reads the canonical CSV files directly. Serve the project over localhost; opening `dist/index.html` as
`file://` will not allow CSV loading. No external API or internet connection is needed.

1. Choose a collection from the database selector.
2. Judge each entry as **Definitely know**, **Not sure**, or **Don’t know**. Reveal its meaning when needed. The next entry appears automatically; Undo and Unmark let you correct ratings.
3. The status bar stays pinned while scrolling; click a card to filter (Unreviewed, Reviewed, or one rating). Filter by status, category or English/Chinese search; tick **Show the rest** to invert the status filter (Definitely know inverted shows Not sure + Don’t know; Unreviewed and Reviewed swap with each other); browse in source order or alphabetically. For the 8,000-word collection, source order is its original approximate frequency ordering. Other sources retain their original order.
4. The **Export study lists** panel exports one CSV per status, or **To study** for Not sure + Don’t know; each button shows its word count. Status exports cover the whole selected collection regardless of the current search; **Current view** exports only the words in the list below. The **Back up & restore** panel holds **Back up all progress**, which saves every entry with its rating, **Restore from backup CSV**, and **Reset all ratings**, which clears the selected collection after an in-page confirmation (other collections are untouched).
5. Send a To study CSV to your assistant, for example: “Choose 20 words from this CSV and write a natural 600-word English article. Bold the target words, include Chinese definitions, five comprehension questions, and a checklist of the words used.”

Shortcuts: **1** Definitely know, **2** Don’t know, **3** Not sure (matching the button order), **S** or **Space** toggles the meaning, **← / →** browse, **Z** undoes. They are disabled while typing in inputs.

### Progress and moving from the old checker

Progress is stored in this browser, separately by collection and record ID (repeated words in a collection keep independent ratings). Changing browsers, hostnames, or ports changes the browser storage location. The CSV databases themselves are never modified by rating words.

To move progress between browsers or addresses (localhost and 127.0.0.1 are different storage locations): **Back up all progress** on one side, **Restore from backup CSV** on the other. A preview shows how many ratings will change; click **Apply ratings** to finish. Restoring merges: only words listed in the CSV are updated, and nothing changes until the preview is applied.

Export files are named `<collection>-<category>-YYYY-MM-DD_HH-MM-SS.csv` in local time, so repeated exports never overwrite each other. New exports include `dataset`, the original source columns, `word`, `status`, and `reviewed_at`. Imports whose dataset column matches the selected collection use dataset + ID, which disambiguates repeated words. A backup exported from another collection (for example one list restored into a larger one that contains the same words) is matched by word instead, the preview says so, and repeated source rows after the first are skipped. Legacy CSVs without a dataset column also match by word, rejecting ambiguous matches. The `status` column uses `unreviewed`, `definitely_know`, `not_sure` and `dont_know`; the older value `unknown` is still accepted on import and in saved progress, and is written back as `dont_know`. Imports change ratings only after the preview is accepted. Exports use UTF-8 BOM and quoted CSV fields, and prefix formula-like text with an apostrophe for spreadsheet safety.

### My notes and extra words

Every card has a **我的理解 · My note** box under the meaning: your own gloss, mnemonic or example, saved in this
browser per collection (`word-by-word.notes.<collection>.v1`) and shown in the hover cards too. Backups carry a `note`
column, and **Restore from backup CSV** brings notes back with the ratings. The **Extra words · 词表外补充** panel above
the full list records words the collections lack (abbot…) with your gloss; they are shared by every collection
(`word-by-word.extras.v1`), underlined with a dotted line in the stories (hover for the gloss), exported with the
**Extra words** button and merged back by restoring that CSV.

### Enrichment layer (glosses, traps, roots, word groups)

`layers/enrichment/enrichment.json` adds a learner-oriented layer on top of the dictionary collections, keyed by word (so any dictionary collection sharing the words benefits):

- `gloss`: a concise modern Chinese gloss with the most common sense first (leverage → 杠杆；影响力、筹码；借力).
- `trap`: a one-line warning about a common misreading, a look-alike, or a memorable etymology (numerous → 不是“数字的”).
- `root`: the Latin/Greek root with the matching letters, highlighted in blue in the card (tran**scrip**t · scrib = 写).
- relations shown as clickable chips coloured by your rating: look-alikes, same-root words, derivation families, near-synonyms, antonyms, spelling variants, compound parts, and words sharing a suffix.

Exports of a dictionary collection gain `gloss_zh` and `trap` columns. The per-word content was written in batches of 100 words by Claude following `layers/enrichment/PROMPT.md`. For words of a new (or grown) dictionary collection: `python3 layers/enrichment/make_inputs.py` writes `batches/input-NNN.json` for every word the layer does not cover yet, have each annotated into `batches/output-NNN.json` following the prompt, then `python3 layers/enrichment/merge.py` merges all outputs, validates every entry (root match must be a substring, listed words must exist in some dictionary collection) and derives the root groups, compounds, families and spelling variants. To revise a word, edit its batch file and re-run the merge.

### Stories (data/<collection>/stories)

Stories belong to one collection and to one review of it, so they live inside that collection's folder and its
`dataset.json` points at them (`"stories": "stories"`).
A collection without that field still has a Stories tab, which explains and links to the collections that do have
stories; switching collection from the stories tab stays on the stories tab. The app lists them at `/:dataset/stories` and reads one at
`/:dataset/stories/:n`; bold words are coloured by your current rating, hover shows the gloss, clicking opens the
word card (with a trail entry). The stories page shows which review export they came from.

A story only bolds its own target group; any other word you currently rate Not sure / Don’t know gets a dotted underline
in its rating colour with the same hover card (**其他生词** toggle next to the plain-text toggle, remembered in
`word-by-word.story-others.v1`), so a word like *pier* is not missed just because it belongs to another group.

Under a story, the **Glossary** header shows the word count and a **隐藏释义 / 显示释义** toggle (remembered in
`word-by-word.story-gloss.v1`) so you can test yourself on the list first. The **复习练习 · Quiz** section below drills
every story word in one of three modes (看英选中: see the word, pick the meaning; 看中选英: see the meaning, pick the
word; 看中拼写: see the meaning, type the word, Enter submits, case-insensitive), distractors being other words of the
same story, shuffled by default (or in story order); keys A–D or 1–4 answer, Enter / → continues, and the summary lists the missed words with
links to their cards. The **Practice** tab (`/:dataset/practice?s=1,2`) runs the same quiz over the combined glossaries of
any stories you tick (duplicates merged); the story page's quiz links there with that story preselected.
The quiz's summary can export the missed words (答错和不知道的) as a CSV in the study-list format
(`<collection>-story-N-missed-<stamp>.csv`), and the story glossary has a checkbox per word with an **Export** button
(`…-story-N-selected-…`) for the ones that will not stick. **Practice a list** (`/:dataset/practice/list`) imports one
or more such CSVs (or any CSV with a `word` column; rows of the same collection match by id, others by spelling) and
practises their union: yesterday's story-1 misses plus today's story-2 misses, each file removable on its own. It shows
the checker's word list and card for just those words (ratings work as usual and move within the list) and runs the
quiz below; the files are remembered per collection in this browser (`word-by-word.practice-list.<collection>.v1`)
until you remove them.

`data/13000-vocabulary/stories`: seventy short stories teach the 6,594 words rated Not sure / Don’t know in the
2026-09-23 review (`13000-vocabulary-all-2026-09-23_15-48-33.csv`): each story covers 60–110 words grouped by
synonym / antonym / root relations, uses every target word two or three times in bold, and ends with a Chinese glossary.

Generating stories for a collection (a first review, a later review of the same collection, or a new collection):
the tooling lives in `scripts/stories/` and takes the collection id.

1. Export **Back up all progress** (or **To study**) from the collection.
2. `python3 scripts/stories/make_inputs.py <export.csv>` clusters the Not sure / Don’t know words by the enrichment
   relations and writes `data/<collection>/stories/batches/input-NNN.json` (targets + glosses) and `batches/meta.json`
   (source files, counts, dates). For a later review add `--append`: only words no existing batch covers get new
   batches, numbering continues and earlier stories stay as they are. `--force` starts over (only before any story is
   written). (The original 13000 batches were packed by an earlier version and tidied by hand; the current packing
   gives the same 70 batches of 60–111 words.)
3. `python3 scripts/prompt.py story <collection> <n>` prints the full prompt (`STORY_PROMPT.md` + the input);
   paste it into any assistant and save the reply as `batches/output-<n>.json`.
4. `python3 scripts/stories/validate.py <collection> --strict` checks every target is bolded at least twice, the
   glossary is complete and nothing else is bolded, then writes `story-NNN.json`, `index.json` (with `meta.json`
   copied in as `source`) and `bundle.json`. To revise a story, edit its batch output and re-run the validator.
5. Add `"stories": "stories"` to the collection's `dataset.json` (once).
6. A second story on the same word group: `python3 scripts/prompt.py story <collection> <n> --variant b` (the prompt
   quotes the first story and asks for a different setting) → `batches/output-<n>-b.json` → validate. It becomes
   `story-<n>-b.json`, route `/:dataset/stories/<n>/b`; the story page shows an A · B switcher, the list card lists
   both, and practice counts the group once. `-c`, `-d` … work the same way.

Stories are private (they encode one person's ratings), so `data/*/stories/` is git-ignored. To use them on a published
copy of the app, or in another browser, import them instead: `validate.py` also writes `stories/bundle.json` (every story
in one file, ~1.5 MB for 70 stories); on the Stories page, **Import stories bundle** stores it in that browser's
IndexedDB for the current collection, and it then serves the stories, practice and quizzes exactly as the folder would
(an imported bundle takes precedence over the folder; **Remove imported** deletes it). Like ratings, it lives in one
browser at one address only.

Phrasal verbs are bolded whole (`**hemmed in**`, `**tapered off**`). After new stories: `python3 scripts/stories/phrasal.py
<collection> scan` lists every bold verb followed by a particle (`stories/phrasal/candidates.json`) and writes the doubtful
ones to `phrasal/input-NNN.json`; `scripts/prompt.py phrasal <collection> <n>` prints the review prompt
(`PHRASAL_REVIEW_PROMPT.md`), the reply `{id: true|false}` goes to `phrasal/output-NNN.json`; then
`phrasal.py <collection> apply` extends the bold in the batch outputs and `validate.py` rebuilds. The validator and
the app match a multi-word bold span by its first word.

### Syllable divisions (layers/syllables)

`layers/syllables/syllables.json` maps every word of every dictionary collection (`build.py` reads them all by default, so a new collection is covered by re-running it) to its dictionary-style syllable division
(`maverick` → `mav·er·ick`), shown next to the IPA on the card and in the story hover card. `build.py` takes the
divisions from the public-domain Moby Hyphenator II (Project Gutenberg #3204, `mhyph.txt`, 187,000 words), falls back
to pyphen's en_US patterns for words Moby lacks, and checks every division against the syllable count of the CMU
Pronouncing Dictionary (or the CSV's own IPA). The 341 disagreements were reviewed by Claude in four batches following
`REVIEW_PROMPT.md` (`batches/output-*.json`, made from `review.json` by `make_inputs.py`); `merge.py` validates them into
`fixes.json`, which always wins. Neither source file is stored here: download Moby (Project Gutenberg #3204,
https://www.gutenberg.org/ebooks/3204) and the CMU dictionary (https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict)
into `layers/syllables/` (git-ignored) and follow [WORKFLOWS.md](WORKFLOWS.md) §2 (needs `pip install pyphen`).

### Layout and checks

- `src/`: the app. `pages/` (checker, word, root, stories), `components/` (card, lists, panels, shadcn `ui/`),
  `state/store.ts` (ratings, notes, extras, trail; localStorage), `lib/` (CSV, datasets registry, ratings, transfer,
  stories, enrichment, notes). `lib/datasets.ts` holds the registry filled from `data/index.json`.
- `data/`: one folder per collection (`dataset.json`, CSV, README, manifest, optional `stories/`); `scripts/data-index.mjs`
  turns the `dataset.json` files into the `data/index.json` the app loads.
- `layers/`: the shared `enrichment/` and `syllables/` layers with their build scripts and Claude batch prompts.
- `scripts/serve.py`: localhost-only server for `dist/` + `data/` + `layers/`; `scripts/stories/`: story generation
  tooling (`make_inputs.py`, `validate.py`, `phrasal.py`, the two prompts; `scripts/prompt.py` prints any batch's prompt). Data folders hold data only, and how a
  list was made is not part of this project: `data/README.md` documents `dataset.json` and the CSV columns, and each
  collection's README states its source and terms.
- Config at the root: `rspack.config.mjs`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`,
  `eslint.config.mjs`, `vitest.config.ts`, `components.json` (shadcn).
- `npm test` (vitest, `src/**/*.test.ts`): CSV parsing, all eight collections loading with their expected counts,
  rating filters and legacy-status migration, export/import round trips, enrichment relation rows, notes and extra
  words. The earlier single-file checker (`vocabulary-check.html`, `assets/`) and its node tests were removed when the
  app moved to the project root.

## Sample collection: 13000-vocabulary

[vocabulary.csv](data/13000-vocabulary/vocabulary.csv): 13,000 words selected from [ECDICT](https://github.com/skywind3000/ECDICT) (MIT license) for IELTS study, in frequency order, with a `selection` column (IELTS-tagged, common supplement, extension, academic) and a `wordlists` column marking Academic Word List / New Academic Word List membership. See its [README](data/13000-vocabulary/README.md) and [manifest](data/13000-vocabulary/manifest.json). It is a study selection, not an official IELTS list. Bring your own collections the same way: [data/README.md](data/README.md).

## For AI agents · Runbooks

Read this first; the human-facing details are in [README.md](README.md), [WORKFLOWS.md](WORKFLOWS.md) (step-by-step
checklists) and [data/README.md](data/README.md) (collection folders and CSV columns).

### What this is
A local React + rspack app for rating vocabulary words (Definitely know / Not sure / Don’t know), reading generated
stories that teach the unknown words, and quizzing. Ratings, notes and extra words live in the browser only. Stories
are generated per collection from a ratings export and are private: `data/*/stories/` is git-ignored.

### Layout
- `src/` app (TypeScript strict, imports name real `.ts/.tsx` extensions, no `any`). `src/lib/datasets.ts` is a
  registry filled at runtime from `data/index.json`; nothing in `src/` names a collection.
- `data/<collection>/` = `dataset.json` + CSV (+ README, manifest, optional git-ignored `stories/`). Adding or deleting
  a folder adds or removes the collection. `scripts/data-index.mjs` builds `data/index.json` (run by `npm run build`;
  the dev server and `scripts/serve.py` rebuild it per request).
- `layers/enrichment/`, `layers/syllables/`: cross-collection word layers keyed by spelling (glosses, roots, relations;
  syllable divisions). Build scripts inside each; `layers/layerlib.py` finds every dictionary collection.
- `scripts/stories/`: story tooling (`make_inputs.py`, `validate.py`, `phrasal.py`, `common.py`, the two prompts).
  `scripts/prompt.py` prints the complete prompt for any batch. `scripts/site.mjs` / `scripts/deploy-pages.mjs`
  build and publish a static site (GitHub Pages, sub-path aware via `BASE_PATH`).

### Commands
`npm run dev` (127.0.0.1:8767) · `npm run build` · `npm start` (built app, 8766) · `npm run check` (tsc + eslint +
vitest) · `npm run site` / `npm run deploy`. Python scripts need Python 3.9+ (no `X | None` annotations without
`from __future__ import annotations`).

### Batches: the one pattern everywhere
A script writes `input-NNN.json`; an assistant produces `output-NNN.json` for it; a merge/validate script checks and
applies. Numbers are assigned once and never reused. `python3 scripts/prompt.py <kind> … <n>` prints prompt + input +
the exact output path for `enrichment`, `syllables`, `story <collection> <n> [--variant b]`, `phrasal <collection> <n>`.

### Runbook: a new round of stories after the ratings changed
Trigger: the user exported ratings (Back up all progress → `<export>.csv`) and wants fresh stories for the words
still unknown. No reset or re-import of ratings is needed; the CSV is only a snapshot for the script.
1. `python3 scripts/stories/make_inputs.py <export>.csv --round` → new batches `data/<collection>/stories/batches/input-NNN.json`
   (numbering continues), `meta.json` gets `round`, source name, date, SHA-256. Use `--append` instead when the user
   only wants stories for newly-unknown words within the same round; never `--force` once stories exist.
2. For each new batch (run several cheap agents in parallel, one batch each): `python3 scripts/prompt.py story <collection> <n>`
   → write the JSON reply to the printed output path → `python3 scripts/stories/validate.py <collection>` and fix any
   PROBLEM line for that file (every target bolded ≥ 2×, glossary complete, nothing else bold). Stories for 95-word
   groups legitimately run 2,000–3,500 words.
3. Optional phrasal-verb pass: `python3 scripts/stories/phrasal.py <collection> scan` → review batches via
   `scripts/prompt.py phrasal <collection> <n>` → `phrasal.py <collection> apply` → validate again.
4. `python3 scripts/stories/validate.py <collection> --strict` must end with `problems: 0`. It also writes
   `stories/bundle.json`; tell the user to re-import it on the Stories page if they read stories from an imported bundle
   (published site / another browser), and to refresh the backup copies they keep outside the repo.
5. A second story on an existing group: `scripts/prompt.py story <collection> <n> --variant b` → `output-NNN-b.json`.

### Runbook: a new or updated collection
Put the CSV and `dataset.json` in `data/<id>/` (see data/README.md), reload. Then grow the layers for uncovered words:
`python3 layers/enrichment/make_inputs.py` → batches via `scripts/prompt.py enrichment <n>` → `python3 layers/enrichment/merge.py --strict`;
`python3 layers/syllables/build.py --moby layers/syllables/mhyph.txt --cmu layers/syllables/cmudict.dict` →
`python3 layers/syllables/make_inputs.py` → `scripts/prompt.py syllables <n>` → `python3 layers/syllables/merge.py …`.

### Rules the user has set
- Never commit, push or configure git identity on their behalf; never use accounts or credentials found on the machine.
- Keep batch-generation agents cheap (sonnet) and stop launching when the user says 暂停; resume on 继续.
- Stories and ratings are private; do not move them into the repository or the published site.
- Verify in the browser after UI changes (dev server on 8767) and run `npm run check` before reporting done.
