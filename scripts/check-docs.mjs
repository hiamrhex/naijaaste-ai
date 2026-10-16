#!/usr/bin/env node
// Docs drift gate: fails (exit 1) if README/docs contradict the code.
// Checks: (1) stale numbers, (2) internal links resolve, (3) Mermaid fences
// balanced, (4) package.json scripts referenced in README exist.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const problems = [];

// ---- 1. Stale-claim greps ------------------------------------------------
// If any of these strings reappear, a doc has regressed to an old number.
const STALE = [
  '127 tests',
  '127 passing',
  '20 files',
  '27 endpoints',
  '28,863',
  '17–24s',
  '17-24s',
  'only Home is a real screen',
];
const SCAN_DIRS = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs'];
function walk(p, out = []) {
  const abs = join(root, p);
  if (!existsSync(abs)) return out;
  if (statSync(abs).isDirectory()) {
    for (const e of readdirSync(abs)) if (!e.startsWith('.')) walk(join(p, e), out);
  } else if (/\.(md|mdx)$/.test(abs)) out.push(abs);
  return out;
}
for (const file of walk(SCAN_DIRS[3]).concat(SCAN_DIRS.slice(0, 3).map((f) => join(root, f)).filter(existsSync))) {
  const text = readFileSync(file, 'utf8');
  for (const s of STALE) {
    if (text.includes(s)) {
      problems.push(`STALE "${s}" in ${file.replace(root + '/', '')}`);
    }
  }
}

// ---- 2. Internal markdown links resolve ----------------------------------
const mdFiles = walk('docs').concat([join(root, 'README.md'), join(root, 'CONTRIBUTING.md')]).filter(existsSync);
const linkRe = /\[[^\]]*\]\(([^)#\s]+)(#[^)]*)?\)/g;
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = linkRe.exec(text))) {
    const target = m[1];
    if (/^(https?:|mailto:|data:)/.test(target)) continue;
    const abs = resolve(dirname(file), target.split('#')[0]);
    if (!existsSync(abs)) {
      problems.push(`BROKEN LINK (${target}) in ${file.replace(root + '/', '')}`);
    }
  }
}

// ---- 3. Mermaid fences balanced ------------------------------------------
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  const opens = (text.match(/^\s*```mermaid\s*$/gm) || []).length;
  const closes = (text.match(/^\s*```\s*$/gm) || []).length;
  // every ```mermaid opener must have a matching closing fence overall
  if (opens > 0 && closes < opens) {
    problems.push(`MERMAID UNBALANCED in ${file.replace(root + '/', '')} (${opens} open vs ${closes} close)`);
  }
}

// ---- 4. package.json scripts referenced in README exist ------------------
const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');
const scriptRefs = [...readme.matchAll(/npm run ([a-z:@\/-]+)/g)].map((m) => m[1]);
for (const s of new Set(scriptRefs)) {
  if (!(s in pkg.scripts)) {
    problems.push(`MISSING SCRIPT "npm run ${s}" referenced in README.md`);
  }
}

// ---- report --------------------------------------------------------------
if (problems.length) {
  console.error('check:docs FAILED — docs drift detected:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error(`\n${problems.length} problem(s). Fix the docs (code wins).`);
  process.exit(1);
} else {
  const n = new Set(scriptRefs).size;
  console.log(`check:docs OK — ${mdFiles.length} md files, no stale claims, links resolve, ${n} npm scripts verified`);
}
