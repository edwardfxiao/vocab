#!/usr/bin/env python3
"""Print the complete prompt for one batch, ready to paste into any assistant; save the reply as the printed output path.

Usage: python3 scripts/prompt.py enrichment <n>             layers/enrichment/PROMPT.md + batches/input-<n>.json
       python3 scripts/prompt.py syllables <n>              layers/syllables/REVIEW_PROMPT.md + batches/input-<n>.json
       python3 scripts/prompt.py story <collection> <n> [--variant b]
                                                       scripts/stories/STORY_PROMPT.md + data/<collection>/stories/batches/input-<n>.json;
                                                       --variant b asks for a second, different story on the same word group (output-<n>-b.json)
       python3 scripts/prompt.py phrasal <collection> <n>   scripts/stories/PHRASAL_REVIEW_PROMPT.md + data/<collection>/stories/phrasal/input-<n>.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import json
argv = sys.argv[1:]
variant = argv[argv.index('--variant') + 1].lower() if '--variant' in argv else ''
args = [a for a in argv if not a.startswith('--') and a != variant]
if variant and (args[:1] != ['story'] or not (len(variant) == 1 and 'b' <= variant <= 'z')): raise SystemExit('--variant takes a single letter b–z and applies to story batches only.')
kinds = {
    'enrichment': (2, ROOT / 'layers/enrichment/PROMPT.md', lambda a: ROOT / 'layers/enrichment/batches'),
    'syllables': (2, ROOT / 'layers/syllables/REVIEW_PROMPT.md', lambda a: ROOT / 'layers/syllables/batches'),
    'story': (3, ROOT / 'scripts/stories/STORY_PROMPT.md', lambda a: ROOT / 'data' / a[1] / 'stories/batches'),
    'phrasal': (3, ROOT / 'scripts/stories/PHRASAL_REVIEW_PROMPT.md', lambda a: ROOT / 'data' / a[1] / 'stories/phrasal'),
}
if not args or args[0] not in kinds or len(args) != kinds[args[0]][0]:
    raise SystemExit(__doc__)
_, prompt, folder = kinds[args[0]]
n = int(args[-1]); d = folder(args)
inp = d / f'input-{n:03d}.json'
if not inp.is_file(): raise SystemExit(f'{inp} does not exist.')
print(prompt.read_text(encoding='utf-8').rstrip()); print()
if variant:
    earlier = []
    for v in [''] + [chr(c) for c in range(ord('b'), ord(variant))]:
        f = d / ('output-%03d%s.json' % (n, '-' + v if v else ''))
        if f.is_file():
            try: st = json.loads(f.read_text(encoding='utf-8')); earlier.append(f"“{st.get('title', '')}” ({st.get('summary_zh', '')})")
            except ValueError: pass
    print(f'This is story {variant.upper()} for word group {n}: another independent story with exactly the same target words. ' + (f'Earlier stories on this group: {"; ".join(earlier)}. ' if earlier else '') + 'Use a completely different setting, characters, time and plot, so the words are met in new contexts; keep every rule above.'); print()
suffix = '-' + variant if variant else ''
print(f'Output path: {d / f"output-{n:03d}{suffix}.json"}'); print(); print('Input:'); print(inp.read_text(encoding='utf-8').rstrip())
