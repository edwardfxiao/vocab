#!/usr/bin/env python3
"""Validate story batch outputs and build the files the app reads: story-NNN.json, index.json and bundle.json.

Usage: python3 scripts/stories/validate.py <collection> [--strict]

Reads data/<collection>/stories/batches/input-NNN.json + output-NNN.json, plus variants output-NNN-b.json, -c … (another
story on the same word group; see scripts/prompt.py story … --variant b). Every target must be bolded at least twice
(inflections and whole phrasal verbs count), the glossary must cover every target, nothing else may be bold, and the
story should run to 600+ words. index.json carries batches/meta.json (which review export the batches came from) as
`source`; bundle.json packs every story for importing into the app's browser storage (Stories → Import stories bundle).
--strict exits 1 when there are problems.
"""
import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import collection_arg, flag, lemma_matches, stories_dir  # noqa: E402

collection = collection_arg(sys.argv[1:], __doc__)
HERE = stories_dir(collection)
problems, index = [], []
meta_file = HERE / 'batches/meta.json'
source = json.loads(meta_file.read_text(encoding='utf-8')) if meta_file.exists() else {}
def round_of(n: int) -> int:
    """Which round a batch belongs to: from meta.json's runs (batches 'from-to'); everything unlisted is round 1."""
    for run in source.get('runs') or []:
        rng = str(run.get('batches', ''))
        if '-' in rng:
            lo, hi = rng.split('-'); 
            if int(lo) <= n <= int(hi): return int(run.get('round', 1))
    return 1
outputs = []
for inp in sorted(HERE.glob('batches/input-*.json')):
    n = inp.stem.split('-')[1]
    words = [x['word'] for x in json.loads(inp.read_text(encoding='utf-8'))]
    for out in sorted(HERE.glob(f'batches/output-{n}*.json')):
        m = re.fullmatch(rf'output-{n}(?:-([a-z]))?', out.stem)
        if m: outputs.append((n, m.group(1) or '', words, out))
for n, variant, words, out in outputs:
    suffix = f'-{variant}' if variant else ''
    try: story = json.loads(out.read_text(encoding='utf-8'))
    except Exception as e: problems.append(f'{out.name}: invalid JSON ({e})'); continue
    paras = story.get('paragraphs') or []
    text = '\n'.join(paras)
    bolds = [m.group(1) for m in re.finditer(r'\*\*([^*]+)\*\*', text)]
    counts = {w: sum(1 for b in bolds if lemma_matches(b, w)) for w in words}
    missing = [w for w, c in counts.items() if c == 0]; once = [w for w, c in counts.items() if c == 1]
    if missing: problems.append(f'{out.name}: {len(missing)} words never bolded: {missing[:8]}')
    if once: problems.append(f'{out.name}: {len(once)} words bolded only once: {once[:8]}')
    gl = {g.get('word', '').lower() for g in story.get('glossary') or []}
    gmiss = [w for w in words if w.lower() not in gl]
    if gmiss: problems.append(f'{out.name}: glossary missing {gmiss[:8]}')
    stray = [b for b in bolds if not any(lemma_matches(b, w) for w in words)]
    if stray: problems.append(f'{out.name}: bold non-target tokens {stray[:5]}')
    wc = len(re.findall(r"[A-Za-z']+", text))
    if wc < 600: problems.append(f'{out.name}: only {wc} words of story')
    story_out = {'n': int(n), **({'variant': variant} if variant else {}), 'round': round_of(int(n)), 'title': story.get('title', ''), 'summary_zh': story.get('summary_zh', ''), 'words': words, 'paragraphs': paras, 'glossary': story.get('glossary') or []}
    (HERE / f'story-{n}{suffix}.json').write_text(json.dumps(story_out, ensure_ascii=False) + '\n', encoding='utf-8')
    index.append({'n': int(n), **({'variant': variant} if variant else {}), 'round': round_of(int(n)), 'title': story_out['title'], 'summary_zh': story_out['summary_zh'], 'words': words, 'wordCount': wc})
ordered = sorted(index, key=lambda s: (s['n'], s.get('variant', '')))
(HERE / 'index.json').write_text(json.dumps({'source': source, 'stories': ordered}, ensure_ascii=False) + '\n', encoding='utf-8')
full = [json.loads((HERE / f"story-{s['n']:03d}{'-' + s['variant'] if s.get('variant') else ''}.json").read_text(encoding='utf-8')) for s in ordered]
(HERE / 'bundle.json').write_text(json.dumps({'dataset': collection, 'source': source, 'stories': full}, ensure_ascii=False) + '\n', encoding='utf-8')
total = len(list(HERE.glob('batches/input-*.json')))
groups = len({s['n'] for s in index}); extra = len(index) - groups; rounds = sorted({s['round'] for s in index})
print(f'{collection}: word groups with a story {groups}/{total}' + (f' (+{extra} variant stories)' if extra else '') + (f' | rounds {rounds}' if len(rounds) > 1 else '') + f' | problems: {len(problems)} | wrote index.json + bundle.json in {HERE}')
for p in problems[:30]: print('PROBLEM', p)
if problems and flag(sys.argv[1:], '--strict'): sys.exit(1)
