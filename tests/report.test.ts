import { describe, it, expect } from 'vitest';
import { renderReport } from '../src/report.js';
import type { Collected, SourceResult } from '../src/model.js';

const period = { from: '2026-01-01', to: '2026-06-30' };
const emptyData: Collected = { issues: [], changeRequests: [], commits: [] };

function section(report: string, title: string): string {
  const start = report.indexOf(`## ${title}`);
  if (start === -1) return '';
  const next = report.indexOf('\n## ', start + 1);
  return report.slice(start, next === -1 ? undefined : next);
}

describe('renderReport', () => {
  it('shows the title with the period', () => {
    const ok: SourceResult[] = [{ ok: true, name: 'Jira', data: emptyData }];
    expect(renderReport(period, ok)).toContain('# Metrics report: 2026-01-01 to 2026-06-30');
  });

  it('marks the Jira section as incomplete with the reason', () => {
    const results: SourceResult[] = [{ ok: false, name: 'Jira', reason: 'HTTP 500 at x.atlassian.net' }];
    const report = renderReport(period, results);
    expect(report).toContain('Incomplete section');
    expect(report).toContain('HTTP 500 at x.atlassian.net');
    expect(report).toContain('- Jira: incomplete (HTTP 500 at x.atlassian.net)');
  });

  it('shows "no data" when there is no merged PR in the period', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    expect(renderReport(period, results)).toContain('Median size in changed lines: no data');
  });

  it('does not show sections for sources that were not configured', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    const report = renderReport(period, results);
    expect(report).not.toContain('## Jira deliveries');
    expect(report).toContain('## Code activity: GitHub');
    expect(report).not.toContain('## Code activity: GitLab');
  });

  it('warns that the commit count is incomplete when a source flags it', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'GitLab', data: { ...emptyData, commitsNote: 'bulk push without count' } },
    ];
    expect(renderReport(period, results)).toContain('**Incomplete commit count:** bulk push without count');
  });

  it('separates GitHub and GitLab, each with its own metrics', () => {
    const results: SourceResult[] = [
      {
        ok: true,
        name: 'GitHub',
        data: {
          ...emptyData,
          changeRequests: [
            { source: 'github', id: 'gh-1', state: 'merged', createdAt: '2026-02-01T00:00:00Z', mergedAt: '2026-02-02T00:00:00Z', additions: 10, deletions: 0, changedFiles: 1 },
          ],
          commits: [{ source: 'github', committedAt: '2026-02-01T00:00:00Z', count: 7 }],
        },
      },
      {
        ok: true,
        name: 'GitLab',
        data: {
          ...emptyData,
          commits: [{ source: 'gitlab', committedAt: '2026-03-01T00:00:00Z', count: 2 }],
        },
      },
    ];
    const report = renderReport(period, results);
    const github = section(report, 'Code activity: GitHub');
    const gitlab = section(report, 'Code activity: GitLab');

    expect(github).toContain('Merged PRs/MRs in period: 1');
    expect(github).toContain('Commits: 7');
    expect(gitlab).toContain('Merged PRs/MRs in period: 0');
    expect(gitlab).toContain('Commits: 2');
    expect(report).not.toContain('Code activity: GitHub + GitLab');
  });

  it('shows a source failure only in its own section, keeping the other source metrics', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'GitHub', data: { ...emptyData, commits: [{ source: 'github', committedAt: '2026-02-01T00:00:00Z', count: 4 }] } },
      { ok: false, name: 'GitLab', reason: 'HTTP 403 at gitlab.com' },
    ];
    const report = renderReport(period, results);
    const gitlab = section(report, 'Code activity: GitLab');
    const github = section(report, 'Code activity: GitHub');

    expect(gitlab).toContain('> **Incomplete section:** HTTP 403 at gitlab.com');
    expect(gitlab).not.toContain('Commits:');
    expect(github).toContain('Commits: 4');
    expect(github).not.toContain('Incomplete section');
  });
});
