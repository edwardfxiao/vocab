# Syllable review prompt

You receive a JSON list of English words with a tentative syllable division (`split`, pieces joined by `·`), the
source of that split, and a reference syllable count from a pronouncing dictionary (`ref`, 0 = unknown) plus the
word's IPA. The tentative split and the reference count disagree. Decide the correct **dictionary-style syllable
division** for each word, the way Google's dictionary box, Merriam-Webster or Oxford show it (e.g. `mav·er·ick`,
`ed·u·ca·tion`, `sci·en·tist`, `pres·i·dent`, `ev·ery` or `ev·er·y` — pick the common dictionary form).

Rules:
- Return **only** a JSON object mapping every input word to its division: `{"education": "ed·u·ca·tion", ...}`.
- Removing the `·` characters must give back the word exactly (same letters, same case, hyphens/spaces kept).
- One-syllable words get no `·` (e.g. `fire`, `hour`, `our` are one syllable in British dictionaries; treat words like
  `fire`, `hire`, `desire` as one syllable for the `-ire` part, as Oxford does).
- Prefer British-dictionary conventions when British and American differ; the vocabulary uses British spellings.
- Do not skip any word, do not add commentary.
