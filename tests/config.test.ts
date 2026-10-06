import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../src/config.js';

const base = ['--from', '2026-01-01', '--to', '2026-06-30'];

describe('loadConfig', () => {
  it('rejeita datas fora do formato', () => {
    expect(() => loadConfig(['--from', '01/01/2026', '--to', '2026-06-30'], { GITHUB_TOKEN: 'x' })).toThrow(ConfigError);
  });

  it('rejeita --from depois de --to', () => {
    expect(() => loadConfig(['--from', '2026-07-01', '--to', '2026-06-30'], { GITHUB_TOKEN: 'x' })).toThrow(/--from/);
  });

  it('falha quando nenhum token está definido', () => {
    expect(() => loadConfig(base, {})).toThrow(/Nenhum token/);
  });

  it('monta apenas as fontes cujo token está definido', () => {
    const config = loadConfig(base, { GITHUB_TOKEN: 'gh' });
    expect(config.github).toEqual({ apiUrl: 'https://api.github.com', token: 'gh' });
    expect(config.jira).toBeUndefined();
    expect(config.gitlab).toBeUndefined();
  });

  it('remove barras finais das URLs', () => {
    const config = loadConfig(base, {
      JIRA_API_TOKEN: 't',
      JIRA_EMAIL: 'a@exemplo.com',
      JIRA_BASE_URL: 'https://x.atlassian.net/',
      GITLAB_TOKEN: 'g',
      GITLAB_BASE_URL: 'https://gitlab.exemplo.com/',
    });
    expect(config.jira?.baseUrl).toBe('https://x.atlassian.net');
    expect(config.gitlab?.baseUrl).toBe('https://gitlab.exemplo.com');
  });

  it('exige e-mail e URL do Jira quando o token do Jira está definido', () => {
    expect(() => loadConfig(base, { JIRA_API_TOKEN: 't' })).toThrow(ConfigError);
  });

  it('usa ./reports como pasta de saída padrão', () => {
    expect(loadConfig(base, { GITHUB_TOKEN: 'x' }).outDir).toBe('./reports');
  });
});
