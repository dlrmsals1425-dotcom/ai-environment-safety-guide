import fs from 'node:fs';
import path from 'node:path';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { GeocodeCandidate } from '../types/facility';

export const NAVER_GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
export const GEOCODE_TIMEOUT_MS = 8000;
export const GEOCODE_QUERY_MAX = 200;
const BODY_MAX = 4096;

type Keys = { id: string; key: string };

function parseCoordNum(v: unknown): number | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return v;
  }
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseWgsPair(x: unknown, y: unknown): { lng: number; lat: number } | null {
  if (x === null || y === null) return null;
  const lng = parseCoordNum(x);
  const lat = parseCoordNum(y);
  if (lng === null || lat === null) return null;
  if (lng < 124 || lng > 132 || lat < 33 || lat > 39) return null;
  return { lng, lat };
}

export function parseNaverCandidates(payload: unknown): GeocodeCandidate[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as { status?: unknown; addresses?: unknown };
  if (rec.status !== 'OK' || !Array.isArray(rec.addresses)) return null;
  const out: GeocodeCandidate[] = [];
  for (const row of rec.addresses) {
    if (!row || typeof row !== 'object') continue;
    const a = row as { roadAddress?: unknown; jibunAddress?: unknown; x?: unknown; y?: unknown };
    const xy = parseWgsPair(a.x, a.y);
    if (!xy) continue;
    const roadAddress = typeof a.roadAddress === 'string' ? a.roadAddress : '';
    const jibunAddress = typeof a.jibunAddress === 'string' ? a.jibunAddress : '';
    out.push({
      roadAddress,
      jibunAddress,
      lng: xy.lng,
      lat: xy.lat,
      inDeogyang:
        `${roadAddress} ${jibunAddress}`.includes('고양시') &&
        `${roadAddress} ${jibunAddress}`.includes('덕양구'),
    });
    if (out.length >= 5) break;
  }
  return out;
}

export function geocodeHttpBlocked(req: {
  method?: string;
  headers: IncomingHttpHeaders;
}): string | null {
  if (req.method !== 'POST') return 'method';
  const ct = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (ct !== 'application/json') return 'type';
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers.host;
    if (!host) return 'origin';
    try {
      if (new URL(String(origin)).host !== host) return 'origin';
    } catch {
      return 'origin';
    }
  }
  return null;
}

export function handleNaverGeocodeRequest(input: {
  body: unknown;
  keys: Keys | null;
  knownIds: Set<string>;
  fetchImpl: typeof fetch;
}): Promise<{ status: number; json: { error?: string; candidates?: GeocodeCandidate[] } }> {
  return handleInner(input);
}

async function handleInner(input: {
  body: unknown;
  keys: Keys | null;
  knownIds: Set<string>;
  fetchImpl: typeof fetch;
}): Promise<{ status: number; json: { error?: string; candidates?: GeocodeCandidate[] } }> {
  const fail = (status: number, error: string) => ({ status, json: { error } });
  if (!input.keys?.id || !input.keys?.key) {
    return fail(503, '주소 조회를 사용할 수 없습니다.');
  }
  const body = input.body;
  if (!body || typeof body !== 'object') return fail(400, '요청이 올바르지 않습니다.');
  const siteId = (body as { siteId?: unknown }).siteId;
  const queryRaw = (body as { query?: unknown }).query;
  if (typeof siteId !== 'string' || !input.knownIds.has(siteId)) {
    return fail(400, '요청이 올바르지 않습니다.');
  }
  if (typeof queryRaw !== 'string') return fail(400, '요청이 올바르지 않습니다.');
  const query = queryRaw.trim();
  if (!query || query.length > GEOCODE_QUERY_MAX) return fail(400, '요청이 올바르지 않습니다.');

  const url = `${NAVER_GEOCODE_URL}?query=${encodeURIComponent(query)}&count=5`;
  let res: Response;
  try {
    res = await input.fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'x-ncp-apigw-api-key-id': input.keys.id,
        'x-ncp-apigw-api-key': input.keys.key,
      },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return fail(504, '시간 초과');
    }
    return fail(502, '주소 조회에 실패했습니다.');
  }

  if (res.status === 401 || res.status === 403) return fail(502, '인증에 실패했습니다.');
  if (res.status === 429) return fail(429, '요청이 많습니다.');
  if (!res.ok) return fail(502, '주소 조회에 실패했습니다.');

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return fail(502, '주소 조회에 실패했습니다.');
  }
  const candidates = parseNaverCandidates(payload);
  if (candidates === null) return fail(502, '주소 조회에 실패했습니다.');
  return { status: 200, json: { candidates } };
}

function readEnvKeys(rootDir: string): Keys | null {
  const file = path.join(rootDir, '.env.local');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  let id = '';
  let key = '';
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (k === 'NAVER_MAPS_API_KEY_ID') id = v;
    if (k === 'NAVER_MAPS_API_KEY') key = v;
  }
  if (!id || !key) return null;
  return { id, key };
}

function readKnownIds(rootDir: string): Set<string> {
  const file = path.join(rootDir, 'public', 'data', 'facilities', 'cctv_sites.json');
  if (!fs.existsSync(file)) return new Set();
  const sites = JSON.parse(fs.readFileSync(file, 'utf8')) as { stableId?: string; gu?: string }[];
  return new Set(
    sites.filter((s) => s.gu === '덕양구' && typeof s.stableId === 'string').map((s) => s.stableId as string),
  );
}

function sendJson(
  res: ServerResponse,
  status: number,
  json: { error?: string; candidates?: GeocodeCandidate[] },
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(json));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer | string) => {
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += buf.length;
      if (size > BODY_MAX) {
        reject(new Error('too-large'));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createNaverGeocodeMiddleware(rootDir: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const urlPath = (req.url ?? '').split('?')[0];
    if (urlPath !== '/api/naver-geocode') {
      next();
      return;
    }
    const blocked = geocodeHttpBlocked(req);
    if (blocked) {
      sendJson(res, blocked === 'method' ? 405 : 400, { error: '요청이 올바르지 않습니다.' });
      return;
    }
    void (async () => {
      let raw: string;
      try {
        raw = await readBody(req);
      } catch {
        sendJson(res, 400, { error: '요청이 올바르지 않습니다.' });
        return;
      }
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        sendJson(res, 400, { error: '요청이 올바르지 않습니다.' });
        return;
      }
      const result = await handleNaverGeocodeRequest({
        body,
        keys: readEnvKeys(rootDir),
        knownIds: readKnownIds(rootDir),
        fetchImpl: fetch,
      });
      sendJson(res, result.status, result.json);
    })();
  };
}

export function naverGeocodePlugin(rootDir: string) {
  return {
    name: 'naver-geocode-proxy',
    configureServer(server: { middlewares: { use: (fn: ReturnType<typeof createNaverGeocodeMiddleware>) => void } }) {
      server.middlewares.use(createNaverGeocodeMiddleware(rootDir));
    },
    configurePreviewServer(server: {
      middlewares: { use: (fn: ReturnType<typeof createNaverGeocodeMiddleware>) => void };
    }) {
      server.middlewares.use(createNaverGeocodeMiddleware(rootDir));
    },
  };
}
