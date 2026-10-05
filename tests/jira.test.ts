import { describe, it, expect } from 'vitest';
import { createJiraAdapter } from '../src/sources/jira.js';
import { AuthError } from '../src/http.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const cfg = { baseUrl: 'https://x.atlassian.net', email: 'ana@exemplo.com', token: 'jira-token' };
const period = { from: '2026-01-01', to: '2026-06-30' };
const issue = (key: string, type: string, resolutiondate: string) => ({
  key,
  fields: { issuetype: { name: type }, resolutiondate },
});

describe('jira adapter', () => {
  it('identify chama /myself com Basic auth e lança AuthError em 401', async () => {
    const ok = fakeFetch(() => jsonResponse({ accountId: '1' }));
    await createJiraAdapter(cfg, { fetchImpl: ok.fetch }).identify();
    const headers = ok.calls[0].init?.headers as Record<string, string>;
    expect(ok.calls[0].url).toBe('https://x.atlassian.net/rest/api/3/myself');
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('ana@exemplo.com:jira-token').toString('base64')}`);

    const denied = fakeFetch(() => jsonResponse({}, 401));
    await expect(createJiraAdapter(cfg, { fetchImpl: denied.fetch, sleep: async () => {} }).identify()).rejects.toBeInstanceOf(AuthError);
  });

  it('collect percorre todas as páginas e inclui o último dia do período na JQL (review focus 2 e 3)', async () => {
    const pages = [
      jsonResponse({ issues: [issue('A-1', 'Story', '2026-02-10T10:00:00.000+0000')], nextPageToken: 'p2', isLast: false }),
      jsonResponse({ issues: [issue('A-2', 'Bug', '2026-06-30T20:00:00.000+0000')], isLast: true }),
    ];
    const { fetch: fetchImpl, calls } = fakeFetch(() => pages.shift()!);
    const data = await createJiraAdapter(cfg, { fetchImpl }).collect(period);

    expect(data.issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain('nextPageToken=p2');
    const jql = new URL(calls[0].url).searchParams.get('jql');
    expect(jql).toContain('resolved >= "2026-01-01"');
    expect(jql).toContain('resolved < "2026-07-01"');
  });

  it('converte resolutiondate com offset diferente de UTC (review focus 5)', async () => {
    const { fetch: fetchImpl } = fakeFetch(() =>
      jsonResponse({ issues: [issue('A-3', 'Task', '2026-03-10T23:30:00.000-0300')], isLast: true }),
    );
    const data = await createJiraAdapter(cfg, { fetchImpl }).collect(period);
    expect(data.issues[0].resolvedAt).toBe('2026-03-11T02:30:00.000Z');
  });
});
