import { describe, expect, it, vi } from 'vitest';
import {
  GEOCODE_QUERY_MAX,
  NAVER_GEOCODE_URL,
  geocodeHttpBlocked,
  handleNaverGeocodeRequest,
  parseNaverCandidates,
  parseWgsPair,
} from '@/server/naverGeocodeProxy';

const keys = { id: 'test-id', key: 'test-key' };
const knownIds = new Set(['S-5112#r1']);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('geocodeHttpBlocked', () => {
  it('allows JSON POST with no Origin (CLI) and same-origin Origin', () => {
    expect(
      geocodeHttpBlocked({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    ).toBeNull();
    expect(
      geocodeHttpBlocked({
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          origin: 'http://localhost:5173',
          host: 'localhost:5173',
        },
      }),
    ).toBeNull();
  });

  it('blocks form/text posts and cross-origin so the key is not used', () => {
    expect(
      geocodeHttpBlocked({
        method: 'POST',
        headers: { 'content-type': 'text/plain', host: 'localhost:5173' },
      }),
    ).toBe('type');
    expect(
      geocodeHttpBlocked({
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://evil.example',
          host: 'localhost:5173',
        },
      }),
    ).toBe('type');
    expect(
      geocodeHttpBlocked({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
          host: 'localhost:5173',
        },
      }),
    ).toBe('origin');
  });
});

describe('parseWgsPair / parseNaverCandidates', () => {
  it('rejects null, empty, zero, and out-of-range coordinates', () => {
    expect(parseWgsPair(null, '37.6')).toBeNull();
    expect(parseWgsPair('', '37.6')).toBeNull();
    expect(parseWgsPair(0, 37.6)).toBeNull();
    expect(parseWgsPair('126.83', '37.65')).toEqual({ lng: 126.83, lat: 37.65 });
  });

  it('flags only 고양시 덕양구 and caps at 5', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      roadAddress: `경기도 고양시 덕양구 주교동 ${i}`,
      jibunAddress: '',
      x: String(126.83 + i * 0.001),
      y: '37.65',
    }));
    rows[0].roadAddress = '서울특별시 은평구 진관동 1';
    const parsed = parseNaverCandidates({ status: 'OK', addresses: rows });
    expect(parsed).toHaveLength(5);
    expect(parsed?.[0].inDeogyang).toBe(false);
    expect(parsed?.[1].inDeogyang).toBe(true);
  });

  it('returns null when status is not OK', () => {
    expect(parseNaverCandidates({ status: 'INVALID_REQUEST', addresses: [] })).toBeNull();
  });
});

describe('handleNaverGeocodeRequest', () => {
  it('does not call upstream without keys or with a bad body', async () => {
    const fetchImpl = vi.fn();
    const noKey = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'S-5112#r1' },
      keys: null,
      knownIds,
      fetchImpl,
    });
    expect(noKey.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();

    const bad = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'unknown' },
      keys,
      knownIds,
      fetchImpl,
    });
    expect(bad.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();

    const long = await handleNaverGeocodeRequest({
      body: { query: '가'.repeat(GEOCODE_QUERY_MAX + 1), siteId: 'S-5112#r1' },
      keys,
      knownIds,
      fetchImpl,
    });
    expect(long.status).toBe(400);
  });

  it('sends count=5, redirect error, and maps a fixture without logging', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        status: 'OK',
        addresses: [
          {
            roadAddress: '경기도 고양시 덕양구 주교동 598',
            jibunAddress: '경기도 고양시 덕양구 주교동 598',
            x: '126.831',
            y: '37.656',
          },
        ],
      }),
    );
    const result = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'S-5112#r1' },
      keys,
      knownIds,
      fetchImpl,
    });
    expect(result.status).toBe(200);
    expect(result.json.candidates).toHaveLength(1);
    expect(result.json.candidates?.[0].inDeogyang).toBe(true);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0].startsWith(NAVER_GEOCODE_URL)).toBe(true);
    expect(call[0]).toContain('count=5');
    expect(call[1]).toEqual(expect.objectContaining({ redirect: 'error', cache: 'no-store' }));
  });

  it('maps 401/429/timeout and non-OK payload to generic errors', async () => {
    const auth = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'S-5112#r1' },
      keys,
      knownIds,
      fetchImpl: vi.fn(async () => jsonResponse(401, {})),
    });
    expect(auth.status).toBe(502);

    const busy = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'S-5112#r1' },
      keys,
      knownIds,
      fetchImpl: vi.fn(async () => jsonResponse(429, {})),
    });
    expect(busy.status).toBe(429);

    const badStatus = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'S-5112#r1' },
      keys,
      knownIds,
      fetchImpl: vi.fn(async () => jsonResponse(200, { status: 'ERROR', addresses: [] })),
    });
    expect(badStatus.status).toBe(502);

    const timeout = await handleNaverGeocodeRequest({
      body: { query: '주교동 598', siteId: 'S-5112#r1' },
      keys,
      knownIds,
      fetchImpl: vi.fn(async () => {
        const err = new Error('timeout');
        err.name = 'TimeoutError';
        throw err;
      }),
    });
    expect(timeout.status).toBe(504);
  });
});
