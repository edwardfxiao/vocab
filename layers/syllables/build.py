#!/usr/bin/env python3
"""Syllable divisions (mav·er·ick) for a vocabulary CSV.

Sources, in priority order (none of them is stored in the repository; see README.md for download links):
  1. fixes.json          — hand/Claude-reviewed divisions, always win.
  2. Moby Hyphenator II  — public-domain dictionary of ~187,000 hyphenated words (mhyph.txt, Project Gutenberg #3204).
  3. pyphen (en_US)      — TeX hyphenation patterns, used only for words Moby lacks; pieces without a vowel letter are
                           merged into a neighbour.
Every division is checked against the syllable count of the CMU Pronouncing Dictionary (one syllable per stressed
vowel phoneme), falling back to the vocabulary's own IPA column. Disagreements and words with no pronunciation data go
to review.txt for a second pass (Claude batches → fixes.json).

Usage: python3 layers/syllables/build.py [vocabulary.csv …] [--moby mhyph.txt] [--cmu cmudict.dict]
Without CSV arguments every `dictionary` collection under data/ is covered (a new collection is picked up
automatically). Writes syllables.json ({word: "mav·er·ick"}), review.txt and review.json next to this file; make_inputs.py turns
review.json into review batches.
"""
import argparse, csv, json, re, sys
from pathlib import Path
import pyphen

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from layerlib import dictionary_rows  # noqa: E402
DOT = '·'
VOWEL_LETTERS = set('aeiouy')
IPA_VOWELS = 'aeiouæɑɒɔəɚɜɪʊʌεєәɐɛ'
dic = pyphen.Pyphen(lang='en_US')


def load_moby(path: Path) -> dict[str, str]:
    """Moby uses byte 0xA5 as the syllable break; keep only single, unhyphenated words."""
    out: dict[str, str] = {}
    for raw in path.read_bytes().split(b'\n'):
        raw = raw.strip(b'\r')
        if not raw or b' ' in raw or b'-' in raw:
            continue
        pieces = [p.decode('latin-1') for p in raw.split(b'\xa5')]
        word = ''.join(pieces)
        if word.isalpha() and word.lower() not in out:
            out[word.lower()] = DOT.join(p.lower() for p in pieces)
    return out


def load_cmu(path: Path) -> dict[str, int]:
    out: dict[str, int] = {}
    for line in path.read_text(encoding='latin-1').splitlines():
        if not line or line.startswith(';;;'):
            continue
        head, *phones = line.split()
        word = re.sub(r'\(\d+\)$', '', head)
        if word not in out:      # first pronunciation only
            out[word] = sum(1 for p in phones if p[-1].isdigit())
    return out


def pyphen_split(token: str) -> list[str]:
    parts = dic.inserted(token.lower(), '-').split('-')
    out: list[str] = []
    for p in parts:
        if out and (not VOWEL_LETTERS & set(p) or not VOWEL_LETTERS & set(out[-1])):
            out[-1] += p
        else:
            out.append(p)
    res, i = [], 0
    for p in out:
        res.append(token[i:i + len(p)]); i += len(p)
    return res


def ipa_syllables(ph: str) -> int:
    first = re.split(r'[,;/]|(?<=\S)\.', ph.strip())[0]
    n = len(re.findall(f'[{IPA_VOWELS}]+', first))
    if re.search(f'[^{IPA_VOWELS}\\W][lnm][szdt]?$', first):   # syllabic l/n/m: people, student, rhythm
        n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('csv', nargs='*', help='vocabulary CSVs; default: every dictionary collection under data/')
    ap.add_argument('--moby', default=None); ap.add_argument('--cmu', default=None)
    a = ap.parse_args()
    moby = load_moby(Path(a.moby)) if a.moby else {}
    cmu = load_cmu(Path(a.cmu)) if a.cmu else {}
    fixes = json.loads((HERE / 'fixes.json').read_text()) if (HERE / 'fixes.json').exists() else {}
    rows = [r for f in a.csv for r in csv.DictReader(open(f, encoding='utf-8-sig'))] if a.csv else dictionary_rows()
    result: dict[str, str] = {}
    review: list[str] = []
    review_items: list[dict] = []
    stats = {'fixes': 0, 'moby': 0, 'pyphen': 0, 'checked_cmu': 0, 'checked_ipa': 0}
    for r in rows:
        w = r['word']
        if w in fixes:
            result[w] = fixes[w]; stats['fixes'] += 1
            continue
        tokens = re.split(r'([^A-Za-z]+)', w)
        pieces, source = [], 'moby'
        for i, t in enumerate(tokens):
            if i % 2 or not t:
                pieces.append(t); continue
            m = moby.get(t.lower())
            if m:
                pieces.append(t[:1] + m[1:] if t[:1].isupper() else m)
            else:
                source = 'pyphen'; pieces.append(DOT.join(pyphen_split(t)))
        s = ''.join(pieces)
        result[w] = s
        stats[source] += 1
        n_alg = sum(p.count(DOT) + 1 for p in re.split(r'[^A-Za-z·]+', s) if p)
        if w.lower() in cmu:
            n_ref, ref = cmu[w.lower()], 'cmu'; stats['checked_cmu'] += 1
        elif r['phonetic']:
            n_ref, ref = ipa_syllables(r['phonetic']), 'ipa'; stats['checked_ipa'] += 1
        else:
            n_ref, ref = 0, 'none'
        if n_ref == 0 or n_alg != n_ref:
            review.append(f'{w}\t{s}\t{source}\t{ref}={n_ref}\t{r["phonetic"] or "(no phonetic)"}')
            review_items.append({'word': w, 'split': s, 'source': source, 'ref': n_ref, 'ipa': r['phonetic']})
    (HERE / 'syllables.json').write_text(json.dumps(result, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
    (HERE / 'review.txt').write_text('\n'.join(review) + '\n', encoding='utf-8')
    (HERE / 'review.json').write_text(json.dumps(review_items, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(result)} words · {stats} · {len(review)} to review ({len(review) / len(result):.1%})')


if __name__ == '__main__':
    main()
