import { describe, it, expect } from 'vitest';
import { createJiraAdapter } from '../src/sources/jira.js';
import { AuthError } from '../src/http.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const cfg = { baseUrl: 'https://x.atlassian.net', email: 'ana@example.com', token: 'jira-token' };
const period = { from: '2026-01-01', to: '2026-06-30' };
const issue = (key: string, type: string, resolutiondate: string) => ({
  key,
  fields: { issuetype: { name: type }, resolutiondate },
});
const statuses = [
  { name: 'To Do', statusCategory: { key: 'new' } },
  { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
  { name: 'Done', statusCategory: { key: 'done' } },
];

describe('jira adapter', () => {
  it('identify calls /myself with Basic auth and throws AuthError on 401', async () => {
    const ok = fakeFetch(() => jsonResponse({ accountId: '1' }));
    await createJiraAdapter(cfg, { fetchImpl: ok.fetch }).identify();
    const headers = ok.calls[0].init?.headers as Record<string, string>;
    expect(ok.calls[0].url).toBe('https://x.atlassian.net/rest/api/3/myself');
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('ana@example.com:jira-token').toString('base64')}`);

    const denied = fakeFetch(() => jsonResponse({}, 401));
    await expect(createJiraAdapter(cfg, { fetchImpl: denied.fetch, sleep: async () => {} }).identify()).rejects.toBeInstanceOf(AuthError);
  });

  it('fetches issues the user moved to a done status within the period, regardless of assignee', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch((url) => {
      if (url.includes('/rest/api/3/status')) return jsonResponse(statuses);
      return jsonResponse({ issues: [issue('A-1', 'Story', '2026-02-10T10:00:00.000+0000')], isLast: true });
    });
    await createJiraAdapter(cfg, { fetchImpl }).collect(period);

    const search = calls.find((c) => c.url.includes('/search/jql'))!;
    const jql = new URL(search.url).searchParams.get('jql');
    expect(jql).toBe('status CHANGED TO ("Done") BY currentUser() DURING ("2026-01-01","2026-07-01")');
    expect(jql).not.toContain('assignee');
  });

  it('collect walks every page and returns the issues from each one (review focus 3)', async () => {
    const pages = [
      jsonResponse({ issues: [issue('A-1', 'Story', '2026-02-10T10:00:00.000+0000')], nextPageToken: 'p2', isLast: false }),
      jsonResponse({ issues: [issue('A-2', 'Bug', '2026-06-30T20:00:00.000+0000')], isLast: true }),
    ];
    const { fetch: fetchImpl, calls } = fakeFetch((url) => {
      if (url.includes('/rest/api/3/status')) return jsonResponse(statuses);
      return pages.shift()!;
    });
    const data = await createJiraAdapter(cfg, { fetchImpl }).collect(period);

    expect(data.issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    const searches = calls.filter((c) => c.url.includes('/search/jql'));
    expect(searches).toHaveLength(2);
    expect(searches[1].url).toContain('nextPageToken=p2');
  });

  it('converts resolutiondate from a non-UTC offset (review focus 5)', async () => {
    const { fetch: fetchImpl } = fakeFetch((url) => {
      if (url.includes('/rest/api/3/status')) return jsonResponse(statuses);
      return jsonResponse({ issues: [issue('A-3', 'Task', '2026-03-10T23:30:00.000-0300')], isLast: true });
    });
    const data = await createJiraAdapter(cfg, { fetchImpl }).collect(period);
    expect(data.issues[0].resolvedAt).toBe('2026-03-11T02:30:00.000Z');
  });

  it('does not query issues when the instance has no done status', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch((url) => {
      if (url.includes('/rest/api/3/status')) return jsonResponse([{ name: 'To Do', statusCategory: { key: 'new' } }]);
      return jsonResponse({ issues: [], isLast: true });
    });
    const data = await createJiraAdapter(cfg, { fetchImpl }).collect(period);
    expect(data.issues).toEqual([]);
    expect(calls.some((c) => c.url.includes('/search/jql'))).toBe(false);
  });
});
