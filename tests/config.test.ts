import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../src/config.js';

const base = ['--from', '2026-01-01', '--to', '2026-06-30'];
const jira = {
  JIRA_API_TOKEN: 't',
  JIRA_EMAIL: 'a@exemplo.com',
  JIRA_BASE_URL: 'https://x.atlassian.net',
};

describe('loadConfig', () => {
  it('rejeita datas fora do formato', () => {
    expect(() => loadConfig(['--from', '01/01/2026', '--to', '2026-06-30'], { ...jira, GITHUB_TOKEN: 'x' })).toThrow(ConfigError);
  });

  it('rejeita --from depois de --to', () => {
    expect(() => loadConfig(['--from', '2026-07-01', '--to', '2026-06-30'], { ...jira, GITHUB_TOKEN: 'x' })).toThrow(/--from/);
  });

  it('exige o Jira, mesmo quando GitHub e GitLab estão configurados', () => {
    expect(() => loadConfig(base, { GITHUB_TOKEN: 'gh', GITLAB_TOKEN: 'gl', GITLAB_BASE_URL: 'https://gitlab.com' })).toThrow(/Jira/);
  });

  it('exige GitHub ou GitLab, mesmo com o Jira configurado', () => {
    expect(() => loadConfig(base, jira)).toThrow(/GITHUB_TOKEN e\/ou GITLAB_TOKEN/);
  });

  it('aceita só GitHub junto com o Jira', () => {
    const config = loadConfig(base, { ...jira, GITHUB_TOKEN: 'gh' });
    expect(config.jira.baseUrl).toBe('https://x.atlassian.net');
    expect(config.github).toEqual({ apiUrl: 'https://api.github.com', token: 'gh' });
    expect(config.gitlab).toBeUndefined();
  });

  it('aceita só GitLab junto com o Jira', () => {
    const config = loadConfig(base, { ...jira, GITLAB_TOKEN: 'gl', GITLAB_BASE_URL: 'https://gitlab.com' });
    expect(config.gitlab).toEqual({ baseUrl: 'https://gitlab.com', token: 'gl' });
    expect(config.github).toBeUndefined();
  });

  it('remove barras finais das URLs', () => {
    const config = loadConfig(base, {
      ...jira,
      JIRA_BASE_URL: 'https://x.atlassian.net/',
      GITLAB_TOKEN: 'g',
      GITLAB_BASE_URL: 'https://gitlab.exemplo.com/',
    });
    expect(config.jira.baseUrl).toBe('https://x.atlassian.net');
    expect(config.gitlab?.baseUrl).toBe('https://gitlab.exemplo.com');
  });

  it('exige e-mail e URL do Jira', () => {
    expect(() => loadConfig(base, { JIRA_API_TOKEN: 't', GITHUB_TOKEN: 'gh' })).toThrow(ConfigError);
  });

  it('exige GITLAB_BASE_URL quando o token do GitLab está definido', () => {
    expect(() => loadConfig(base, { ...jira, GITLAB_TOKEN: 'gl' })).toThrow(/GITLAB_BASE_URL/);
  });

  it('usa a API pública do GitHub por padrão e ./reports como pasta de saída', () => {
    const config = loadConfig(base, { ...jira, GITHUB_TOKEN: 'x' });
    expect(config.github?.apiUrl).toBe('https://api.github.com');
    expect(config.outDir).toBe('./reports');
  });
});
