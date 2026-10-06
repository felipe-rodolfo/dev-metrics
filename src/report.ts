import { Period, SourceName, SourceResult } from './model.js';
import { computeMetrics } from './metrics.js';

function show(value: number | null): string {
  return value === null ? 'sem dados' : String(value);
}

export function renderReport(period: Period, results: SourceResult[]): string {
  const configured = (name: SourceName) => results.some((result) => result.name === name);
  const resultOf = (name: SourceName) => results.find((r) => r.name === name);

  const lines: string[] = [`# Relatório de métricas: ${period.from} a ${period.to}`, ''];

  if (configured('Jira')) {
    lines.push('## Entregas no Jira', '');
    const jira = resultOf('Jira');
    if (jira && !jira.ok) {
      lines.push(`> **Seção incompleta:** ${jira.reason}`, '');
    } else if (jira?.ok) {
      const metrics = computeMetrics(jira.data, period);
      lines.push(`- Issues concluídas: ${metrics.issuesResolved}`);
      for (const [type, count] of Object.entries(metrics.issuesByType).sort()) {
        lines.push(`  - ${type}: ${count}`);
      }
      lines.push('');
    }
  }

  for (const name of ['GitHub', 'GitLab'] as const) {
    if (!configured(name)) continue;
    lines.push(`## Atividade de código: ${name}`, '');
    const result = resultOf(name);
    if (!result || !result.ok) {
      lines.push(`> **Seção incompleta:** ${result && !result.ok ? result.reason : 'sem resposta'}`, '');
      continue;
    }

    const metrics = computeMetrics(result.data, period);
    lines.push(
      `- PRs/MRs abertos no período: ${metrics.changeRequestsOpen}`,
      `- PRs/MRs mergeados no período: ${metrics.changeRequestsMerged}`,
      `- PRs/MRs fechados sem merge no período: ${metrics.changeRequestsClosedUnmerged}`,
      `- Tamanho mediano em linhas alteradas: ${show(metrics.medianChangedLines)}`,
      `- Tamanho mediano em arquivos alterados: ${show(metrics.medianChangedFiles)}`,
      `- Commits: ${metrics.commits}`,
      '',
    );
    if (result.data.commitsNote) {
      lines.push(`> **Contagem de commits incompleta:** ${result.data.commitsNote}`, '');
    }
  }

  lines.push('## Fontes', '');
  for (const result of results) {
    lines.push(result.ok ? `- ${result.name}: ok` : `- ${result.name}: incompleta (${result.reason})`);
  }

  return `${lines.join('\n')}\n`;
}
