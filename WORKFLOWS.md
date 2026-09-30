# Workflows · 操作手册

Three things you do repeatedly, each as a checklist. Commands run from the project root. `<id>` is a collection's
folder name under `data/` (for example `13000-vocabulary`).

## 0. Prerequisites · 准备

| need | for | check |
| --- | --- | --- |
| Node.js 18+ | the app, `npm` scripts | `node --version` |
| Python 3.9+ | every script under `scripts/` and `layers/` | `python3 --version` |
| `pip install pyphen` | syllables only | `python3 -c "import pyphen"` |
| Moby Hyphenator II `mhyph.txt` | syllables only, once | from Project Gutenberg #3204: https://www.gutenberg.org/ebooks/3204 (inside the zip); save as `layers/syllables/mhyph.txt` |
| CMU dictionary `cmudict.dict` | syllables only, once | https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict → `layers/syllables/cmudict.dict` |
| an assistant (Claude, ChatGPT…) | writing enrichment, syllable reviews, stories, phrasal reviews | `python3 scripts/prompt.py …` prints what to paste |

The two dictionary files are git-ignored. `npm install` once; `npm run dev` (http://127.0.0.1:8767) while working,
`npm run build` + `npm start` (http://127.0.0.1:8766) for the built app. `npm run check` = types + lint + tests.

Batches everywhere follow one pattern: a script writes `input-NNN.json`, you get `output-NNN.json` from the assistant
(`scripts/prompt.py` prints the prompt and the exact output path), a merge/validate script checks and applies it.
Batches are numbered once and never renumbered, so work can stop and resume at any point.

## 1. Add or update a collection · 新增 / 更新词表

Add:
1. Make `data/<id>/` with the CSV (`id` + `word` columns required; the others are listed in [data/README.md](data/README.md)).
2. Write `data/<id>/dataset.json`:
   ```json
   { "order": 5, "label": "<id> · 30,000 words", "file": "vocabulary.csv", "kind": "dictionary", "notes": "README.md",
     "description": "One sentence for the “How to use this collection” panel." }
   ```
3. Reload the dev-server page (or `npm run build`): the collection is in the dropdown. `npm test` fails on duplicate
   ids or a malformed CSV.
4. Optional: `README.md` (source, licence) and `manifest.json` with `"selected": <row count>` so `npm test` checks it.
5. If the collection is a dictionary list, continue with step 2 (layers); words the layers already cover show their
   glosses, roots, chips and syllables immediately, the rest show the CSV's own meaning.

Update (rows added, glosses corrected):
1. Replace the CSV. Keep every existing `id`: ratings, notes and backups are keyed by it. New rows get new ids.
2. Reload / rebuild; `npm test`. Then step 2 for the new words.

Remove: delete the folder. Nothing else references it (a stale `data/index.json` is rewritten by the next
`npm run build` or `npm run data:index`).

## 2. Grow the layers for new words · 增量更新 enrichment 和 syllables

Both layers are keyed by spelling and cover every `dictionary` collection at once; only uncovered words need work.

Enrichment (glosses, traps, roots, relations):
1. `python3 layers/enrichment/make_inputs.py` → prints how many words lack enrichment and writes
   `layers/enrichment/batches/input-NNN.json` (100 words each, numbering continues). Nothing to do = 0 words.
2. For each new batch: `python3 scripts/prompt.py enrichment <n>` → paste into the assistant → save the reply as
   `layers/enrichment/batches/output-<n>.json`. Do as many as you like per session.
3. `python3 layers/enrichment/merge.py --strict` → merges every finished batch into `enrichment.json`, reports missing
   words, bad roots, unknown words. Unfinished batches simply stay uncovered.
4. Reload the app. To fix a word later, edit its `output-NNN.json` and run merge again.

Syllables:
1. `python3 layers/syllables/build.py --moby layers/syllables/mhyph.txt --cmu layers/syllables/cmudict.dict` →
   rewrites `syllables.json` for every dictionary word and lists disagreements in `review.json` (typically 2–3 %).
2. `python3 layers/syllables/make_inputs.py` → review batches `layers/syllables/batches/input-NNN.json`.
3. For each: `python3 scripts/prompt.py syllables <n>` → assistant → `layers/syllables/batches/output-<n>.json`.
4. `python3 layers/syllables/merge.py --moby layers/syllables/mhyph.txt --cmu layers/syllables/cmudict.dict` →
   validates the answers into `fixes.json` (which always wins) and rebuilds `syllables.json`.

## 3. Add or extend stories · 新增 / 追加故事

Stories belong to one collection and one review of it; they are git-ignored (`data/*/stories/`).

First stories for a collection:
1. Rate words in the app, then **Back up all progress** (or **To study**) → a CSV.
2. `python3 scripts/stories/make_inputs.py <that.csv>` → `data/<id>/stories/batches/input-NNN.json` (≈95 Not sure /
   Don’t know words per story, grouped by relations) + `meta.json`. The collection is read from the CSV's `dataset`
   column (`--collection <id>` to override).
3. For each batch: `python3 scripts/prompt.py story <id> <n>` → assistant → `data/<id>/stories/batches/output-<n>.json`.
4. `python3 scripts/stories/validate.py <id> --strict` → checks the stories and writes `story-NNN.json`, `index.json`
   and `bundle.json`. Fix problems in the batch output and run it again.
5. Add `"stories": "stories"` to `data/<id>/dataset.json` (once). Reload: Stories, Practice and quizzes are live.
6. Phrasal verbs (optional, makes `**hemmed in**` one unit): `python3 scripts/stories/phrasal.py <id> scan` →
   `python3 scripts/prompt.py phrasal <id> <n>` for each review batch → `data/<id>/stories/phrasal/output-<n>.json` →
   `python3 scripts/stories/phrasal.py <id> apply` → `validate.py <id> --strict` again.

More stories after a later review (same collection):
1. Export again. `python3 scripts/stories/make_inputs.py <new.csv> --append` → batches only for the words no existing
   story covers; numbering continues (071, 072 …), earlier stories untouched. “Nothing to do” means every current
   Not sure / Don’t know word already has a story.
2. Steps 3, 4 and 6 above for the new batches only (`phrasal.py scan` skips stories scanned before).

A second story on the same words (when one story was not enough to make a group stick):
1. `python3 scripts/prompt.py story <id> <n> --variant b` → the same word group, with the first story's title and
   summary quoted and an instruction to use a completely different setting and plot → save as
   `data/<id>/stories/batches/output-<n>-b.json` (`-c`, `-d` … for more).
2. `validate.py <id> --strict` → `story-<n>-b.json`; the story opens at `/stories/<n>/b`, the story page shows an A · B
   switcher and the list card shows both. Practice treats the group once (same words). `phrasal.py scan` picks the new
   story up like any other.

A new round, when most of the old groups are learned (say the unknown words fell from 6,600 to 3,000). Ratings stay
in the browser: no reset, no re-import; the export is only a snapshot for the script.
1. Export the current ratings (Back up all progress → e.g. `123.csv`). `python3 scripts/stories/make_inputs.py <now.csv> --round` → every word still
   Not sure / Don’t know is regrouped into fresh batches; numbering continues (071 …), `meta.json` gets `round: 2`
   with the export's name, date and SHA-256. The script prints how many of those words already had a story.
2. Steps 3, 4 and 6 of “first stories” for the new batches. The Stories and Practice pages show the latest round open
   and earlier rounds folded (still readable); quizzes and colours always follow current ratings, so a new round is
   about reading efficiency, never about correctness. Rounds are never deleted; `--force` would be.

A new collection: same as “first stories”, with its own export (the `dataset` column routes it to its own folder).

Keeping and moving stories: `data/<id>/stories/bundle.json` (written by `validate.py`) holds every story; on the
Stories or Practice page, **Import stories bundle** loads it into that browser (IndexedDB), also on a published copy of
the app where the folder does not exist. **Remove bundle** deletes it. Keep a copy of `bundle.json` and of the whole
`stories/` folder (the batches are needed to revise or extend) somewhere safe.

## 4. Publish to GitHub Pages · 发布

Ratings, notes and extra words live in the browser; stories are git-ignored (import `bundle.json` on the published
site); everything else is shareable (check each collection's licence).

Once: create an empty repository on GitHub (public; Pages is free only for public repositories), then in this folder
set an identity and a remote **for this repository only** (nothing global, nothing from the machine's other accounts):
```sh
git config user.name "<GitHub user>"
git config user.email "<id>+<GitHub user>@users.noreply.github.com"   # shown on the account's email settings page
git config credential.helper ""        # do not save the token in the OS keychain; git asks each time
git remote add origin https://github.com/<user>/<repo>.git
git add -A && git commit -m "Initial import"
git push -u origin main                # username = <GitHub user>, password = a fine-grained personal access token
```
The token: GitHub → Settings → Developer settings → Fine-grained tokens → repository `<repo>`, permission
Contents: Read and write. (SSH works too: a key added to that account and `git@github.com:<user>/<repo>.git`.)
If the remote `main` already has unrelated commits, `git push --force -u origin main` replaces them.
Every time you want to publish:
```sh
npm run deploy
```
It builds with the right base path (`/<repo>/`, or `/` when the repository is `<user>.github.io`), assembles
`site/` = `dist/` + `data/` + `layers/` (without stories, batches and scripts) + `404.html` + `.nojekyll`, commits it to
the `gh-pages` branch and pushes (asking for the token again if git does not cache it; an existing `gh-pages` branch is
updated, not replaced). Then, once, on GitHub: Settings → Pages → Source “Deploy from a branch”, branch
`gh-pages`, folder `/ (root)`. The site is `https://<user>.github.io/<repo>/`. `npm run site` only assembles `site/`
for any other static host (pass the base path: `node scripts/site.mjs /sub/path/`).
