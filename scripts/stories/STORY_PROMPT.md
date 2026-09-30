# Story batch instructions

Write ONE English short story for a Chinese IELTS learner that teaches every target word in the input file.
Input: a JSON array of {word, zh, pos} — the target words with their Chinese gloss. Output: ONE JSON object written to
the output path:

{
  "title": "A short English title",
  "summary_zh": "一句话中文简介（≤40 字）",
  "paragraphs": ["paragraph 1 …", "paragraph 2 …", ...],
  "glossary": [{"word": "provision", "zh": "供应；条款；(provide for) 准备"}, ...]
}

Rules:
- Use EVERY target word at least 2 times, ideally 3, spread across the story (not all in one sentence). Inflected forms
  are fine (anticipated, provisions, seclusion’s) but the base word must be recognisable.
- Mark every occurrence of a target word in bold with double asterisks around the whole token: "**provisions**",
  "**anticipated**". Never bold anything else. Never put punctuation inside the asterisks.
- Length: about 900–1300 words of story, 8–14 paragraphs, one continuous narrative (characters, a setting, a problem,
  a resolution). Make the plot concrete and visual so the target words are easy to picture and remember; let the
  context make the meaning of each target word obvious (a reader who does not know the word should be able to guess it).
- The surrounding language must be simple (CEFR B1–B2): common words, short sentences, no other rare vocabulary
  competing with the targets. If two target words are near-synonyms or antonyms, use them close together so the
  contrast is clear. If two are confusable (e.g. discrete / discreet), show both in one scene.
- Grammar and spelling: British or American consistently. No headings inside paragraphs, no markdown other than the
  bold markers, no lists.
- glossary: one entry per target word, in the order they FIRST appear in the story, `zh` = the given gloss (you may
  shorten it to the sense used in the story, ≤ 30 字).
- Output must be valid JSON only (no markdown fences, no commentary). Every input word must appear in the glossary and
  at least twice in bold in the paragraphs.
