import { Period, isValidDay } from './model.js';

export interface JiraConfig {
  baseUrl: string;
  email: string;
  token: string;
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

function readArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

export function loadConfig(argv: string[], env: NodeJS.ProcessEnv): Config {
  const from = readArg(argv, 'from');
  const to = readArg(argv, 'to');
  if (!from || !to || !isValidDay(from) || !isValidDay(to)) {
    throw new ConfigError('Informe --from e --to no formato AAAA-MM-DD.');
  }
  if (from > to) {
    throw new ConfigError('--from não pode ser depois de --to.');
  }

  if (!env.JIRA_API_TOKEN || !env.JIRA_BASE_URL || !env.JIRA_EMAIL) {
    throw new ConfigError('O Jira é obrigatório. Defina JIRA_BASE_URL, JIRA_EMAIL e JIRA_API_TOKEN.');
  }
  const config: Config = {
    period: { from, to },
    outDir: readArg(argv, 'out') ?? './reports',
    jira: { baseUrl: stripSlash(env.JIRA_BASE_URL), email: env.JIRA_EMAIL, token: env.JIRA_API_TOKEN },
  };

  if (env.GITHUB_TOKEN) {
    config.github = {
      apiUrl: stripSlash(env.GITHUB_API_URL ?? 'https://api.github.com'),
      token: env.GITHUB_TOKEN,
    };
  }

  if (env.GITLAB_TOKEN) {
    if (!env.GITLAB_BASE_URL) {
      throw new ConfigError('GITLAB_TOKEN exige GITLAB_BASE_URL.');
    }
    config.gitlab = { baseUrl: stripSlash(env.GITLAB_BASE_URL), token: env.GITLAB_TOKEN };
  }

  if (!config.github && !config.gitlab) {
    throw new ConfigError('Defina GITHUB_TOKEN e/ou GITLAB_TOKEN. Pelo menos uma fonte de código é obrigatória.');
  }

  return config;
}
