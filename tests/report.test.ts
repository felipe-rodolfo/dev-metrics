import { describe, it, expect } from 'vitest';
import { renderReport } from '../src/report.js';
import type { Collected, SourceResult } from '../src/model.js';

const period = { from: '2026-01-01', to: '2026-06-30' };
const emptyData: Collected = { issues: [], changeRequests: [], commits: [] };

// Texto de uma seção `## <título>` até a próxima seção de nível 2.
function section(report: string, title: string): string {
  const start = report.indexOf(`## ${title}`);
  if (start === -1) return '';
  const next = report.indexOf('\n## ', start + 1);
  return report.slice(start, next === -1 ? undefined : next);
}

describe('renderReport', () => {
  it('mostra o título com o período', () => {
    const ok: SourceResult[] = [{ ok: true, name: 'Jira', data: emptyData }];
    expect(renderReport(period, ok)).toContain('# Relatório de métricas: 2026-01-01 a 2026-06-30');
  });

  it('marca a seção do Jira como incompleta com o motivo', () => {
    const results: SourceResult[] = [{ ok: false, name: 'Jira', reason: 'HTTP 500 em x.atlassian.net' }];
    const report = renderReport(period, results);
    expect(report).toContain('Seção incompleta');
    expect(report).toContain('HTTP 500 em x.atlassian.net');
    expect(report).toContain('- Jira: incompleta (HTTP 500 em x.atlassian.net)');
  });

  it('mostra "sem dados" quando não há PR mergeado no período', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    expect(renderReport(period, results)).toContain('Tamanho mediano em linhas alteradas: sem dados');
  });

  it('não mostra seções de fontes que não foram configuradas', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    const report = renderReport(period, results);
    expect(report).not.toContain('## Entregas no Jira');
    expect(report).toContain('## Atividade de código: GitHub');
    expect(report).not.toContain('## Atividade de código: GitLab');
  });

  it('avisa que a contagem de commits está incompleta quando uma fonte sinaliza isso', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'GitLab', data: { ...emptyData, commitsNote: 'bulk push sem contagem' } },
    ];
    expect(renderReport(period, results)).toContain('**Contagem de commits incompleta:** bulk push sem contagem');
  });

  it('separa GitHub e GitLab, cada um com as próprias métricas', () => {
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
    const github = section(report, 'Atividade de código: GitHub');
    const gitlab = section(report, 'Atividade de código: GitLab');

    expect(github).toContain('PRs/MRs mergeados no período: 1');
    expect(github).toContain('Commits: 7');
    expect(gitlab).toContain('PRs/MRs mergeados no período: 0');
    expect(gitlab).toContain('Commits: 2');
    expect(report).not.toContain('Atividade de código: GitHub + GitLab');
  });

  it('mostra a falha de uma fonte só na seção dela, mantendo as métricas da outra', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'GitHub', data: { ...emptyData, commits: [{ source: 'github', committedAt: '2026-02-01T00:00:00Z', count: 4 }] } },
      { ok: false, name: 'GitLab', reason: 'HTTP 403 em gitlab.com' },
    ];
    const report = renderReport(period, results);
    const gitlab = section(report, 'Atividade de código: GitLab');
    const github = section(report, 'Atividade de código: GitHub');

    expect(gitlab).toContain('> **Seção incompleta:** HTTP 403 em gitlab.com');
    expect(gitlab).not.toContain('Commits:');
    expect(github).toContain('Commits: 4');
    expect(github).not.toContain('Seção incompleta');
  });
});
