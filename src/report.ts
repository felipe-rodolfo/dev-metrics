import { Period, SourceName, SourceResult } from './model.js';
import { Metrics } from './metrics.js';

function show(value: number | null): string {
  return value === null ? 'sem dados' : String(value);
}

export function renderReport(period: Period, metrics: Metrics, results: SourceResult[]): string {
  const configured = (name: SourceName) => results.some((result) => result.name === name);
  const failureOf = (name: SourceName): string | null => {
    const result = results.find((r) => r.name === name);
    return result && !result.ok ? result.reason : null;
  };

  const lines: string[] = [`# Relatório de métricas: ${period.from} a ${period.to}`, ''];

  if (configured('Jira')) {
    lines.push('## Entregas no Jira', '');
    const failure = failureOf('Jira');
    if (failure) {
      lines.push(`> **Seção incompleta:** ${failure}`, '');
    } else {
      lines.push(`- Issues concluídas: ${metrics.issuesResolved}`);
      for (const [type, count] of Object.entries(metrics.issuesByType).sort()) {
        lines.push(`  - ${type}: ${count}`);
      }
      lines.push('');
    }
  }

  if (configured('GitHub') || configured('GitLab')) {
    lines.push('## Atividade de código', '');
    const codeFailures = (['GitHub', 'GitLab'] as const).flatMap((name) => {
      const reason = failureOf(name);
      return reason ? [`${name}: ${reason}`] : [];
    });
    if (codeFailures.length > 0) {
      lines.push(`> **Seção incompleta:** ${codeFailures.join('; ')}`, '');
    }
    lines.push(
      `- PRs/MRs abertos no período: ${metrics.changeRequestsOpen}`,
      `- PRs/MRs mergeados no período: ${metrics.changeRequestsMerged}`,
      `- PRs/MRs fechados sem merge no período: ${metrics.changeRequestsClosedUnmerged}`,
      `- Tamanho mediano em linhas alteradas: ${show(metrics.medianChangedLines)}`,
      `- Tamanho mediano em arquivos alterados: ${show(metrics.medianChangedFiles)}`,
      `- Commits: ${metrics.commits}`,
      '',
    );
  }

  lines.push('## Fontes', '');
  for (const result of results) {
    lines.push(result.ok ? `- ${result.name}: ok` : `- ${result.name}: incompleta (${result.reason})`);
  }

  return `${lines.join('\n')}\n`;
}
