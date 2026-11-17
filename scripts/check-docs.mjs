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
  '31 endpoints',
  '466 tests',
  '466 passing',
  '28,863',
  '28,875',
  '17–24s',
  '17-24s',
  'only Home is a real screen',
];

// Every user-facing doc is in scope: every root-level markdown file plus
// everything under docs/. Historical plan records (plans/) are deliberately
// excluded — they describe the repo as it was when the plan was written.
function walk(p, out = []) {
  const abs = join(root, p);
  if (!existsSync(abs)) return out;
  if (statSync(abs).isDirectory()) {
    for (const e of readdirSync(abs)) if (!e.startsWith('.')) walk(join(p, e), out);
  } else if (/\.(md|mdx)$/.test(abs)) out.push(abs);
  return out;
}

const rootDocs = readdirSync(root)
  .filter((f) => f.endsWith('.md'))
  .map((f) => join(root, f));
const mdFiles = walk('docs').concat(rootDocs).filter(existsSync);
const rel = (file) => file.replace(root + '\\', '').replace(root + '/', '');

for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  for (const s of STALE) {
    if (text.includes(s)) {
      problems.push(`STALE "${s}" in ${rel(file)}`);
    }
  }
}

// ---- 2. Internal markdown links resolve ----------------------------------
const linkRe = /\[[^\]]*\]\(([^)#\s]+)(#[^)]*)?\)/g;
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = linkRe.exec(text))) {
    const target = m[1];
    if (/^(https?:|mailto:|data:)/.test(target)) continue;
    const abs = resolve(dirname(file), target.split('#')[0]);
    if (!existsSync(abs)) {
      problems.push(`BROKEN LINK (${target}) in ${rel(file)}`);
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
    problems.push(`MERMAID UNBALANCED in ${rel(file)} (${opens} open vs ${closes} close)`);
  }
}

// ---- 4. package.json scripts referenced in any doc exist ------------------
const pkg = JSON.parse(read('package.json'));
const scriptRefs = new Set();
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/npm run ([a-z:@/-]+)/g)) {
    scriptRefs.add(m[1]);
    if (!(m[1] in pkg.scripts)) {
      problems.push(`MISSING SCRIPT "npm run ${m[1]}" in ${rel(file)}`);
    }
  }
}

// ---- report --------------------------------------------------------------
if (problems.length) {
  console.error('check:docs FAILED — docs drift detected:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error(`\n${problems.length} problem(s). Fix the docs (code wins).`);
  process.exit(1);
} else {
  console.log(`check:docs OK — ${mdFiles.length} md files, no stale claims, links resolve, ${scriptRefs.size} npm scripts verified`);
}
