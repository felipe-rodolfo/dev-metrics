import { describe, it, expect } from 'vitest';
import { getJson, AuthError, HttpError } from '../src/http.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const noSleep = async () => {};

describe('getJson', () => {
  it('espera o tempo de Retry-After e tenta de novo após 429', async () => {
    const waits: number[] = [];
    let attempt = 0;
    const { fetch: fetchImpl } = fakeFetch(() => {
      attempt++;
      return attempt === 1
        ? jsonResponse({}, 429, { 'retry-after': '2' })
        : jsonResponse({ ok: true });
    });
    const { body } = await getJson<{ ok: boolean }>('https://api.exemplo.com/x', {}, {
      fetchImpl,
      sleep: async (ms) => { waits.push(ms); },
    });
    expect(body.ok).toBe(true);
    expect(waits).toEqual([2000]);
  });

  it('desiste depois do número máximo de tentativas em 429', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => jsonResponse({}, 429));
    await expect(
      getJson('https://api.exemplo.com/x', {}, { fetchImpl, sleep: noSleep, maxRetries: 2 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('lança AuthError em 401 e 403, com o host e sem o token', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => jsonResponse({}, 401));
    const error = await getJson('https://api.exemplo.com/x?token=segredo', { Authorization: 'Bearer segredo' }, {
      fetchImpl,
      sleep: noSleep,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toContain('api.exemplo.com');
    expect(error.message).not.toContain('segredo');
  });

  it('lança HttpError com o status em outros erros', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => jsonResponse({}, 500));
    const error = await getJson('https://api.exemplo.com/x', {}, { fetchImpl, sleep: noSleep }).catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(500);
  });
});
