import { describe, it, expect } from 'vitest';
import { renderReport } from '../src/report.js';
import { computeMetrics } from '../src/metrics.js';
import type { SourceResult } from '../src/model.js';

const period = { from: '2026-01-01', to: '2026-06-30' };
const emptyData = { issues: [], changeRequests: [], commits: [] };
const metrics = computeMetrics(emptyData, period);

describe('renderReport', () => {
  it('mostra o título com o período', () => {
    const ok: SourceResult[] = [{ ok: true, name: 'Jira', data: emptyData }];
    expect(renderReport(period, metrics, ok)).toContain('# Relatório de métricas: 2026-01-01 a 2026-06-30');
  });

  it('marca a seção do Jira como incompleta com o motivo', () => {
    const results: SourceResult[] = [{ ok: false, name: 'Jira', reason: 'HTTP 500 em x.atlassian.net' }];
    const report = renderReport(period, metrics, results);
    expect(report).toContain('Seção incompleta');
    expect(report).toContain('HTTP 500 em x.atlassian.net');
    expect(report).toContain('- Jira: incompleta (HTTP 500 em x.atlassian.net)');
  });

  it('mostra "sem dados" quando não há PR mergeado no período', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    expect(renderReport(period, metrics, results)).toContain('Tamanho mediano em linhas alteradas: sem dados');
  });

  it('avisa que a contagem de commits está incompleta quando uma fonte sinaliza isso', () => {
    const results: SourceResult[] = [
      { ok: true, name: 'GitLab', data: { ...emptyData, commitsNote: 'bulk push sem contagem' } },
    ];
    expect(renderReport(period, metrics, results)).toContain('**Contagem de commits incompleta:** bulk push sem contagem');
  });

  it('não mostra seções de fontes que não foram configuradas', () => {
    const results: SourceResult[] = [{ ok: true, name: 'GitHub', data: emptyData }];
    const report = renderReport(period, metrics, results);
    expect(report).not.toContain('## Entregas no Jira');
    expect(report).toContain('## Atividade de código');
  });
});
