#!/usr/bin/env python3
"""Merge reviewed batches (batches/output-*.json) into fixes.json, validating each division, then rebuild syllables.json.

Usage: python3 layers/syllables/merge.py [--moby mhyph.txt --cmu cmudict.dict]  (extra args are passed to build.py)
"""
import json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
fixes: dict[str, str] = {}
problems: list[str] = []
for f in sorted((HERE / 'batches').glob('output-*.json')):
    inputs = {x['word'] for x in json.loads((HERE / 'batches' / f.name.replace('output', 'input')).read_text())}
    out = json.loads(f.read_text())
    for w in inputs - set(out):
        problems.append(f'{f.name}: missing {w}')
    for w, s in out.items():
        if w not in inputs:
            problems.append(f'{f.name}: unexpected word {w}'); continue
        if s.replace('·', '') != w or '··' in s or s.startswith('·') or s.endswith('·'):
            problems.append(f'{f.name}: bad division {w} → {s}'); continue
        fixes[w] = s
if problems:
    print('\n'.join(problems)); sys.exit(1)
(HERE / 'fixes.json').write_text(json.dumps(dict(sorted(fixes.items())), ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
print(f'{len(fixes)} reviewed divisions written to fixes.json')
subprocess.run([sys.executable, str(HERE / 'build.py'), *sys.argv[1:]], check=True)
