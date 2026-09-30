// Builds the collection index the app loads at startup (/data/index.json) by scanning data/*/dataset.json.
// A folder is a collection when it holds dataset.json; folders without one (enrichment, syllables) are shared layers.
// Deleting a folder therefore removes its collections everywhere. Run directly to write data/index.json (done by
// `npm run build`); the dev server and scripts/serve.py build the same index on every request instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KINDS = ['dictionary', 'vocabulary', 'reading', 'listening', 'spelling'];
const DEFAULT_DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');

/** One collection as the app expects it: id, label, file (relative to the project root), kind, optional notes/description/stories. */
function collection(folder, dir, item, id, warn) {
  const problems = [];
  if (typeof item.label !== 'string' || !item.label.trim()) problems.push('label');
  if (typeof item.file !== 'string' || !fs.existsSync(path.join(dir, item.file))) problems.push(`file (${item.file ?? 'missing'})`);
  if (!KINDS.includes(item.kind)) problems.push(`kind (${item.kind ?? 'missing'}; one of ${KINDS.join(', ')})`);
  if (problems.length) { warn(`${folder}/dataset.json: skipped ${id}: invalid ${problems.join(', ')}`); return null; }
  const rel = f => (f ? `data/${folder}/${f}` : undefined);
  const out = { id, label: item.label.trim(), file: rel(item.file), kind: item.kind };
  if (typeof item.notes === 'string' && fs.existsSync(path.join(dir, item.notes))) out.notes = rel(item.notes);
  if (typeof item.description === 'string') out.description = item.description;
  if (typeof item.stories === 'string' && fs.existsSync(path.join(dir, item.stories, 'index.json'))) out.stories = rel(item.stories);
  return out;
}

export function buildDataIndex(dataDir = DEFAULT_DATA_DIR, warn = msg => console.warn(msg)) {
  const groups = [];
  for (const folder of fs.readdirSync(dataDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()) {
    const dir = path.join(dataDir, folder);
    const cfgPath = path.join(dir, 'dataset.json');
    if (!fs.existsSync(cfgPath)) continue;
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) { warn(`${folder}/dataset.json: invalid JSON (${e.message})`); continue; }
    const order = typeof cfg.order === 'number' ? cfg.order : Number.POSITIVE_INFINITY;
    const items = Array.isArray(cfg.collections)
      ? cfg.collections.map(c => collection(folder, dir, { notes: cfg.notes, description: cfg.description, ...c }, `${folder}/${c.name ?? path.parse(String(c.file ?? '')).name}`, warn))
      : [collection(folder, dir, cfg, folder, warn)];
    groups.push({ order, folder, items: items.filter(Boolean) });
  }
  groups.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));
  return { generated: new Date().toISOString(), collections: groups.flatMap(g => g.items) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = buildDataIndex();
  const out = path.join(DEFAULT_DATA_DIR, 'index.json');
  fs.writeFileSync(out, JSON.stringify(index, null, 2) + '\n');
  console.log(`data/index.json: ${index.collections.length} collections (${index.collections.map(c => c.id).join(', ')})`);
}
