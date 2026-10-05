import type { Config } from '../config.js';
import type { HttpOptions } from '../http.js';
import type { SourceAdapter } from './adapter.js';
import { createJiraAdapter } from './jira.js';
import { createGitHubAdapter } from './github.js';
import { createGitLabAdapter } from './gitlab.js';

export function createAdapters(config: Config, opts: HttpOptions = {}): SourceAdapter[] {
  const adapters: SourceAdapter[] = [];
  if (config.jira) adapters.push(createJiraAdapter(config.jira, opts));
  if (config.github) adapters.push(createGitHubAdapter(config.github, opts));
  if (config.gitlab) adapters.push(createGitLabAdapter(config.gitlab, opts));
  return adapters;
}
