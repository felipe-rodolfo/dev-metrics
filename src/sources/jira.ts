import type { JiraConfig } from '../config.js';
import { Collected, Issue, Period, shiftDay, toUtcIso } from '../model.js';
import { getJson, HttpOptions } from '../http.js';
import type { SourceAdapter } from './adapter.js';

interface JiraStatus {
  name: string;
  statusCategory: { key: string };
}

interface JiraSearchResponse {
  issues: { key: string; fields: { issuetype: { name: string }; resolutiondate: string } }[];
  nextPageToken?: string;
  isLast?: boolean;
}

export function createJiraAdapter(cfg: JiraConfig, opts: HttpOptions = {}): SourceAdapter {
  const headers = {
    Authorization: `Basic ${Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64')}`,
    Accept: 'application/json',
  };
  const api = `${cfg.baseUrl}/rest/api/3`;

  return {
    name: 'Jira',

    async identify() {
      await getJson(`${api}/myself`, headers, opts);
    },

    async collect(period: Period): Promise<Collected> {
      // Os nomes dos statuses concluídos variam por instância e idioma, então vêm da categoria de cada status.
      const { body: statuses } = await getJson<JiraStatus[]>(`${api}/status`, headers, opts);
      const doneNames = statuses
        .filter((status) => status.statusCategory.key === 'done')
        .map((status) => `"${status.name.replace(/"/g, '\\"')}"`);
      if (doneNames.length === 0) {
        return { issues: [], changeRequests: [], commits: [] };
      }

      // Quem moveu a issue para concluído, independentemente do responsável. O fim do DURING é exclusivo, por isso o dia seguinte.
      const jql = `status CHANGED TO (${doneNames.join(',')}) BY currentUser() DURING ("${period.from}","${shiftDay(period.to, 1)}")`;
      const issues: Issue[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({ jql, fields: 'issuetype,resolutiondate', maxResults: '100' });
        if (pageToken) params.set('nextPageToken', pageToken);

        const { body } = await getJson<JiraSearchResponse>(`${api}/search/jql?${params}`, headers, opts);
        for (const item of body.issues) {
          issues.push({
            key: item.key,
            type: item.fields.issuetype.name,
            resolvedAt: toUtcIso(item.fields.resolutiondate),
          });
        }
        pageToken = body.isLast ? undefined : body.nextPageToken;
      } while (pageToken);

      return { issues, changeRequests: [], commits: [] };
    },
  };
}
