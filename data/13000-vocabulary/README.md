# 13000-vocabulary

## 词表范围和来源
- 13,000 个大小写不敏感去重词条，按可用词频排序（bnc 与 frq 正值中的较小值，没有排名的置后）。这是备考参考选词，不是雅思官方词汇大纲。
- 词条来自 [ECDICT](https://github.com/skywind3000/ECDICT)（MIT License），释义、音标、英文释义为社区词典内容，未逐词人工校订。
- `selection` 列标记来源类别：
  - `ielts_tag`（4,543）：源词典带雅思标签的词。
  - `common_supplement`（3,457）：带中考/高考/四六级/考研/托福标签或 Oxford 核心标记的常用词。
  - `extension`（4,890）：考试/GRE 词表、Oxford 标记或 Collins 星级词条按词频补入的扩展词，去掉了意思可由已收词直接推出的派生词、感叹词、缩写和人名地名。
  - `academic`（110）：AWL（Academic Word List，Coxhead 2000，570 词头）和 NAWL（New Academic Word List，Browne 等 2013，963 词头）中此前缺少的词，如 algorithm、criteria、regression、sustainable、core、found。
- `wordlists` 列标记学术词表归属：`AWL`、`NAWL` 或 `AWL NAWL`，空表示都不在；全表 572 行属于 AWL，955 行属于 NAWL。卡片上显示为 “Academic lists: …”，导出的 CSV 也带这一列。学术词表文件来自 [lpmi-13/machine_readable_wordlists](https://github.com/lpmi-13/machine_readable_wordlists)（CC0）。

## CSV 字段
id, word, phonetic, part_of_speech, meaning_zh, definition_en, selection, source_tags, bnc_rank, frequency_rank, status, reviewed_at, source, wordlists

status、reviewed_at 由应用在导出时填写，源文件中均为 unreviewed；评分保存在浏览器里，不写回这个文件。

## 校验
manifest.json 记录了源词典和本 CSV 的 SHA-256 以及各类别的数量。
