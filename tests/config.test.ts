import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../src/config.js';

const base = ['--from', '2026-01-01', '--to', '2026-06-30'];
const jira = {
  JIRA_API_TOKEN: 't',
  JIRA_EMAIL: 'a@example.com',
  JIRA_BASE_URL: 'https://x.atlassian.net',
};

describe('loadConfig', () => {
  it('rejects dates outside the expected format', () => {
    expect(() => loadConfig(['--from', '01/01/2026', '--to', '2026-06-30'], { ...jira, GITHUB_TOKEN: 'x' })).toThrow(ConfigError);
  });

  it('rejects --from after --to', () => {
    expect(() => loadConfig(['--from', '2026-07-01', '--to', '2026-06-30'], { ...jira, GITHUB_TOKEN: 'x' })).toThrow(/--from/);
  });

  it('requires Jira even when GitHub and GitLab are configured', () => {
    expect(() => loadConfig(base, { GITHUB_TOKEN: 'gh', GITLAB_TOKEN: 'gl', GITLAB_BASE_URL: 'https://gitlab.com' })).toThrow(/Jira/);
  });

  it('requires GitHub or GitLab even when Jira is configured', () => {
    expect(() => loadConfig(base, jira)).toThrow(/GITHUB_TOKEN and\/or GITLAB_TOKEN/);
  });

  it('accepts GitHub alone together with Jira', () => {
    const config = loadConfig(base, { ...jira, GITHUB_TOKEN: 'gh' });
    expect(config.jira.baseUrl).toBe('https://x.atlassian.net');
    expect(config.github).toEqual({ apiUrl: 'https://api.github.com', token: 'gh' });
    expect(config.gitlab).toBeUndefined();
  });

  it('accepts GitLab alone together with Jira', () => {
    const config = loadConfig(base, { ...jira, GITLAB_TOKEN: 'gl', GITLAB_BASE_URL: 'https://gitlab.com' });
    expect(config.gitlab).toEqual({ baseUrl: 'https://gitlab.com', token: 'gl' });
    expect(config.github).toBeUndefined();
  });

  it('strips trailing slashes from URLs', () => {
    const config = loadConfig(base, {
      ...jira,
      JIRA_BASE_URL: 'https://x.atlassian.net/',
      GITLAB_TOKEN: 'g',
      GITLAB_BASE_URL: 'https://gitlab.example.com/',
    });
    expect(config.jira.baseUrl).toBe('https://x.atlassian.net');
    expect(config.gitlab?.baseUrl).toBe('https://gitlab.example.com');
  });

  it('requires the Jira email and base URL', () => {
    expect(() => loadConfig(base, { JIRA_API_TOKEN: 't', GITHUB_TOKEN: 'gh' })).toThrow(ConfigError);
  });

  it('requires GITLAB_BASE_URL when the GitLab token is set', () => {
    expect(() => loadConfig(base, { ...jira, GITLAB_TOKEN: 'gl' })).toThrow(/GITLAB_BASE_URL/);
  });

  it('uses the public GitHub API and ./reports as the default output folder', () => {
    const config = loadConfig(base, { ...jira, GITHUB_TOKEN: 'x' });
    expect(config.github?.apiUrl).toBe('https://api.github.com');
    expect(config.outDir).toBe('./reports');
  });
});
