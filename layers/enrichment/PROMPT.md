# Enrichment batch instructions

You are annotating English vocabulary for a Chinese learner preparing for IELTS academic reading. Read the input JSON
(an array of {word, pos, zh, en}; `zh` is the community dictionary's Chinese gloss, often outdated or missing the
common sense) and write ONE JSON object to the output path, keyed by every input word (exact spelling), with this
shape per word:

{
  "gloss": "简明准确的中文释义",
  "trap": "一句话的易错提示，或空字符串",
  "root": {"key": "scrib", "meaning": "写", "match": "scrip"} | null,
  "confusable": ["participate"],
  "synonyms": ["expect", "foresee"],
  "antonyms": []
}

Rules:
- gloss: 简体中文，不超过 30 个字。把当代最常用的义项放最前面，用“；”分隔不同义项，同一义项内用“，”。必须补上 ECDICT 漏掉的常用义（例：leverage → “杠杆；影响力、筹码；借力”，inmate → “囚犯；(收容机构的)被收容者”，blockbuster → “大片，畅销书；(原义)巨型炸弹”，teen → “青少年(=teenager)；十几岁的”，sustainable → “可持续的；可维持的”，darn → “(委婉的)该死的，讨厌的；织补”）。多词性时用“n.”“v.”“a.”标注，只在需要区分时加。
- trap: 只在下列情况写，否则 ""：① 学习者常把它误解成另一个意思（例：numerous → “不是‘数字的’(numerical)，是‘众多的’”；transcript → “是‘文字记录、成绩单’，不是‘脚本’(script)”；repay → “偿还、报答，不是‘再付一次’”；empower → “授权、使有能力，不只是‘力量’”）；② 与某个形近词极易混（discrete 离散的 vs discreet 谨慎的）；③ 有值得一提的词源帮助记忆（audit 审计 ← audire 听，古时对账靠“听”）。不超过 40 个字。
- root: 只在单词含有可识别、对记忆有帮助的拉丁/希腊词根时给出，否则 null。`key` 用统一的词根名（优先使用下面的规范列表），`meaning` 是词根的中文意思，`match` 是这个词根在该单词里的**连续子串，必须原样出现在单词中**（例：transcript 的 match 是 "scrip"，prescription 是 "scrip"，anticipate 是 "cip"，inhabit 是 "habit"，hypodermic 是 "derm"）。一个词只给最主要的一个词根。
- confusable: 拼写或读音相近、意思不同、学习者容易混淆的英文单词，0–4 个（例：anticipate → ["participate"]，eclipse → ["ellipse", "ellipsis"]，adapt → ["adopt", "adept"]，moment → ["momentum", "momentous"]）。不要列同根衍生词（那由程序自动归组）。
- synonyms: 意思相近或属同一语义类的常见英文词，0–5 个（例：ample → ["abundant", "plentiful", "sufficient"]）。
- antonyms: 0–3 个（例：inflate → ["deflate"]，nutrition → ["malnutrition"]）。
- 所有列出的英文词用原形小写。输出必须是合法 JSON，不要 markdown，不要注释，每个输入词都要有一个条目，不要多出输入之外的键。

Canonical root keys (use these spellings for `key` when the root applies; otherwise use the usual Latin/Greek form):
act 做 | agr 田 | ali 其他 | am 爱 | anim 生命/心 | ann/enn→ann 年 | anthrop 人 | aqua 水 | arch 统治/主要 | astr 星 | aud 听 | auto 自 | bene 好 | bio 生命 | cap 拿/头 | ced 走 | cent 百 | chron 时间 | cid/cis→cis 切/杀 | circ 环 | civ 公民 | clam 喊 | clud 关闭 | cogn 知道 | corp 身体 | cred 相信 | cur 关心/跑 | dem 人民 | dict 说 | doc 教 | domin 主人/支配 | duc 引导 | dur 持续 | equ 相等 | fac 做 | fer 带来 | fid 信任 | fin 结束/界限 | flu 流 | form 形状 | fort 强 | frag 打碎 | gen 产生/种族 | geo 地 | grad 走/步 | graph 写 | grat 感谢/愉快 | hab 有/住 | hydr 水 | ject 投掷 | jud 判断 | junct 连接 | jur 法律/誓 | lat 携带 | leg 法律/选择/读 | lev 举起/轻 | liber 自由 | log 说/学 | luc 光 | man 手 | mar 海 | mater 母 | medi 中 | mem 记忆 | ment 心智 | migr 迁移 | min 小 | mit/miss→mit 送 | mob/mov→mov 动 | mon 警告/提醒 | mort 死 | nat 出生 | nov 新 | numer 数 | opt 选择/最好 | ord 秩序 | pat 父 | path 感受/病 | ped 脚/儿童 | pel/puls→pel 推 | pend 悬挂/称重 | phil 爱 | phon 声音 | photo 光 | plic 折叠 | pon/pos→pos 放置 | port 携带 | pot 能力 | prim 第一 | quer/quis→quer 寻求 | rect 直 | reg 统治 | rupt 破裂 | sci 知道 | scrib/script→scrib 写 | sect 切 | sent/sens→sens 感觉 | sequ/secu→sequ 跟随 | serv 服务/保持 | sign 标记 | simil 相似 | sist/sta→sta 站立 | soci 同伴 | sol 太阳/单独 | solv 松开 | son 声音 | spec/spic→spec 看 | spir 呼吸 | struct 建造 | tact/tang→tact 触 | tele 远 | tempor 时间 | ten/tain→ten 持有 | terr 土地 | tort 扭 | tract 拉 | trib 给予 | vac 空 | val 强/价值 | ven 来 | ver 真 | vert/vers→vert 转 | vid/vis→vis 看 | viv 活 | voc 声音/叫 | vol 意愿 | volv 卷
