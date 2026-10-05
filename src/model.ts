export interface Period {
  /** Primeiro dia do intervalo, AAAA-MM-DD, inclusivo. */
  from: string;
  /** Último dia do intervalo, AAAA-MM-DD, inclusivo. */
  to: string;
}

export interface Issue {
  key: string;
  type: string;
  /** Data de resolução em UTC, ISO 8601. */
  resolvedAt: string;
}

export interface ChangeRequest {
  source: 'github' | 'gitlab';
  /** URL ou identificador único do PR/MR. Usado para remover duplicatas. */
  id: string;
  /** 'closed' significa fechado sem merge. */
  state: 'open' | 'merged' | 'closed';
  createdAt: string;
  mergedAt: string | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}

export interface Commit {
  source: 'github' | 'gitlab';
  committedAt: string;
  /** Quantidade de commits representada por este registro. */
  count: number;
}

export interface Collected {
  issues: Issue[];
  changeRequests: ChangeRequest[];
  commits: Commit[];
}

export type SourceName = 'Jira' | 'GitHub' | 'GitLab';

export type SourceResult =
  | { ok: true; name: SourceName; data: Collected }
  | { ok: false; name: SourceName; reason: string };

export function isValidDay(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toUtcIso(timestamp: string): string {
  return new Date(timestamp).toISOString();
}

export function isInPeriod(timestamp: string, period: Period): boolean {
  const day = timestamp.slice(0, 10);
  return day >= period.from && day <= period.to;
}
