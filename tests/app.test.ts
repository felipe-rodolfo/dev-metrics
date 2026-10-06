import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/app.js';
import { AuthError } from '../src/http.js';
import type { SourceAdapter } from '../src/sources/adapter.js';

const argv = (out: string) => ['--from', '2026-01-01', '--to', '2026-06-30', '--out', out];
const env = {
  JIRA_API_TOKEN: 't',
  JIRA_EMAIL: 'a@example.com',
  JIRA_BASE_URL: 'https://x.atlassian.net',
  GITHUB_TOKEN: 'gh',
};

let outDir: string;
let lines: string[];
let errors: string[];
const io = {
  out: (line: string) => lines.push(line),
  err: (line: string) => errors.push(line),
};

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'dev-metrics-'));
  lines = [];
  errors = [];
});

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

const adapter = (overrides: Partial<SourceAdapter>): SourceAdapter => ({
  name: 'GitHub',
  identify: async () => {},
  collect: async () => ({ issues: [], changeRequests: [], commits: [] }),
  ...overrides,
});

describe('run', () => {
  it('returns 1 with a message when the configuration is invalid', async () => {
    const code = await run(['--from', '2026-01-01'], env, { ...io, adapters: () => [] });
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('--from and --to');
  });

  it('stops before collecting data when a token is rejected', async () => {
    let collected = false;
    const code = await run(argv(outDir), env, {
      ...io,
      adapters: () => [
        adapter({
          identify: async () => { throw new AuthError('HTTP 401 at api.github.com'); },
          collect: async () => { collected = true; return { issues: [], changeRequests: [], commits: [] }; },
        }),
      ],
    });
    expect(code).toBe(1);
    expect(collected).toBe(false);
  });

  it('writes the report and returns 0 when every source works', async () => {
    const code = await run(argv(outDir), env, { ...io, adapters: () => [adapter({})] });
    expect(code).toBe(0);
    const report = await readFile(join(outDir, 'report-2026-01-01_2026-06-30.md'), 'utf8');
    expect(report).toContain('## Code activity: GitHub');
  });

  it('partial failure: writes the report with the incomplete source and returns a non-zero code', async () => {
    const code = await run(argv(outDir), env, {
      ...io,
      adapters: () => [
        adapter({ name: 'GitHub' }),
        adapter({ name: 'GitLab', collect: async () => { throw new Error('HTTP 503 at gitlab.example.com'); } }),
      ],
    });
    expect(code).toBe(1);
    const report = await readFile(join(outDir, 'report-2026-01-01_2026-06-30.md'), 'utf8');
    expect(report).toContain('Incomplete section');
    expect(report).toContain('HTTP 503 at gitlab.example.com');
    expect(errors.join('\n')).toContain('incomplete');
  });
});
