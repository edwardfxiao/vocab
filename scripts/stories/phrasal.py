#!/usr/bin/env python3
"""Phrasal verbs in the stories: find bold verbs followed by a particle, have the doubtful ones reviewed, then extend the
bold to the whole phrase (**hemmed** in → **hemmed in**) so the app shows it as one unit.

Usage: python3 scripts/stories/phrasal.py <collection> scan    # after new stories: update phrasal/candidates.json and
                                                               # write phrasal/input-NNN.json for the undecided ones
       python3 scripts/stories/phrasal.py <collection> apply   # after review: extend the bold in batches/output-*.json

scan: every `**token** particle` whose target is a verb (pos in the input batch) in batches/output-*.json (stories not
scanned before) becomes a candidate
{id, story, para, target, token, particle, known, context}; `known` is true when the collection's own gloss or the
enrichment layer mentions "<target> <particle>", so it needs no review. Undecided unknown candidates are chunked into
phrasal/input-NNN.json for review following PHRASAL_REVIEW_PROMPT.md (scripts/prompt.py phrasal <collection> <n> prints it);
the reply, {id: true|false}, goes to phrasal/output-NNN.json.
apply: accepted = known or reviewed true; the bold is extended in place. Run validate.py afterwards.
"""
from __future__ import annotations
import csv, json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA, ENRICHMENT, lemma_matches, stories_dir  # noqa: E402

PARTICLES = ['in', 'on', 'over', 'about', 'out', 'through', 'off', 'up', 'around', 'down', 'across', 'along', 'away', 'back', 'together', 'apart', 'forth', 'aside', 'ahead', 'behind']
REVIEW_CHUNK = 150

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) != 2 or args[1] not in ('scan', 'apply'):
    raise SystemExit(__doc__)
collection, mode = args
STORIES = stories_dir(collection)
PHRASAL = STORIES / 'phrasal'; BATCHES = STORIES / 'batches'
PHRASAL.mkdir(exist_ok=True)
CANDS = PHRASAL / 'candidates.json'
cands: list[dict] = json.loads(CANDS.read_text(encoding='utf-8')) if CANDS.is_file() else []
decisions: dict[str, bool] = {}
for f in sorted(PHRASAL.glob('output-*.json')):
    decisions.update(json.loads(f.read_text(encoding='utf-8')))


def story_files() -> list[tuple[int, str, Path]]:
    """(group number, variant letter or '', path) for output-NNN.json and output-NNN-x.json."""
    out = []
    for p in BATCHES.glob('output-*.json'):
        m = re.fullmatch(r'output-(\d+)(?:-([a-z]))?', p.stem)
        if m: out.append((int(m.group(1)), m.group(2) or '', p))
    return sorted(out)


if mode == 'scan':
    # glosses that can mark a phrase as known without review
    gloss: dict[str, str] = {}
    for c in (DATA / collection).glob('*.csv'):
        for r in csv.DictReader(c.open(encoding='utf-8-sig')):
            if r.get('word'): gloss[r['word'].lower()] = ' '.join(str(r.get(k, '')) for k in ('meaning_zh', 'definition_en')).lower()
    if ENRICHMENT.is_file():
        for w, e in json.loads(ENRICHMENT.read_text(encoding='utf-8'))['words'].items():
            gloss[w.lower()] = gloss.get(w.lower(), '') + ' ' + ' '.join(str(e.get(k, '')) for k in ('gloss', 'trap')).lower()
    scanned = {(c['story'], c.get('variant', '')) for c in cands}
    seq = len(cands); added = 0
    pat = re.compile(r"\*\*([A-Za-z'-]+)\*\*(\s+)(" + '|'.join(PARTICLES) + r")\b")
    for n, variant, path in story_files():
        if (n, variant) in scanned: continue
        story = json.loads(path.read_text(encoding='utf-8'))
        inp = BATCHES / f'input-{n:03d}.json'
        items = json.loads(inp.read_text(encoding='utf-8')) if inp.is_file() else [{'word': w, 'pos': 'v'} for w in story.get('words', [])]
        verbs = [x['word'] for x in items if any(seg.strip().startswith('v') for seg in str(x.get('pos', '')).replace(',', '/').split('/'))]   # only verbs form phrasal verbs
        for pi, para in enumerate(story['paragraphs']):
            for m in pat.finditer(para):
                token, particle = m.group(1), m.group(3)
                target = next((w for w in verbs if lemma_matches(token, w)), None)
                if not target: continue
                phrase = f'{target.lower()} {particle}'
                known = phrase in gloss.get(target.lower(), '')
                ctx = para[max(0, m.start() - 50):m.end() + 50]
                cands.append({'id': f'{n:03d}{variant}-{pi}-{seq}', 'story': n, **({'variant': variant} if variant else {}), 'para': pi, 'target': target, 'token': token, 'particle': particle, 'known': known, 'context': ctx})
                seq += 1; added += 1
    CANDS.write_text(json.dumps(cands, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    queued = {x['id'] for f in PHRASAL.glob('input-*.json') for x in json.loads(f.read_text(encoding='utf-8'))}
    todo = [c for c in cands if not c['known'] and c['id'] not in decisions and c['id'] not in queued]
    existing = sorted(PHRASAL.glob('input-*.json'))
    k = max([int(p.stem.split('-')[1]) for p in existing], default=0)
    for i in range(0, len(todo), REVIEW_CHUNK):
        k += 1
        items = [{key: c[key] for key in ('id', 'target', 'token', 'particle', 'context')} for c in todo[i:i + REVIEW_CHUNK]]
        (PHRASAL / f'input-{k:03d}.json').write_text(json.dumps(items, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    known_n = sum(1 for c in cands if c['known'])
    print(f'{collection}: {added} new candidates ({len(cands)} total, {known_n} known from glosses); {len(todo)} sent for review in {(len(todo) + REVIEW_CHUNK - 1) // REVIEW_CHUNK} new input file(s)')
    if todo: print(f'next: python3 scripts/prompt.py phrasal {collection} {k} → phrasal/output-{k:03d}.json, then phrasal.py {collection} apply')
else:
    if not cands: raise SystemExit('No candidates: run scan first.')
    accepted = {c['id'] for c in cands if c['known'] or decisions.get(c['id'])}
    pending = [c['id'] for c in cands if not c['known'] and c['id'] not in decisions]
    if pending: raise SystemExit(f'{len(pending)} candidates have no decision yet (e.g. {pending[:3]}); review the phrasal/input-*.json files first.')
    by_story: dict[tuple[int, str], list[dict]] = {}
    for c in cands: by_story.setdefault((c['story'], c.get('variant', '')), []).append(c)
    changed = 0
    for (n, variant), items in sorted(by_story.items()):
        path = BATCHES / f'output-{n:03d}{"-" + variant if variant else ""}.json'
        if not path.is_file(): continue
        story = json.loads(path.read_text(encoding='utf-8'))
        for c in items:
            if c['id'] not in accepted: continue
            p = story['paragraphs'][c['para']]
            pat = re.compile(r'\*\*(' + re.escape(c['token']) + r')\*\*(\s+)(' + re.escape(c['particle']) + r')\b')
            p2, k = pat.subn(lambda m: f'**{m.group(1)}{m.group(2)}{m.group(3)}**', p)
            changed += k; story['paragraphs'][c['para']] = p2
        path.write_text(json.dumps(story, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(accepted)} accepted candidates · {changed} bold spans extended · now run validate.py {collection}')
