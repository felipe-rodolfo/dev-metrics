import { describe, it, expect } from 'vitest';
import type { CellValue, Worksheet } from 'exceljs';
import { renderWorkbook } from '../src/xlsx.js';
import type { Collected, SourceResult } from '../src/model.js';

const period = { from: '2026-01-01', to: '2026-06-30' };
const emptyData: Collected = { issues: [], changeRequests: [], commits: [] };

function cell(sheet: Worksheet, label: string): CellValue {
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.getCell(1).value === label) return row.getCell(2).value;
  }
  return undefined;
}

describe('renderWorkbook', () => {
  it('creates one sheet per configured source and none for the others', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    const workbook = renderWorkbook(period, results);
    expect(workbook.getWorksheet('GitHub')).toBeDefined();
    expect(workbook.getWorksheet('Jira')).toBeUndefined();
    expect(workbook.getWorksheet('GitLab')).toBeUndefined();
  });

  it('always creates a Sources sheet with each source status', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'Jira', data: emptyData },
      { ok: false, name: 'GitHub', reason: 'HTTP 500 at api.github.com' },
    ];
    const workbook = renderWorkbook(period, results);
    const sheet = workbook.getWorksheet('Sources')!;
    expect(cell(sheet, 'Jira')).toBe('ok');
    expect(cell(sheet, 'GitHub')).toBe('incomplete (HTTP 500 at api.github.com)');
  });

  it('marks an incomplete section with its reason instead of metrics', () => {
    const results: SourceResult[] = [{ ok: false, name: 'Jira', reason: 'HTTP 500 at x.atlassian.net' }];
    const workbook = renderWorkbook(period, results);
    const sheet = workbook.getWorksheet('Jira')!;
    expect(cell(sheet, 'Incomplete section')).toBe('HTTP 500 at x.atlassian.net');
    expect(cell(sheet, 'Resolved issues')).toBeUndefined();
  });

  it('writes Jira metrics, including story points and resolved issues by type', () => {
    const results: SourceResult[] = [
      {
        ok: true,
        name: 'Jira',
        data: {
          ...emptyData,
          issues: [
            { key: 'A-1', type: 'Story', resolvedAt: '2026-02-10T10:00:00Z', storyPoints: 3 },
            { key: 'A-2', type: 'Story', resolvedAt: '2026-03-01T10:00:00Z', storyPoints: 5 },
            { key: 'A-3', type: 'Bug', resolvedAt: '2026-03-02T10:00:00Z', storyPoints: null },
          ],
        },
      },
    ];
    const sheet = renderWorkbook(period, results).getWorksheet('Jira')!;
    expect(cell(sheet, 'Resolved issues')).toBe(3);
    expect(cell(sheet, 'Resolved issues: Story')).toBe(2);
    expect(cell(sheet, 'Resolved issues: Bug')).toBe(1);
    expect(cell(sheet, 'Average story points')).toBe(4);
    expect(cell(sheet, 'Median story points')).toBe(4);
  });

  it('leaves "no data" metrics as blank cells so the sheet stays usable for math', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    const sheet = renderWorkbook(period, results).getWorksheet('GitHub')!;
    expect(cell(sheet, 'Median size (changed lines)')).toBeNull();
    expect(cell(sheet, 'Average cycle time (hours)')).toBeNull();
  });

  it('writes GitHub/GitLab metrics, including cycle time, as numbers', () => {
    const results: SourceResult[] = [
      {
        ok: true,
        name: 'GitHub',
        data: {
          ...emptyData,
          changeRequests: [
            { source: 'github', id: '1', state: 'merged', createdAt: '2026-01-01T00:00:00Z', mergedAt: '2026-01-02T00:00:00Z', additions: 10, deletions: 0, changedFiles: 1 },
          ],
          commits: [{ source: 'github', committedAt: '2026-01-10T00:00:00Z', count: 3 }],
        },
      },
    ];
    const sheet = renderWorkbook(period, results).getWorksheet('GitHub')!;
    expect(cell(sheet, 'Merged PRs/MRs')).toBe(1);
    expect(cell(sheet, 'Commits')).toBe(3);
    expect(cell(sheet, 'Average cycle time (hours)')).toBe(24);
    expect(cell(sheet, 'Median cycle time (hours)')).toBe(24);
  });

  it('adds an incomplete commit count row when the source flags it', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'GitLab', data: { ...emptyData, commitsNote: 'bulk push without count' } },
    ];
    const sheet = renderWorkbook(period, results).getWorksheet('GitLab')!;
    expect(cell(sheet, 'Incomplete commit count')).toBe('bulk push without count');
  });
});
