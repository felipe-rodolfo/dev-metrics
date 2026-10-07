import ExcelJS from 'exceljs';
import { Period, SourceName, SourceResult } from './model.js';
import { computeMetrics } from './metrics.js';

function addRow(sheet: ExcelJS.Worksheet, label: string, value: number | string | null): void {
  sheet.addRow([label, value]);
}

export function renderWorkbook(period: Period, results: SourceResult[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const resultOf = (name: SourceName) => results.find((r) => r.name === name);

  const jira = resultOf('Jira');
  if (jira) {
    const sheet = workbook.addWorksheet('Jira');
    sheet.addRow(['Metric', 'Value']);
    if (!jira.ok) {
      addRow(sheet, 'Incomplete section', jira.reason);
    } else {
      const metrics = computeMetrics(jira.data, period);
      addRow(sheet, 'Resolved issues', metrics.issuesResolved);
      for (const [type, count] of Object.entries(metrics.issuesByType).sort()) {
        addRow(sheet, `Resolved issues: ${type}`, count);
      }
      addRow(sheet, 'Average story points', metrics.averageStoryPoints);
      addRow(sheet, 'Median story points', metrics.medianStoryPoints);
    }
  }

  for (const name of ['GitHub', 'GitLab'] as const) {
    const result = resultOf(name);
    if (!result) continue;
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(['Metric', 'Value']);
    if (!result.ok) {
      addRow(sheet, 'Incomplete section', result.reason);
      continue;
    }

    const metrics = computeMetrics(result.data, period);
    addRow(sheet, 'Open PRs/MRs', metrics.changeRequestsOpen);
    addRow(sheet, 'Merged PRs/MRs', metrics.changeRequestsMerged);
    addRow(sheet, 'Closed without merge', metrics.changeRequestsClosedUnmerged);
    addRow(sheet, 'Median size (changed lines)', metrics.medianChangedLines);
    addRow(sheet, 'Median size (changed files)', metrics.medianChangedFiles);
    addRow(sheet, 'Commits', metrics.commits);
    addRow(sheet, 'Average cycle time (hours)', metrics.averageCycleTimeHours);
    addRow(sheet, 'Median cycle time (hours)', metrics.medianCycleTimeHours);
    if (result.data.commitsNote) {
      addRow(sheet, 'Incomplete commit count', result.data.commitsNote);
    }
  }

  const sources = workbook.addWorksheet('Sources');
  sources.addRow(['Source', 'Status']);
  for (const result of results) {
    addRow(sources, result.name, result.ok ? 'ok' : `incomplete (${result.reason})`);
  }

  return workbook;
}
