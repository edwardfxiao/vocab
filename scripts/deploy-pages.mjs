// Publishes the site to the gh-pages branch of the `origin` remote (GitHub Pages: Settings → Pages → branch gh-pages, folder /).
// Credentials: whatever `git push origin` uses for this repository (an HTTPS token prompt or an SSH key); nothing is stored here.
// Usage: node scripts/deploy-pages.mjs            (npm run deploy)
// The base path comes from the remote's repository name: <user>.github.io → '/', anything else → '/<repo>/'.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, opts = {}) => { const out = execSync(cmd, { cwd: ROOT, stdio: 'pipe', ...opts }); return out ? out.toString().trim() : ''; };   // stdio 'inherit' returns null

let remote;
try { remote = sh('git remote get-url origin'); } catch { throw new Error('No `origin` remote. Create the GitHub repository, then: git remote add origin git@github.com:<user>/<repo>.git'); }
const m = remote.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
if (!m) throw new Error(`Cannot read user/repo from remote ${remote}`);
const [, user, repo] = m;
const base = repo.toLowerCase() === `${user.toLowerCase()}.github.io` ? '/' : `/${repo}/`;
const site = buildSite(base);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-'));
sh('git worktree prune');                                   // forget worktrees whose folder is gone
// …and remove any leftover worktree (folder still there) that holds gh-pages, else `worktree add` refuses
for (const block of sh('git worktree list --porcelain').split('\n\n')) {
  const dir = block.match(/^worktree (.+)$/m)?.[1];
  if (dir && /^branch refs\/heads\/gh-pages$/m.test(block) && path.resolve(dir) !== ROOT) sh(`git worktree remove --force "${dir}"`);
}
let remoteHasBranch = false;
try { sh('git fetch origin gh-pages', { stdio: 'inherit' }); remoteHasBranch = true; } catch { /* no gh-pages on the remote yet */ }
const localHasBranch = sh('git branch --list gh-pages') !== '';
if (remoteHasBranch) sh(`git worktree add -B gh-pages "${work}" origin/gh-pages`);        // continue the published history
else if (localHasBranch) sh(`git worktree add "${work}" gh-pages`);                       // a local branch from an earlier run
else {                                                                                     // first publish: an empty orphan branch
  sh(`git worktree add --detach "${work}"`);
  sh('git checkout --orphan gh-pages', { cwd: work });
  sh('git rm -rf --quiet . || true', { cwd: work });
}
for (const f of fs.readdirSync(work)) if (f !== '.git') fs.rmSync(path.join(work, f), { recursive: true, force: true });
fs.cpSync(site, work, { recursive: true });
sh('git add -A', { cwd: work });
const changed = sh('git status --porcelain', { cwd: work });
if (!changed) console.log('gh-pages already up to date.');
else {
  sh(`git commit -q -m "Publish ${new Date().toISOString().slice(0, 16).replace('T', ' ')}"`, { cwd: work });
  sh('git push -u origin gh-pages', { cwd: work, stdio: 'inherit' });
  console.log(`Published to https://${user}.github.io${base}`);
}
sh(`git worktree remove --force "${work}"`);
