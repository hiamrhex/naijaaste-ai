// Repo-native secret scan (offline, deterministic). Scans git-tracked files
// for secret-shaped strings. Exit 1 + file:line list on any hit.
// Lighter than gitleaks (no binary download); documented limitation: pattern
// list is curated, not exhaustive — see docs/SECURITY.md.
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{20,}/, 'Google API key'],
  [/sk-(live|test)-[0-9A-Za-z]{10,}/, 'Stripe-style secret key'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/xox[bap]-[0-9A-Za-z-]+/, 'Slack token'],
  [/ghp_[0-9A-Za-z]{20,}/, 'GitHub PAT'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/gsk_[0-9A-Za-z]{20,}/, 'Groq-style API key'],
  [/(password|passwd|secret)\s*=\s*['"][^'"]{8,}['"]/i, 'hardcoded password/secret'],
];

const SKIP = new Set(['package-lock.json']);
const SKIP_DIRS = ['node_modules/', 'dist/'];

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => f && !SKIP.has(f) && !SKIP_DIRS.some((d) => f.startsWith(d)));

let hits = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch { continue; }
  if (text.includes('\0')) continue; // binary
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('secret-scan: allow')) return; // explicit, reviewable exception
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) {
        console.log(`${file}:${i + 1}: possible ${label}`);
        hits += 1;
        break;
      }
    }
  });
}

if (hits > 0) {
  console.log(`\nsecret-scan: ${hits} hit(s) — investigate before merging`);
  process.exitCode = 1;
} else {
  console.log(`secret-scan: clean (${files.length} tracked files checked)`);
}
