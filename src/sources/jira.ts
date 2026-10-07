import type { JiraConfig } from '../config.js';
import { Collected, Issue, Period, shiftDay, toUtcIso } from '../model.js';
import { getJson, HttpOptions } from '../http.js';
import type { SourceAdapter } from './adapter.js';

interface JiraStatus {
  name: string;
  statusCategory: { key: string };
}

interface JiraField {
  id: string;
  name: string;
}

interface JiraSearchResponse {
  issues: {
    key: string;
    fields: { issuetype: { name: string }; resolutiondate: string } & Record<string, unknown>;
  }[];
  nextPageToken?: string;
  isLast?: boolean;
}

const STORY_POINTS_FIELD_NAME = /^story points?( estimate)?$/i;

async function resolveStoryPointsField(
  cfg: JiraConfig,
  api: string,
  headers: Record<string, string>,
  opts: HttpOptions,
): Promise<string | null> {
  if (cfg.storyPointsField) return cfg.storyPointsField;
  const { body: fields } = await getJson<JiraField[]>(`${api}/field`, headers, opts);
  return fields.find((field) => STORY_POINTS_FIELD_NAME.test(field.name))?.id ?? null;
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
      const { body: statuses } = await getJson<JiraStatus[]>(`${api}/status`, headers, opts);
      const doneNames = statuses
        .filter((status) => status.statusCategory.key === 'done')
        .map((status) => `"${status.name.replace(/"/g, '\\"')}"`);
      if (doneNames.length === 0) {
        return { issues: [], changeRequests: [], commits: [] };
      }

      const jql = `status CHANGED TO (${doneNames.join(',')}) BY currentUser() DURING ("${period.from}","${shiftDay(period.to, 1)}")`;
      const storyPointsField = await resolveStoryPointsField(cfg, api, headers, opts);
      const fields = ['issuetype', 'resolutiondate', ...(storyPointsField ? [storyPointsField] : [])].join(',');
      const issues: Issue[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({ jql, fields, maxResults: '100' });
        if (pageToken) params.set('nextPageToken', pageToken);

        const { body } = await getJson<JiraSearchResponse>(`${api}/search/jql?${params}`, headers, opts);
        for (const item of body.issues) {
          const rawStoryPoints = storyPointsField ? item.fields[storyPointsField] : null;
          issues.push({
            key: item.key,
            type: item.fields.issuetype.name,
            resolvedAt: toUtcIso(item.fields.resolutiondate),
            storyPoints: typeof rawStoryPoints === 'number' ? rawStoryPoints : null,
          });
        }
        pageToken = body.isLast ? undefined : body.nextPageToken;
      } while (pageToken);

      return { issues, changeRequests: [], commits: [] };
    },
  };
}
