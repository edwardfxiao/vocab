#!/usr/bin/env python3
"""Write enrichment input batches for every dictionary-collection word that enrichment.json does not cover yet.

Usage: python3 layers/enrichment/make_inputs.py [--size 100]

Reads every `dictionary` collection under data/ (words of a new collection are picked up automatically), skips words
already in enrichment.json or in an existing batches/input-*.json, and writes batches/input-NNN.json (numbering
continues) with {word, pos, zh, en} per word — the shape PROMPT.md expects. Then have each batch annotated following
PROMPT.md (scripts/prompt.py enrichment <n> prints prompt + input) into batches/output-NNN.json and run merge.py.
"""
from __future__ import annotations
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from layerlib import dictionary_rows  # noqa: E402

size = int(sys.argv[sys.argv.index('--size') + 1]) if '--size' in sys.argv else 100
BATCHES = HERE / 'batches'; BATCHES.mkdir(exist_ok=True)
covered = set(json.loads((HERE / 'enrichment.json').read_text(encoding='utf-8'))['words']) if (HERE / 'enrichment.json').is_file() else set()
existing = sorted(BATCHES.glob('input-*.json'))
for p in existing: covered |= {x['word'] for x in json.loads(p.read_text(encoding='utf-8'))}
rows = [r for r in dictionary_rows() if r['word'] not in covered]
print(f'{len(rows)} words without enrichment across the dictionary collections')
if not rows: raise SystemExit(0)
def en(text: str) -> str:
    t = ' / '.join(s.strip() for s in text.splitlines() if s.strip())
    return t if len(t) <= 120 else t[:119] + '…'
n = max([int(p.stem.split('-')[1]) for p in existing], default=0)
for i in range(0, len(rows), size):
    n += 1
    items = [{'word': r['word'], 'pos': r.get('part_of_speech', ''), 'zh': r.get('meaning_zh', ''), 'en': en(r.get('definition_en', ''))} for r in rows[i:i + size]]
    (BATCHES / f'input-{n:03d}.json').write_text(json.dumps(items, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
print(f'wrote input-{max(1, n - (len(rows) - 1) // size):03d} … input-{n:03d} ({size} words each) to {BATCHES}')
