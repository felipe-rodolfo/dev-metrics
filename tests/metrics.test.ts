import { describe, it, expect } from 'vitest';
import { computeMetrics, median } from '../src/metrics.js';
import type { Collected } from '../src/model.js';

const period = { from: '2026-01-01', to: '2026-06-30' };
const empty: Collected = { issues: [], changeRequests: [], commits: [] };

describe('median', () => {
  it('returns null for an empty list', () => {
    expect(median([])).toBeNull();
  });
  it('uses the middle value for odd lists and the average of the two middle values for even lists', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('computeMetrics', () => {
  it('returns zeros and "no data" size for a period without data (review focus 1)', () => {
    const m = computeMetrics(empty, period);
    expect(m.issuesResolved).toBe(0);
    expect(m.commits).toBe(0);
    expect(m.medianChangedLines).toBeNull();
    expect(m.medianChangedFiles).toBeNull();
  });

  it('counts issues resolved within the period, grouped by type', () => {
    const m = computeMetrics(
      {
        ...empty,
        issues: [
          { key: 'A-1', type: 'Story', resolvedAt: '2026-02-10T10:00:00Z' },
          { key: 'A-2', type: 'Bug', resolvedAt: '2026-03-01T10:00:00Z' },
          { key: 'A-3', type: 'Bug', resolvedAt: '2026-07-01T10:00:00Z' },
        ],
      },
      period,
    );
    expect(m.issuesResolved).toBe(2);
    expect(m.issuesByType).toEqual({ Story: 1, Bug: 1 });
  });

  it('attributes open and closed PRs by creation date and merged PRs by merge date', () => {
    const m = computeMetrics(
      {
        ...empty,
        changeRequests: [
          { source: 'github', id: '1', state: 'open', createdAt: '2026-02-01T00:00:00Z', mergedAt: null, additions: null, deletions: null, changedFiles: null },
          { source: 'github', id: '2', state: 'closed', createdAt: '2026-02-02T00:00:00Z', mergedAt: null, additions: null, deletions: null, changedFiles: null },
          // Created before the period, merged inside it: counts as merged.
          { source: 'gitlab', id: '3', state: 'merged', createdAt: '2025-12-20T00:00:00Z', mergedAt: '2026-01-15T00:00:00Z', additions: 10, deletions: 2, changedFiles: 1 },
          // Created inside the period, merged after it: does not count as merged.
          { source: 'gitlab', id: '4', state: 'merged', createdAt: '2026-06-01T00:00:00Z', mergedAt: '2026-07-10T00:00:00Z', additions: 50, deletions: 5, changedFiles: 3 },
        ],
      },
      period,
    );
    expect(m.changeRequestsOpen).toBe(1);
    expect(m.changeRequestsClosedUnmerged).toBe(1);
    expect(m.changeRequestsMerged).toBe(1);
  });

  it('computes the median of lines (additions + deletions) and files only over merged PRs', () => {
    const m = computeMetrics(
      {
        ...empty,
        changeRequests: [
          { source: 'github', id: '1', state: 'merged', createdAt: '2026-01-02T00:00:00Z', mergedAt: '2026-01-03T00:00:00Z', additions: 10, deletions: 0, changedFiles: 1 },
          { source: 'github', id: '2', state: 'merged', createdAt: '2026-01-04T00:00:00Z', mergedAt: '2026-01-05T00:00:00Z', additions: 30, deletions: 20, changedFiles: 5 },
          { source: 'github', id: '3', state: 'open', createdAt: '2026-01-06T00:00:00Z', mergedAt: null, additions: 999, deletions: 999, changedFiles: 99 },
        ],
      },
      period,
    );
    expect(m.medianChangedLines).toBe(30);
    expect(m.medianChangedFiles).toBe(3);
  });

  it('sums the commit count within the period', () => {
    const m = computeMetrics(
      {
        ...empty,
        commits: [
          { source: 'github', committedAt: '2026-01-10T00:00:00Z', count: 1 },
          { source: 'gitlab', committedAt: '2026-02-10T00:00:00Z', count: 4 },
          { source: 'gitlab', committedAt: '2026-08-10T00:00:00Z', count: 9 },
        ],
      },
      period,
    );
    expect(m.commits).toBe(5);
  });
});
