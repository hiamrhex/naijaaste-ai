import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// CI configuration is code: a workflow that silently cannot run is worse than
// no workflow, because the dashboard keeps reporting it as "scheduled".
// The daily OSM refresh failed on every scheduled run for a month before
// anyone noticed, so these guards make the class of defect visible in the
// normal test run instead of in the Actions tab.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = join(root, '.github', 'workflows');
const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

const load = (file) => {
  const text = readFileSync(join(workflowsDir, file), 'utf8');
  return { file, text, lines: text.split(/\r?\n/) };
};

const workflows = files.map(load);

describe('GitHub Actions workflows', () => {
  it('finds the workflows it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(workflows.map((w) => [w.file, w]))(
    '%s declares least-privilege permissions',
    (_file, workflow) => {
      // Without an explicit block the job inherits the repository default,
      // which may include write access the job never needs.
      expect(workflow.text).toMatch(/^permissions:/m);
    }
  );

  it.each(workflows.map((w) => [w.file, w]))(
    '%s never interpolates a secret into a shell command',
    (_file, workflow) => {
      // `run: echo ${{ secrets.X }}` is script injection: the value is pasted
      // into the shell before it executes. Secrets belong in `env:`.
      const offenders = workflow.lines.filter(
        (line) => /\$\{\{\s*secrets\./.test(line) && !/^\s*[A-Z0-9_]+\s*:/.test(line)
      );
      expect(offenders).toEqual([]);
    }
  );

  it.each(workflows.map((w) => [w.file, w]))(
    '%s pins every action to a tag or SHA, never a branch',
    (_file, workflow) => {
      const uses = workflow.lines.filter((line) => /^\s*uses:/.test(line));
      for (const line of uses) {
        expect(line).not.toMatch(/@(main|master|HEAD)\s*$/);
      }
    }
  );

  it('scheduled workflows declare a concurrency group', () => {
    for (const workflow of workflows) {
      if (!/^\s*-\s*cron:/m.test(workflow.text)) continue;
      expect(workflow.text, `${workflow.file} is scheduled`).toMatch(/^concurrency:/m);
    }
  });

  it('a scheduled workflow that touches the database can be re-run on demand', () => {
    // A failure at 03:17 must be reproducible without waiting another day.
    for (const workflow of workflows) {
      if (!/^\s*-\s*cron:/m.test(workflow.text)) continue;
      if (!/db:migrate|import-osm/.test(workflow.text)) continue;
      expect(workflow.text, `${workflow.file} needs workflow_dispatch`).toMatch(
        /^\s*workflow_dispatch:/m
      );
    }
  });

  it('the database migration job works with a single configured secret', () => {
    // The refresh job used to read only `secrets.DATABASE_URL_DIRECT`, which is
    // not documented anywhere, so the job failed before it could touch the
    // database. The fallback keeps it running when only DATABASE_URL exists.
    const refresh = workflows.find((w) => /npm run db:migrate/.test(w.text));
    expect(refresh, 'a workflow runs db:migrate').toBeTruthy();
    expect(refresh.text).toContain('secrets.DATABASE_URL_DIRECT || secrets.DATABASE_URL');
    expect(refresh.text).toMatch(/DATABASE_URL_DIRECT:\s*\$\{\{\s*secrets\.DATABASE_URL_DIRECT\s*\}\}/);
  });

  it('the migration job fails fast when no database URL is configured', () => {
    const refresh = workflows.find((w) => /npm run db:migrate/.test(w.text));
    // A missing secret must produce an actionable error, not an opaque exit
    // code after a full dependency install.
    expect(refresh.text).toMatch(/if \[ -z "\$DATABASE_URL" \]/);
    expect(refresh.text).toContain('::error::');
  });
});
