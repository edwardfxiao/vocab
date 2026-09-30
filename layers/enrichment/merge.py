"""Merge batches/output-*.json into enrichment.json and validate against the words of every dictionary collection.
Usage: python3 layers/enrichment/merge.py [--strict]"""
import json, sys, re
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from layerlib import dictionary_rows  # noqa: E402
rows = dictionary_rows()
words = [r['word'] for r in rows]; wordset = set(words)
inputs = {p.stem.split('-')[1]: {x['word'] for x in json.loads(p.read_text(encoding='utf-8'))} for p in sorted(HERE.glob('batches/input-*.json'))}
merged, problems, done = {}, [], set()
for p in sorted(HERE.glob('batches/output-*.json')):
    n = p.stem.split('-')[1]
    try: data = json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: problems.append(f'{p.name}: invalid JSON ({e})'); continue
    if not isinstance(data, dict): problems.append(f'{p.name}: not an object'); continue
    expected = inputs.get(n, set())
    missing = expected - set(data); extra = set(data) - expected
    if missing: problems.append(f'{p.name}: missing {len(missing)} words e.g. {sorted(missing)[:5]}')
    if extra: problems.append(f'{p.name}: {len(extra)} unexpected keys e.g. {sorted(extra)[:5]}')
    for w, e in data.items():
        if w not in wordset or not isinstance(e, dict): continue
        gloss = str(e.get('gloss', '')).strip()
        if not gloss: problems.append(f'{p.name}: {w} has empty gloss')
        root = e.get('root') or None
        if root:
            m = str(root.get('match', '')).lower()
            if not m or m not in w.lower(): problems.append(f'{p.name}: {w} root match "{m}" not a substring'); root = None
            else: root = {'key': str(root.get('key', '')).strip().lower(), 'meaning': str(root.get('meaning', '')).strip(), 'match': m}
        lists = {k: [x.strip().lower() for x in (e.get(k) or []) if isinstance(x, str)] for k in ('confusable', 'synonyms', 'antonyms')}
        merged[w] = {'gloss': gloss, 'trap': str(e.get('trap', '') or '').strip(), 'root': root, **lists}
        done.add(n)

# derived structures
by_root = defaultdict(list)
for w, e in merged.items():
    if e['root'] and e['root']['key']: by_root[e['root']['key']].append(w)
roots = {k: {'meaning': Counter(merged[w]['root']['meaning'] for w in ws).most_common(1)[0][0], 'words': sorted(ws)} for k, ws in by_root.items() if len(ws) >= 2}
# confusable closure (symmetric, only words in the list)
conf = defaultdict(set)
for w, e in merged.items():
    for c in e['confusable']:
        if c in wordset and c != w: conf[w].add(c); conf[c].add(w)
# compounds: word = a + b with both in the list (each part >= 3 letters)
compounds = {}
for w in words:
    if not w.isalpha() or len(w) < 6: continue
    for i in range(3, len(w) - 2):
        a, b = w[:i], w[i:]
        if a in wordset and b in wordset: compounds[w] = [a, b]; break
# derivation families: union words that reduce to each other by one affix
SUF = [('ally','al'),('ily','y'),('bly','ble'),('ly',''),('iness','y'),('ness',''),('ment',''),('er',''),('er','e'),('or',''),('ist',''),('ism',''),('ility','le'),('ity',''),('ity','e'),('ization','ize'),('ation','e'),('ation',''),('tion','te'),('ion',''),('ion','e'),('able',''),('able','e'),('ible',''),('ful',''),('less',''),('ous',''),('ous','e'),('ive',''),('ive','e'),('ize',''),('ize','e'),('ise',''),('al',''),('al','e'),('ial',''),('ic',''),('ical',''),('ish',''),('hood',''),('ship',''),('ance',''),('ance','e'),('ence',''),('ence','e'),('ancy',''),('ency',''),('ant',''),('ant','e'),('ent',''),('ent','e'),('ary',''),('ory',''),('ure',''),('ure','e'),('ee',''),('age',''),('ery',''),('y',''),('y','e'),('ify',''),('en',''),('ate',''),('ate','e'),('cy','t'),('cy','te')]
PRE = ['un','in','im','ir','il','dis','non','re','mis','over','under','pre','anti','semi','sub','super','inter','trans','de','co','counter','out','fore','ex','multi','micro','mini','mid','post','pro','auto','bi','tri','ultra','hyper','extra','mal','en','em']
parent = {w: w for w in words}
def find(x):
    while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
    return x
def union(a, b): parent[find(a)] = find(b)
for w in words:
    if not w.isalpha(): continue
    cands = set()
    for s, r in SUF:
        if w.endswith(s) and len(w) - len(s) >= 3:
            st = w[:-len(s)] + r; cands.add(st)
            if len(st) > 3 and st[-1] == st[-2]: cands.add(st[:-1])
    for p in PRE:
        if w.startswith(p) and len(w) - len(p) >= 3: cands.add(w[len(p):])
    for c in cands:
        if c in wordset and c != w: union(w, c)
fam = defaultdict(list)
for w in words: fam[find(w)].append(w)
families = {w: sorted(ws) for ws in fam.values() if len(ws) >= 2 for w in ws}
# spelling variants: UK/US pairs both present
variants = {}
for w in words:
    for a, b in [('our','or'),('ise','ize'),('isation','ization'),('yse','yze'),('re','er'),('ogue','og'),('ll','l'),('ae','e'),('oe','e'),('mme','m'),('ce','se')]:
        if a in w:
            v = w.replace(a, b)
            if v in wordset and v != w: variants.setdefault(w, set()).add(v); variants.setdefault(v, set()).add(w)
variants = {w: sorted(v) for w, v in variants.items()}

def symmetric(key):
    m = defaultdict(set)
    for w, e in merged.items():
        for x in e[key]:
            if x in wordset and x != w: m[w].add(x); m[x].add(w)
    return {w: sorted(v) for w, v in m.items()}
out = {'words': merged, 'roots': roots, 'confusable': {w: sorted(v) for w, v in conf.items()}, 'compounds': compounds, 'families': families, 'variants': variants,
       'synonyms': symmetric('synonyms'), 'antonyms': symmetric('antonyms')}
(HERE / 'enrichment.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'words annotated: {len(merged)}/{len(words)} | batches done: {len(done)}/{len(inputs)} | roots: {len(roots)} | confusable words: {len(conf)} | compounds: {len(compounds)} | family words: {len(families)} | variant words: {len(variants)}')
for pr in problems[:40]: print('PROBLEM', pr)
if problems and '--strict' in sys.argv: sys.exit(1)
