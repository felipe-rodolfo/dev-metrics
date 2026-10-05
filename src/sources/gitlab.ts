import type { GitLabConfig } from '../config.js';
import { ChangeRequest, Collected, Commit, Period, isInPeriod, shiftDay, toUtcIso } from '../model.js';
import { getJson, HttpOptions } from '../http.js';
import type { SourceAdapter } from './adapter.js';

interface MergeRequest {
  id: number;
  iid: number;
  project_id: number;
  state: 'opened' | 'merged' | 'closed' | 'locked';
  created_at: string;
  merged_at: string | null;
}

interface PushEvent {
  created_at: string;
  push_data: { commit_count: number; ref_type: string } | null;
}

/**
 * O diff do GitLab não traz cabeçalhos `---`/`+++`, então toda linha
 * começando com `+` ou `-` é conteúdo alterado.
 */
export function countDiffLines(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+')) additions++;
    else if (line.startsWith('-')) deletions++;
  }
  return { additions, deletions };
}

export function createGitLabAdapter(cfg: GitLabConfig, opts: HttpOptions = {}): SourceAdapter {
  const headers = { 'PRIVATE-TOKEN': cfg.token };
  const api = `${cfg.baseUrl}/api/v4`;
  let userId = 0;

  // Percorre todas as páginas usando o cabeçalho x-next-page.
  async function getAllPages<T>(url: string): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    while (page > 0) {
      const separator = url.includes('?') ? '&' : '?';
      const { body, headers: responseHeaders } = await getJson<T[]>(
        `${url}${separator}per_page=100&page=${page}`,
        headers,
        opts,
      );
      items.push(...body);
      const next = responseHeaders.get('x-next-page');
      page = next ? Number(next) : 0;
    }
    return items;
  }

  return {
    name: 'GitLab',

    async identify() {
      const { body } = await getJson<{ id: number }>(`${api}/user`, headers, opts);
      userId = body.id;
    },

    async collect(period: Period): Promise<Collected> {
      // created_before e merged_before são exclusivos, por isso usamos o dia seguinte.
      const createdParams = new URLSearchParams({
        author_id: String(userId),
        scope: 'all',
        created_after: `${period.from}T00:00:00Z`,
        created_before: `${shiftDay(period.to, 1)}T00:00:00Z`,
      });
      const mergedParams = new URLSearchParams({
        author_id: String(userId),
        scope: 'all',
        merged_after: `${period.from}T00:00:00Z`,
        merged_before: `${shiftDay(period.to, 1)}T00:00:00Z`,
      });

      const created = await getAllPages<MergeRequest>(`${api}/merge_requests?${createdParams}`);
      const mergedInPeriod = await getAllPages<MergeRequest>(`${api}/merge_requests?${mergedParams}`);

      const requests = new Map<number, MergeRequest>();
      for (const mergeRequest of [...created, ...mergedInPeriod]) requests.set(mergeRequest.id, mergeRequest);

      const changeRequests: ChangeRequest[] = [];
      for (const mr of requests.values()) {
        const state = mr.state === 'merged' ? 'merged' : mr.state === 'opened' ? 'open' : 'closed';

        let additions: number | null = null;
        let deletions: number | null = null;
        let changedFiles: number | null = null;
        if (state === 'merged' && mr.merged_at && isInPeriod(mr.merged_at, period)) {
          const { body } = await getJson<{ changes: { diff: string }[] }>(
            `${api}/projects/${mr.project_id}/merge_requests/${mr.iid}/changes`,
            headers,
            opts,
          );
          const totals = body.changes.map((change) => countDiffLines(change.diff));
          additions = totals.reduce((sum, t) => sum + t.additions, 0);
          deletions = totals.reduce((sum, t) => sum + t.deletions, 0);
          changedFiles = body.changes.length;
        }

        changeRequests.push({
          source: 'gitlab',
          id: String(mr.id),
          state,
          createdAt: toUtcIso(mr.created_at),
          mergedAt: mr.merged_at ? toUtcIso(mr.merged_at) : null,
          additions,
          deletions,
          changedFiles,
        });
      }

      // Eventos de push trazem a quantidade de commits de cada envio.
      const eventsParams = new URLSearchParams({
        action: 'pushed',
        after: shiftDay(period.from, -1),
        before: shiftDay(period.to, 1),
      });
      const events = await getAllPages<PushEvent>(`${api}/events?${eventsParams}`);
      const commits: Commit[] = events
        .filter((event) => event.push_data !== null)
        .map((event) => ({
          source: 'gitlab',
          committedAt: toUtcIso(event.created_at),
          count: event.push_data?.commit_count ?? 0,
        }));

      return { issues: [], changeRequests, commits };
    },
  };
}
