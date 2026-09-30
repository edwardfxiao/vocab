# Phrasal-verb review prompt

Each item is a sentence fragment from a vocabulary story in which a bold target verb (`token`, base form `target`) is
immediately followed by a particle (`particle`). Decide whether, **in this context**, the verb and the particle form
a phrasal verb or a fixed verb + particle combination that should be read and learned as one unit (e.g. `hemmed in`,
`tapered off`, `gloss over`, `mete out`, `fritter away`). Answer **no** when the particle merely starts an ordinary
adverbial or prepositional phrase (`erupted in eighty years`, `encased in wood`, `dissented in public`,
`stumbled on the stairs` = tripped, but `stumbled on a clue` = discovered → yes).

Return only a JSON object mapping each item's `id` to `true` (extend the bold to include the particle) or `false`.
Every id must be present. No commentary.
