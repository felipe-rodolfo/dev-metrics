export class AuthError extends Error {}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export interface HttpOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function getJson<T>(
  url: string,
  headers: Record<string, string>,
  opts: HttpOptions = {},
): Promise<{ body: T; headers: Headers }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 3;
  const host = new URL(url).host;

  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(url, { headers });

    if (response.status === 429 && attempt < maxRetries) {
      const seconds = Number(response.headers.get('retry-after') ?? '1');
      await sleep((Number.isNaN(seconds) ? 1 : seconds) * 1000);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      throw new AuthError(`HTTP ${response.status} em ${host}: confira o token e a permissão de acesso.`);
    }
    if (!response.ok) {
      throw new HttpError(response.status, `HTTP ${response.status} em ${host}`);
    }
    return { body: (await response.json()) as T, headers: response.headers };
  }
}
