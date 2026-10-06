import { describe, it, expect } from 'vitest';
import { getJson, AuthError, HttpError } from '../src/http.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const noSleep = async () => {};

describe('getJson', () => {
  it('waits for the Retry-After time and retries after a 429', async () => {
    const waits: number[] = [];
    let attempt = 0;
    const { fetch: fetchImpl } = fakeFetch(() => {
      attempt++;
      return attempt === 1
        ? jsonResponse({}, 429, { 'retry-after': '2' })
        : jsonResponse({ ok: true });
    });
    const { body } = await getJson<{ ok: boolean }>('https://api.example.com/x', {}, {
      fetchImpl,
      sleep: async (ms) => { waits.push(ms); },
    });
    expect(body.ok).toBe(true);
    expect(waits).toEqual([2000]);
  });

  it('gives up after the maximum number of retries on 429', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => jsonResponse({}, 429));
    await expect(
      getJson('https://api.example.com/x', {}, { fetchImpl, sleep: noSleep, maxRetries: 2 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('throws AuthError on 401 and 403, with the host and without the token', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => jsonResponse({}, 401));
    const error = await getJson('https://api.example.com/x?token=secret', { Authorization: 'Bearer secret' }, {
      fetchImpl,
      sleep: noSleep,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toContain('api.example.com');
    expect(error.message).not.toContain('secret');
  });

  it('throws HttpError with the status for other errors', async () => {
    const { fetch: fetchImpl } = fakeFetch(() => jsonResponse({}, 500));
    const error = await getJson('https://api.example.com/x', {}, { fetchImpl, sleep: noSleep }).catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(500);
  });
});
