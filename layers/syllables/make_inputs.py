#!/usr/bin/env python3
"""Turn build.py's review.json (divisions that disagree with the pronouncing dictionary) into review batches.

Usage: python3 layers/syllables/make_inputs.py [--size 100]

Skips words already in fixes.json or in an existing batches/input-*.json; numbering continues. Then have each batch
reviewed following REVIEW_PROMPT.md (scripts/prompt.py syllables <n> prints it) into batches/output-NNN.json and run
merge.py, which validates the answers into fixes.json and rebuilds syllables.json.
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
size = int(sys.argv[sys.argv.index('--size') + 1]) if '--size' in sys.argv else 100
review = HERE / 'review.json'
if not review.is_file(): raise SystemExit('review.json not found: run build.py first.')
items = json.loads(review.read_text(encoding='utf-8'))
BATCHES = HERE / 'batches'; BATCHES.mkdir(exist_ok=True)
done = set(json.loads((HERE / 'fixes.json').read_text(encoding='utf-8'))) if (HERE / 'fixes.json').is_file() else set()
existing = sorted(BATCHES.glob('input-*.json'))
for p in existing: done |= {x['word'] for x in json.loads(p.read_text(encoding='utf-8'))}
todo = [x for x in items if x['word'] not in done]
print(f'{len(items)} words to review, {len(todo)} not yet batched')
if not todo: raise SystemExit(0)
n = max([int(p.stem.split('-')[1]) for p in existing], default=0); first = n + 1
for i in range(0, len(todo), size):
    n += 1
    (BATCHES / f'input-{n:03d}.json').write_text(json.dumps(todo[i:i + size], ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'wrote input-{first:03d} … input-{n:03d} to {BATCHES}; next: python3 scripts/prompt.py syllables {first}')
