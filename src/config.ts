import { Period, isValidDay } from './model.js';

export interface JiraConfig {
  baseUrl: string;
  email: string;
  token: string;
  storyPointsField?: string;
}

export interface GitHubConfig {
  apiUrl: string;
  token: string;
}

export interface GitLabConfig {
  baseUrl: string;
  token: string;
}

export interface Config {
  period: Period;
  outDir: string;
  jira: JiraConfig;
  github?: GitHubConfig;
  gitlab?: GitLabConfig;
}

export class ConfigError extends Error {}

export function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export interface CliOptions {
  from?: string;
  to?: string;
  out?: string;
}

export function loadConfig(options: CliOptions, env: NodeJS.ProcessEnv): Config {
  const { from, to } = options;
  if (!from || !to || !isValidDay(from) || !isValidDay(to)) {
    throw new ConfigError('Provide --from and --to in the format YYYY-MM-DD.');
  }
  if (from > to) {
    throw new ConfigError('--from cannot be after --to.');
  }

  if (!env.JIRA_API_TOKEN || !env.JIRA_BASE_URL || !env.JIRA_EMAIL) {
    throw new ConfigError('Jira is required. Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.');
  }
  const config: Config = {
    period: { from, to },
    outDir: options.out ?? './reports',
    jira: {
      baseUrl: stripSlash(env.JIRA_BASE_URL),
      email: env.JIRA_EMAIL,
      token: env.JIRA_API_TOKEN,
      ...(env.JIRA_STORY_POINTS_FIELD ? { storyPointsField: env.JIRA_STORY_POINTS_FIELD } : {}),
    },
  };

  if (env.GITHUB_TOKEN) {
    config.github = {
      apiUrl: stripSlash(env.GITHUB_API_URL ?? 'https://api.github.com'),
      token: env.GITHUB_TOKEN,
    };
  }

  if (env.GITLAB_TOKEN) {
    if (!env.GITLAB_BASE_URL) {
      throw new ConfigError('GITLAB_TOKEN requires GITLAB_BASE_URL.');
    }
    config.gitlab = { baseUrl: stripSlash(env.GITLAB_BASE_URL), token: env.GITLAB_TOKEN };
  }

  if (!config.github && !config.gitlab) {
    throw new ConfigError('Set GITHUB_TOKEN and/or GITLAB_TOKEN. At least one code source is required.');
  }

  return config;
}
