import type { GitHubConfig } from '../config.js';
import { ChangeRequest, Collected, Commit, Period, isInPeriod, toUtcIso } from '../model.js';
import { getJson, HttpOptions } from '../http.js';
import type { SourceAdapter } from './adapter.js';

const PAGE_SIZE = 100;

interface SearchPull {
  html_url: string;
  number: number;
  state: 'open' | 'closed';
  created_at: string;
  repository_url: string;
  pull_request: { merged_at: string | null };
}

interface PullDetail {
  additions: number;
  deletions: number;
  changed_files: number;
}

interface SearchCommit {
  sha: string;
  commit: { committer: { date: string } };
}

export function createGitHubAdapter(cfg: GitHubConfig, opts: HttpOptions = {}): SourceAdapter {
  const headers = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  let login = '';

  async function searchAll<T>(endpoint: string, query: string): Promise<T[]> {
    const items: T[] = [];
    let total = 0;
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ q: query, per_page: String(PAGE_SIZE), page: String(page) });
      const { body } = await getJson<{ total_count: number; items: T[] }>(`${cfg.apiUrl}${endpoint}?${params}`, headers, opts);
      total = body.total_count;
      items.push(...body.items);
      if (body.items.length < PAGE_SIZE) break;
    }
    if (items.length < total) {
      throw new Error(`GitHub caps each search at 1000 results, and this one has ${total}. The report would be incomplete.`);
    }
    return items;
  }

  return {
    name: 'GitHub',

    async identify() {
      const { body } = await getJson<{ login: string }>(`${cfg.apiUrl}/user`, headers, opts);
      login = body.login;
    },

    async collect(period: Period): Promise<Collected> {
      const createdInPeriod = await searchAll<SearchPull>(
        '/search/issues',
        `is:pr author:${login} created:${period.from}..${period.to}`,
      );
      const mergedInPeriod = await searchAll<SearchPull>(
        '/search/issues',
        `is:pr is:merged author:${login} merged:${period.from}..${period.to}`,
      );

      const pulls = new Map<string, SearchPull>();
      for (const item of [...createdInPeriod, ...mergedInPeriod]) pulls.set(item.html_url, item);

      const changeRequests: ChangeRequest[] = [];
      for (const item of pulls.values()) {
        const mergedAt = item.pull_request.merged_at;
        const state = mergedAt ? 'merged' : item.state === 'open' ? 'open' : 'closed';

        let detail: PullDetail | null = null;
        if (mergedAt && isInPeriod(mergedAt, period)) {
          const { body } = await getJson<PullDetail>(`${item.repository_url}/pulls/${item.number}`, headers, opts);
          detail = body;
        }

        changeRequests.push({
          source: 'github',
          id: item.html_url,
          state,
          createdAt: toUtcIso(item.created_at),
          mergedAt: mergedAt ? toUtcIso(mergedAt) : null,
          additions: detail?.additions ?? null,
          deletions: detail?.deletions ?? null,
          changedFiles: detail?.changed_files ?? null,
        });
      }

      const commitItems = await searchAll<SearchCommit>(
        '/search/commits',
        `author:${login} committer-date:${period.from}..${period.to}`,
      );
      const commits: Commit[] = commitItems.map((item) => ({
        source: 'github',
        committedAt: toUtcIso(item.commit.committer.date),
        count: 1,
      }));

      return { issues: [], changeRequests, commits };
    },
  };
}
