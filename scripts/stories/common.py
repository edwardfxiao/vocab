"""Shared bits of the story tooling: repository paths and the collection → stories folder mapping."""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
ENRICHMENT = ROOT / 'layers/enrichment/enrichment.json'


def stories_dir(collection: str) -> Path:
    """data/<collection>/stories — created on demand. The collection is a folder under data/ with a dataset.json."""
    folder = DATA / collection
    if not (folder / 'dataset.json').is_file():
        raise SystemExit(f'{folder} is not a collection (no dataset.json). Collections: {", ".join(sorted(p.name for p in DATA.iterdir() if (p / "dataset.json").is_file()))}')
    d = folder / 'stories'
    d.mkdir(exist_ok=True)
    return d


def lemma_matches(bold: str, word: str) -> bool:
    """Does a bold token (possibly inflected, possibly a whole phrasal verb) belong to the target word?"""
    b = bold.lower().strip().split(' ')[0]; w = word.lower()
    if b == w or b.startswith(w): return True
    stem = w[:-1] if w.endswith('e') else w          # anticipate → anticipating
    if len(stem) >= 4 and b.startswith(stem): return True
    if w.endswith('y') and b.startswith(w[:-1] + 'i'): return True   # carry → carried
    return False


def collection_arg(argv: list[str], usage: str) -> str:
    args = [a for a in argv if not a.startswith('--')]
    if len(args) != 1:
        raise SystemExit(usage)
    return args[0]


def flag(argv: list[str], name: str) -> bool:
    return name in argv


def opt(argv: list[str], name: str) -> str | None:
    for i, a in enumerate(argv):
        if a == name and i + 1 < len(argv):
            return argv[i + 1]
        if a.startswith(name + '='):
            return a.split('=', 1)[1]
    return None


if __name__ == '__main__':
    print(ROOT, file=sys.stderr)
