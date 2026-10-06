import { Period, SourceName, SourceResult } from './model.js';
import { computeMetrics } from './metrics.js';

function show(value: number | null): string {
  return value === null ? 'no data' : String(value);
}

export function renderReport(period: Period, results: SourceResult[]): string {
  const configured = (name: SourceName) => results.some((result) => result.name === name);
  const resultOf = (name: SourceName) => results.find((r) => r.name === name);

  const lines: string[] = [`# Metrics report: ${period.from} to ${period.to}`, ''];

  if (configured('Jira')) {
    lines.push('## Jira deliveries', '');
    const jira = resultOf('Jira');
    if (jira && !jira.ok) {
      lines.push(`> **Incomplete section:** ${jira.reason}`, '');
    } else if (jira?.ok) {
      const metrics = computeMetrics(jira.data, period);
      lines.push(`- Resolved issues: ${metrics.issuesResolved}`);
      for (const [type, count] of Object.entries(metrics.issuesByType).sort()) {
        lines.push(`  - ${type}: ${count}`);
      }
      lines.push('');
    }
  }

  for (const name of ['GitHub', 'GitLab'] as const) {
    if (!configured(name)) continue;
    lines.push(`## Code activity: ${name}`, '');
    const result = resultOf(name);
    if (!result || !result.ok) {
      lines.push(`> **Incomplete section:** ${result && !result.ok ? result.reason : 'no response'}`, '');
      continue;
    }

    const metrics = computeMetrics(result.data, period);
    lines.push(
      `- Open PRs/MRs in period: ${metrics.changeRequestsOpen}`,
      `- Merged PRs/MRs in period: ${metrics.changeRequestsMerged}`,
      `- Closed without merge in period: ${metrics.changeRequestsClosedUnmerged}`,
      `- Median size in changed lines: ${show(metrics.medianChangedLines)}`,
      `- Median size in changed files: ${show(metrics.medianChangedFiles)}`,
      `- Commits: ${metrics.commits}`,
      '',
    );
    if (result.data.commitsNote) {
      lines.push(`> **Incomplete commit count:** ${result.data.commitsNote}`, '');
    }
  }

  lines.push('## Sources', '');
  for (const result of results) {
    lines.push(result.ok ? `- ${result.name}: ok` : `- ${result.name}: incomplete (${result.reason})`);
  }

  return `${lines.join('\n')}\n`;
}
