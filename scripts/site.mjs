// Assembles the static site: dist/ (built with BASE_PATH) + data/ + layers/ → site/, ready for any static host.
// Usage: node scripts/site.mjs [base-path]      e.g. node scripts/site.mjs /word-by-word/
// Stories (data/*/stories) are left out on purpose: they are private; import a bundle.json in the app instead.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function buildSite(basePath = '/') {
  const base = ('/' + basePath).replace(/\/+/g, '/').replace(/\/?$/, '/');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, BASE_PATH: base } });
  const site = path.join(ROOT, 'site');
  fs.rmSync(site, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'dist'), site, { recursive: true });
  const skip = (src) => /(^|\/)(stories|batches|__pycache__)(\/|$)/.test(src.replace(ROOT, '')) || /\.(py|md|txt|dict)$/.test(src) || /(^|\/)(mhyph\.txt|cmudict\.dict|review\.json|\.DS_Store)$/.test(src);
  for (const dir of ['data', 'layers']) fs.cpSync(path.join(ROOT, dir), path.join(site, dir), { recursive: true, filter: (src) => !skip(src) });
  // stories are not published: drop the `stories` pointers so the app offers the bundle import instead of an empty list
  const indexFile = path.join(site, 'data', 'index.json');
  if (fs.existsSync(indexFile)) { const idx = JSON.parse(fs.readFileSync(indexFile, 'utf8')); for (const c of idx.collections ?? []) delete c.stories; fs.writeFileSync(indexFile, JSON.stringify(idx, null, 2) + '\n'); }
  fs.writeFileSync(path.join(site, '.nojekyll'), '');
  const size = execSync(`du -sh "${site}"`).toString().split('\t')[0];
  console.log(`site/ ready (${size}) for base path ${base}`);
  return site;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildSite(process.argv[2] || '/');
