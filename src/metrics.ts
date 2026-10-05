import { Collected, Period, isInPeriod } from './model.js';

export interface Metrics {
  issuesResolved: number;
  issuesByType: Record<string, number>;
  changeRequestsOpen: number;
  changeRequestsMerged: number;
  changeRequestsClosedUnmerged: number;
  medianChangedLines: number | null;
  medianChangedFiles: number | null;
  commits: number;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function computeMetrics(data: Collected, period: Period): Metrics {
  const issues = data.issues.filter((issue) => isInPeriod(issue.resolvedAt, period));
  const issuesByType: Record<string, number> = {};
  for (const issue of issues) {
    issuesByType[issue.type] = (issuesByType[issue.type] ?? 0) + 1;
  }

  const changeRequests = data.changeRequests;
  const merged = changeRequests.filter(
    (cr) => cr.state === 'merged' && cr.mergedAt !== null && isInPeriod(cr.mergedAt, period),
  );
  const lines = merged.flatMap((cr) =>
    cr.additions === null || cr.deletions === null ? [] : [cr.additions + cr.deletions],
  );
  const files = merged.flatMap((cr) => (cr.changedFiles === null ? [] : [cr.changedFiles]));

  return {
    issuesResolved: issues.length,
    issuesByType,
    changeRequestsOpen: changeRequests.filter((cr) => cr.state === 'open' && isInPeriod(cr.createdAt, period)).length,
    changeRequestsMerged: merged.length,
    changeRequestsClosedUnmerged: changeRequests.filter(
      (cr) => cr.state === 'closed' && isInPeriod(cr.createdAt, period),
    ).length,
    medianChangedLines: median(lines),
    medianChangedFiles: median(files),
    commits: data.commits
      .filter((commit) => isInPeriod(commit.committedAt, period))
      .reduce((total, commit) => total + commit.count, 0),
  };
}
