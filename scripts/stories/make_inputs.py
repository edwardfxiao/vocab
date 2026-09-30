#!/usr/bin/env python3
"""Turn a review export into story batches: the words rated Not sure / Don't know, clustered by relation.

Usage: python3 scripts/stories/make_inputs.py <review-export.csv> [--collection <id>] [--append | --round | --force]

The CSV is a "Back up all progress" / "To study" export (it needs word, status, meaning_zh and part_of_speech columns).
The collection is read from its dataset column (or --collection). Study words are linked when the enrichment layer
lists them as synonyms, antonyms, confusables or words of the same root; connected words are gathered (breadth-first,
in the CSV's frequency order) into clusters of at most CAP words, and clusters are packed in order into batches of
about CAP words (never below MIN or above MAX, so no story gets a handful of words). Writes
data/<collection>/stories/batches/input-NNN.json ({word, zh, pos} per target) and batches/meta.json (source file,
counts, date, round). When batches already exist:
  --append  adds batches only for the study words no existing batch covers (same round; numbering continues).
  --round   starts the next round: every word still rated Not sure / Don’t know is regrouped into fresh batches
            (numbering continues, earlier rounds stay readable). Do this when the remaining study words have shrunk
            a lot and the old groups are mostly learned.
  --force   throws every batch away and renumbers (only before any story has been written).
Without one of these the script refuses.

Then: Claude writes batches/output-NNN.json for each input following scripts/stories/STORY_PROMPT.md, and
scripts/stories/validate.py <collection> builds the story-NNN.json, index.json and bundle.json the app reads.
"""
import collections, csv, datetime, hashlib, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ENRICHMENT, flag, opt, stories_dir  # noqa: E402

CAP = 95            # target words per story
MIN, MAX = 60, 115  # a batch below MIN is merged with its neighbour when that stays within MAX

argv = sys.argv[1:]
positional = [a for a in argv if not a.startswith('--') and a != opt(argv, '--collection')]
if len(positional) != 1:
    raise SystemExit(__doc__)
source = Path(positional[0])
force = flag(argv, '--force'); append = flag(argv, '--append'); new_round = flag(argv, '--round')

rows = list(csv.DictReader(source.open(encoding='utf-8-sig')))
for col in ('word', 'status', 'meaning_zh', 'part_of_speech'):
    if rows and col not in rows[0]:
        raise SystemExit(f'{source.name} has no {col} column; use a full export of the collection.')
collection = opt(argv, '--collection') or (rows[0].get('dataset', '') if rows else '')
if not collection:
    raise SystemExit('The CSV has no dataset column; pass --collection <id>.')
if rows and rows[0].get('dataset') and rows[0]['dataset'] != collection:
    raise SystemExit(f'{source.name} was exported from {rows[0]["dataset"]}, not {collection}.')
BATCHES = stories_dir(collection) / 'batches'
existing = sorted(BATCHES.glob('input-*.json'))
if existing and not (force or append or new_round):
    raise SystemExit(f'{BATCHES} already holds {len(existing)} input batches. Use --append (new words only), --round (regroup everything still unknown into the next round) or --force (start over, renumbers everything).')
covered_all = {x['word'] for p in existing for x in json.loads(p.read_text(encoding='utf-8'))}
covered = covered_all if append else set()

study = [r['word'] for r in rows if r['status'] in ('not_sure', 'dont_know') and r['word'] not in covered]
S = set(study)
if new_round: print(f'study words {len(study)} still unknown; {sum(1 for w in study if w in covered_all)} of them already had a story in an earlier round')
else: print('study words', len(study), f'(not covered by the {len(existing)} existing batches)' if append else '')
if not study:
    raise SystemExit('Nothing to do: every Not sure / Don’t know word already has a story.' if append else 'No words rated Not sure / Don’t know in this export.')

E = json.loads(ENRICHMENT.read_text(encoding='utf-8')) if ENRICHMENT.is_file() else {'words': {}, 'roots': {}}
W = E['words']
adj: dict[str, set[str]] = collections.defaultdict(set)
def link(a: str, b: str) -> None:
    if a in S and b in S and a != b:
        adj[a].add(b); adj[b].add(a)
for w in study:
    for k in ('synonyms', 'antonyms', 'confusable'):
        for x in E.get(k, {}).get(w, []):
            link(w, x)
for g in E.get('roots', {}).values():
    ws = [x for x in g['words'] if x in S]
    for i in range(len(ws)):
        for j in range(i + 1, len(ws)):
            link(ws[i], ws[j])

seen: set[str] = set(); clusters: list[list[str]] = []
for w in study:                             # CSV order = frequency order
    if w in seen: continue
    cl = [w]; seen.add(w); q = [w]
    while q and len(cl) < CAP:
        x = q.pop(0)
        for y in sorted(adj[x]):
            if y not in seen and len(cl) < CAP:
                seen.add(y); cl.append(y); q.append(y)
    clusters.append(cl)
print('clusters', len(clusters), '| multi-word:', sum(1 for c in clusters if len(c) > 1), '| singletons:', sum(1 for c in clusters if len(c) == 1))

batches: list[list[str]] = []; cur: list[str] = []
for cl in clusters:
    if len(cur) + len(cl) <= CAP or not cur:
        cur.extend(cl)
    elif len(cur) < MIN and len(cur) + len(cl) <= MAX:
        cur.extend(cl); batches.append(cur); cur = []
    else:
        batches.append(cur); cur = list(cl)
if cur:
    if len(cur) < MIN and batches and len(batches[-1]) + len(cur) <= MAX: batches[-1].extend(cur)
    else: batches.append(cur)
print('batches', len(batches), '| sizes', min(map(len, batches)), '-', max(map(len, batches)))

BATCHES.mkdir(exist_ok=True)
if force:
    for old in existing: old.unlink()      # --force: drop stale numbering
start = (max(int(p.stem.split('-')[1]) for p in existing) if (append or new_round) and existing else 0) + 1
gl = {r['word']: r for r in rows}
for i, b in enumerate(batches, start):
    items = [{'word': w, 'zh': (W.get(w, {}).get('gloss') or gl[w]['meaning_zh'].split('\n')[0])[:40], 'pos': gl[w]['part_of_speech']} for w in b]
    (BATCHES / f'input-{i:03}.json').write_text(json.dumps(items, ensure_ascii=False, indent=0), encoding='utf-8')
meta_file = BATCHES / 'meta.json'
prev = json.loads(meta_file.read_text(encoding='utf-8')) if (append or new_round) and meta_file.is_file() else {}
round_no = (int(prev.get('round', 1)) + 1) if new_round else int(prev.get('round', 1))
sha = hashlib.sha256(source.read_bytes()).hexdigest()
run = {'round': round_no, 'source': source.name, 'source_sha256': sha, 'generated': datetime.date.today().isoformat(), 'study_words': len(study), 'batches': f'{start:03d}-{start + len(batches) - 1:03d}'}
prev_runs = prev.get('runs') or ([{'round': 1, **{k: prev[k] for k in ('source', 'generated', 'study_words') if k in prev}, 'batches': f'001-{len(existing):03d}'}] if prev else [])
meta = {'round': round_no, 'source': source.name, 'source_sha256': sha, 'dataset': collection, 'study_words': len(study) if new_round else prev.get('study_words', 0) + len(study),
        'batches': len(existing) + len(batches) if (append or new_round) else len(batches), 'generated': run['generated'], 'runs': [*prev_runs, run]}
meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'round {round_no}: wrote input-{start:03d} … input-{start + len(batches) - 1:03d} and meta.json to {BATCHES}')
print(f'next: write batches/output-NNN.json for each (python3 scripts/prompt.py story {collection} {start} prints the prompt), then validate.py {collection}')
