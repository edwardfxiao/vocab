"""Shared by the layer builders: which collections exist under data/ and the words of every `dictionary` one."""
from __future__ import annotations
import csv, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'


def collections(kind: str | None = 'dictionary') -> list[dict]:
    """[{id, folder, file (Path), kind}] from data/*/dataset.json, in dropdown order. kind=None returns every kind."""
    out = []
    for folder in sorted(p for p in DATA.iterdir() if (p / 'dataset.json').is_file()):
        cfg = json.loads((folder / 'dataset.json').read_text(encoding='utf-8'))
        order = cfg.get('order', float('inf'))
        items = cfg['collections'] if isinstance(cfg.get('collections'), list) else [cfg]
        for it in items:
            cid = folder.name if it is cfg else f"{folder.name}/{it.get('name') or Path(it.get('file', '')).stem}"
            if kind and it.get('kind') != kind: continue
            f = folder / str(it.get('file', ''))
            if f.is_file(): out.append({'id': cid, 'folder': folder, 'file': f, 'kind': it.get('kind'), 'order': order})
    out.sort(key=lambda c: (c['order'], c['id']))
    return out


def dictionary_rows() -> list[dict]:
    """Rows of every dictionary collection, first occurrence of a spelling wins (so 'word', 'phonetic', 'meaning_zh',
    'definition_en', 'part_of_speech' are available), in collection order."""
    seen: set[str] = set(); rows: list[dict] = []
    for c in collections('dictionary'):
        for r in csv.DictReader(c['file'].open(encoding='utf-8-sig')):
            w = r.get('word', '').strip()
            if w and w not in seen:
                seen.add(w); rows.append(r)
    return rows
