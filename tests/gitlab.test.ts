import { describe, it, expect } from 'vitest';
import { createGitLabAdapter, countDiffLines } from '../src/sources/gitlab.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const cfg = { baseUrl: 'https://gitlab.exemplo.com', token: 'gl-token' };
const period = { from: '2026-01-01', to: '2026-06-30' };

const mr = (iid: number, state: string, createdAt: string, mergedAt: string | null) => ({
  id: 1000 + iid,
  iid,
  project_id: 42,
  state,
  created_at: createdAt,
  merged_at: mergedAt,
});

describe('countDiffLines', () => {
  it('conta linhas adicionadas e removidas, ignorando o contexto', () => {
    const diff = '@@ -1,2 +1,2 @@\n contexto\n-antiga\n+nova\n+extra\n';
    expect(countDiffLines(diff)).toEqual({ additions: 2, deletions: 1 });
  });
});

describe('gitlab adapter', () => {
  it('identify usa /user com PRIVATE-TOKEN', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch(() => jsonResponse({ id: 7, username: 'ana' }));
    await createGitLabAdapter(cfg, { fetchImpl }).identify();
    expect(calls[0].url).toBe('https://gitlab.exemplo.com/api/v4/user');
    expect((calls[0].init?.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('gl-token');
  });

  it('mapeia estados das MRs e calcula o tamanho só das mergeadas (review focus 5)', async () => {
    const { fetch: fetchImpl } = fakeFetch((url) => {
      if (url.endsWith('/api/v4/user')) return jsonResponse({ id: 7, username: 'ana' });
      if (url.includes('/merge_requests?') && url.includes('created_after')) {
        return jsonResponse([
          mr(1, 'opened', '2026-02-01T00:00:00.000+00:00', null),
          mr(2, 'closed', '2026-02-02T00:00:00.000+00:00', null),
          mr(3, 'merged', '2026-02-03T00:00:00.000+00:00', '2026-02-10T00:00:00.000+00:00'),
        ]);
      }
      if (url.includes('/merge_requests?') && url.includes('merged_after')) {
        return jsonResponse([mr(4, 'merged', '2025-12-01T00:00:00.000+00:00', '2026-01-20T00:00:00.000+00:00')]);
      }
      if (url.endsWith('/merge_requests/3/changes')) {
        return jsonResponse({ changes: [{ diff: '+a\n+b\n-c\n' }, { diff: '+d\n' }] });
      }
      if (url.endsWith('/merge_requests/4/changes')) {
        return jsonResponse({ changes: [{ diff: '+x\n' }] });
      }
      return jsonResponse([]);
    });

    const data = await createGitLabAdapter(cfg, { fetchImpl }).collect(period);
    expect(data.changeRequests).toHaveLength(4);
    expect(data.changeRequests.find((c) => c.state === 'open')).toBeDefined();
    expect(data.changeRequests.find((c) => c.state === 'closed')).toBeDefined();
    const mergedThree = data.changeRequests.find((c) => c.mergedAt === '2026-02-10T00:00:00.000Z');
    expect(mergedThree?.additions).toBe(3);
    expect(mergedThree?.deletions).toBe(1);
    expect(mergedThree?.changedFiles).toBe(2);
  });

  it('soma commits dos eventos de push e pagina com x-next-page (review focus 3)', async () => {
    const pages = [
      { body: [{ created_at: '2026-02-01T10:00:00.000+00:00', action_name: 'pushed to', push_data: { commit_count: 3, ref_type: 'branch' } }], headers: { 'x-next-page': '2' } },
      { body: [{ created_at: '2026-03-01T10:00:00.000+00:00', action_name: 'pushed to', push_data: { commit_count: 2, ref_type: 'branch' } }], headers: { 'x-next-page': '' } },
    ];
    const { fetch: fetchImpl, calls } = fakeFetch((url) => {
      if (url.endsWith('/api/v4/user')) return jsonResponse({ id: 7, username: 'ana' });
      if (url.includes('/events')) {
        const page = pages.shift()!;
        return jsonResponse(page.body, 200, page.headers);
      }
      return jsonResponse([]);
    });

    const data = await createGitLabAdapter(cfg, { fetchImpl }).collect(period);
    expect(data.commits.reduce((total, c) => total + c.count, 0)).toBe(5);
    expect(calls.filter((c) => c.url.includes('/events'))).toHaveLength(2);
    const eventsUrl = new URL(calls.find((c) => c.url.includes('/events'))!.url);
    expect(eventsUrl.searchParams.get('before')).toBe('2026-07-01');
  });
});
