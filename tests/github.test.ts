import { describe, it, expect } from 'vitest';
import { createGitHubAdapter } from '../src/sources/github.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const cfg = { apiUrl: 'https://api.github.com', token: 'gh-token' };
const period = { from: '2026-01-01', to: '2026-06-30' };

const pr = (number: number, state: 'open' | 'closed', mergedAt: string | null, createdAt: string) => ({
  html_url: `https://github.com/acme/app/pull/${number}`,
  number,
  state,
  created_at: createdAt,
  repository_url: 'https://api.github.com/repos/acme/app',
  pull_request: { merged_at: mergedAt },
});

describe('github adapter', () => {
  it('identify usa /user e lança AuthError em 401', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch(() => jsonResponse({ login: 'ana' }));
    await createGitHubAdapter(cfg, { fetchImpl }).identify();
    expect(calls[0].url).toBe('https://api.github.com/user');
  });

  it('classifica PRs e busca tamanho só dos mergeados dentro do período (review focus 2)', async () => {
    const { fetch: fetchImpl, calls } = fakeFetch((url) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'ana' });
      if (url.includes('/search/issues') && url.includes('created')) {
        return jsonResponse({
          total_count: 3,
          items: [
            pr(1, 'open', null, '2026-02-01T00:00:00Z'),
            pr(2, 'closed', null, '2026-02-02T00:00:00Z'),
            pr(3, 'closed', '2026-03-01T00:00:00Z', '2026-02-03T00:00:00Z'),
          ],
        });
      }
      if (url.includes('/search/issues') && url.includes('merged')) {
        // Criado antes do período, mergeado dentro dele.
        return jsonResponse({ total_count: 1, items: [pr(4, 'closed', '2026-01-15T00:00:00Z', '2025-12-01T00:00:00Z')] });
      }
      if (url.includes('/search/commits')) {
        return jsonResponse({ total_count: 1, items: [{ sha: 'abc', commit: { committer: { date: '2026-06-30T23:00:00Z' } } }] });
      }
      if (url.endsWith('/pulls/3') || url.endsWith('/pulls/4')) {
        const n = url.endsWith('/pulls/3') ? 3 : 4;
        return jsonResponse({ additions: n * 10, deletions: 1, changed_files: n });
      }
      return jsonResponse({ total_count: 0, items: [] });
    });

    const data = await createGitHubAdapter(cfg, { fetchImpl }).collect(period);

    const byNumber = Object.fromEntries(data.changeRequests.map((c) => [c.id.split('/').pop(), c]));
    expect(byNumber['1'].state).toBe('open');
    expect(byNumber['2'].state).toBe('closed');
    expect(byNumber['3'].state).toBe('merged');
    expect(byNumber['3'].additions).toBe(30);
    expect(byNumber['4'].state).toBe('merged');
    expect(byNumber['4'].changedFiles).toBe(4);

    const pullDetails = calls.filter((c) => c.url.includes('/pulls/')).map((c) => c.url);
    expect(pullDetails).toHaveLength(2);

    expect(data.commits).toEqual([{ source: 'github', committedAt: '2026-06-30T23:00:00.000Z', count: 1 }]);
  });

  it('pagina a pesquisa quando há mais de uma página (review focus 3)', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ sha: `s${i}`, commit: { committer: { date: '2026-02-01T00:00:00Z' } } }));
    const secondPage = [{ sha: 'last', commit: { committer: { date: '2026-02-02T00:00:00Z' } } }];
    const pages = [{ total_count: 101, items: firstPage }, { total_count: 101, items: secondPage }];
    const { fetch: fetchImpl, calls } = fakeFetch((url) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'ana' });
      if (url.includes('/search/commits')) return jsonResponse(pages.shift()!);
      return jsonResponse({ total_count: 0, items: [] });
    });

    const data = await createGitHubAdapter(cfg, { fetchImpl }).collect(period);
    expect(data.commits).toHaveLength(101);
    expect(calls.filter((c) => c.url.includes('/search/commits'))).toHaveLength(2);
  });

  it('falha em vez de contar a menos quando a busca passa do limite de 1000 resultados', async () => {
    const { fetch: fetchImpl } = fakeFetch((url) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'ana' });
      if (url.includes('/search/commits')) {
        const page = Number(new URL(url).searchParams.get('page'));
        const items = page <= 10
          ? Array.from({ length: 100 }, (_, i) => ({ sha: `s${page}-${i}`, commit: { committer: { date: '2026-02-01T00:00:00Z' } } }))
          : [];
        return jsonResponse({ total_count: 1500, items });
      }
      return jsonResponse({ total_count: 0, items: [] });
    });

    await expect(createGitHubAdapter(cfg, { fetchImpl }).collect(period)).rejects.toThrow(/1000 resultados/);
  });
});
