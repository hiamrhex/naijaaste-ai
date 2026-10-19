// Validate data/ng/*.json against their schemas and PROVENANCE.
// Fails (exit 1) on: schema errors, duplicate keys, source_refs that do not
// resolve to a registered source in data/ng/sources.md.
// Run: node scripts/check-ng-data.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'ng');

const files = [
  { data: 'areas.json', schema: 'areas.schema.json' },
  { data: 'dishes.json', schema: 'dishes.schema.json' },
  { data: 'lexicon.json', schema: 'lexicon.schema.json' },
  { data: 'budgets.json', schema: 'budgets.schema.json' },
];

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Uniqueness keys corrected from the first audit round: a state+LGA pair
// legitimately contains many wards, and a term+language pair legitimately
// contains homonyms in different categories. Duplicates are ERRORS.
const unique = {
  'areas.json': ({ state, lga, ward }) => `${state}|${lga}|${ward}`,
  'dishes.json': ({ dish_id }) => dish_id,
  'lexicon.json': ({ term, language, category }) => `${term}|${language}|${category}`,
  'budgets.json': ({ state }) => state,
};

let allOk = true;
const sourceRefs = new Map();

for (const { data, schema } of files) {
  const dataPath = join(DATA_DIR, data);
  const schemaPath = join(DATA_DIR, schema);

  try {
    const dataObj = JSON.parse(readFileSync(dataPath, 'utf-8'));
    const schemaObj = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    const validate = ajv.compile(schemaObj);
    const valid = validate(dataObj);

    if (valid) {
      console.log(`[ok] ${data}: ${dataObj.length} items valid`);
    } else {
      console.error(`[FAIL] ${data}: schema validation failed`);
      console.error(validate.errors);
      allOk = false;
    }

    const seen = new Map();
    for (const row of dataObj) {
      const key = unique[data](row);
      if (seen.has(key)) {
        console.error(`[FAIL] ${data}: duplicate key "${key}"`);
        allOk = false;
      }
      seen.set(key, true);
    }

    const refs = new Set();
    for (const row of dataObj) {
      for (const ref of String(row.source_ref || '').split(',').map((s) => s.trim())) {
        if (ref) refs.add(ref);
      }
    }
    sourceRefs.set(data, refs);
  } catch (err) {
    console.error(`[FAIL] ${data}: ${err.message}`);
    allOk = false;
  }
}

// Every source_ref must be registered in sources.md (provenance gate).
// Unresolved refs fail the check; unproven data must not load anywhere.
const sourcesMd = readFileSync(join(DATA_DIR, 'sources.md'), 'utf-8');
for (const [file, refs] of [...sourceRefs]) {
  for (const ref of refs) {
    if (!sourcesMd.includes(ref)) {
      console.error(`[FAIL] ${file}: source_ref "${ref}" is not registered in sources.md`);
      allOk = false;
    }
  }
}

const totalRefs = new Set([...sourceRefs.values()].flatMap((s) => [...s]));
console.log('\nSummary:');
console.log(`  Files: 4 | unique keys enforced | source_refs: ${totalRefs.size} (all must resolve)`);
if (!allOk) {
  console.error('\nFAILED — do not ship unresolved or duplicate records.');
  process.exit(1);
}
console.log('\nData layer clean.');
