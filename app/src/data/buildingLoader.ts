import spatialConfig from '../../config/spatial.json';
import { bboxIntersects, bufferBboxMeters, type BBox } from '@/geo/aoi';
import { toEnu, type EnuOrigin } from '@/geo/enu';
import { pickMapped, toFiniteNumber, toText } from '@/data/columns';
import { estimateHeight } from '@/data/estimateHeight';
import type {
  Building,
  BuildingMeta,
  BuildingSource,
  BuildingSourceConfig,
  HeightSource,
  LoadBuildingsResult,
} from '@/types/building';

type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export type GeoJsonFeature = {
  type: 'Feature';
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry: GeoJsonGeometry | { type: string; coordinates: unknown } | null;
};

export type GeoJsonFC = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

export type FgbDeserialize = (
  url: string,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  signal?: AbortSignal,
) => Promise<GeoJsonFeature[]>;

let fgbDeserialize: FgbDeserialize | null = null;

/** 테스트에서 FGB 경로를 주입한다. 운영은 패키지 deserialize를 쓴다. */
export function setFlatGeobufDeserialize(fn: FgbDeserialize | null): void {
  fgbDeserialize = fn;
}

async function deserializeFlatGeobuf(
  url: string,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  signal?: AbortSignal,
): Promise<GeoJsonFeature[]> {
  if (fgbDeserialize) return fgbDeserialize(url, bbox, signal);
  const { geojson } = await import('flatgeobuf');
  const features: GeoJsonFeature[] = [];
  for await (const feature of geojson.deserialize(url, bbox)) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    features.push(feature as GeoJsonFeature);
  }
  return features;
}

function closeLngLat(coords: number[][]): number[][] {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, [first[0], first[1]]];
}

function ringMetrics(coords: number[][], origin: EnuOrigin) {
  const closed = closeLngLat(coords);
  const n = Math.max(0, closed.length - 1);
  const ring = new Float64Array(n * 2);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { x, y } = toEnu(closed[i][0], closed[i][1], origin);
    ring[i * 2] = x;
    ring[i * 2 + 1] = y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const x1 = ring[i * 2];
    const y1 = ring[i * 2 + 1];
    const j = (i + 1) % n;
    const x2 = ring[j * 2];
    const y2 = ring[j * 2 + 1];
    area += x1 * y2 - x2 * y1;
  }
  return {
    ring,
    minX,
    minY,
    maxX,
    maxY,
    areaM2: Math.abs(area) / 2,
    lngLat: closed,
  };
}

function polygonsFromGeometry(geometry: GeoJsonFeature['geometry']): number[][][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as number[][][]];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as number[][][][];
  }
  return [];
}

function wgsEnvelope(rings: number[][][]): BBox | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const c of ring) {
      const lon = c[0];
      const lat = c[1];
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLon)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

export function buildingsFromGeoJson(
  fc: GeoJsonFC,
  origin: EnuOrigin,
  clipBbox: BBox,
  bufferM = spatialConfig.aoiBufferM,
): Building[] {
  const buffered = bufferBboxMeters(clipBbox, bufferM);
  const out: Building[] = [];

  fc.features.forEach((feature, fi) => {
    const polygons = polygonsFromGeometry(feature.geometry);
    const props = feature.properties ?? {};
    const floors = toFiniteNumber(pickMapped(props, 'floors'));
    const useName = toText(pickMapped(props, 'useName'));
    const heightRaw = toFiniteNumber(pickMapped(props, 'height'));
    const srcRaw = toText(pickMapped(props, 'heightSource'));
    const forceSource: HeightSource | undefined =
      srcRaw === 'synthetic' || srcRaw === 'measured' || srcRaw === 'estimated'
        ? srcRaw
        : undefined;
    const { height, heightSource } = estimateHeight({
      floors,
      useName,
      heightRaw: forceSource === 'synthetic' ? null : heightRaw,
      forceSource,
    });
    const heightOut =
      forceSource === 'synthetic' && heightRaw != null && Number.isFinite(heightRaw)
        ? heightRaw
        : height;

    if (heightOut < spatialConfig.minHeightM) return;

    const baseId =
      toText(props.id) ??
      toText(pickMapped(props, 'pnu')) ??
      (feature.id != null ? String(feature.id) : `b${fi}`);

    polygons.forEach((poly, pi) => {
      if (!poly[0] || poly[0].length < 3) return;
      const env = wgsEnvelope(poly);
      if (!env || !bboxIntersects(env, buffered)) return;

      const outer = ringMetrics(poly[0], origin);
      if (outer.areaM2 < spatialConfig.minAreaM2) return;
      const holes =
        poly.length > 1
          ? poly.slice(1).map((h) => ringMetrics(h, origin).ring)
          : undefined;
      const id = polygons.length > 1 ? `${baseId}-${pi}` : baseId;
      out.push({
        id,
        ring: outer.ring,
        holes,
        baseZ: 0,
        height: heightOut,
        heightSource,
        minX: outer.minX,
        minY: outer.minY,
        maxX: outer.maxX,
        maxY: outer.maxY,
        lngLatPolygon: [outer.lngLat, ...poly.slice(1).map((h) => closeLngLat(h))],
      });
    });
  });

  return out;
}

export type SourceKind = 'flatgeobuf' | 'geojson' | 'json';

export function isLoaderPublicUrl(url: string): boolean {
  const u = url.toLowerCase();
  return !u.includes('.part') && !u.includes('.tmp') && !u.includes('/staging/');
}

export function isHtmlContentType(contentType: string | null | undefined): boolean {
  return /text\/html/i.test(contentType ?? '');
}

export function sourceKindFor(source: { type?: string; url: string }): SourceKind {
  if (source.type === 'flatgeobuf' || source.url.toLowerCase().endsWith('.fgb')) {
    return 'flatgeobuf';
  }
  if (source.url.toLowerCase().endsWith('.geojson')) return 'geojson';
  return 'json';
}

function skipBomAndSpace(bytes: Uint8Array): number {
  let i = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    i = 3;
  }
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) {
    i += 1;
  }
  return i;
}

export function looksLikeHtmlBytes(bytes: Uint8Array): boolean {
  const i = skipBomAndSpace(bytes);
  if (i >= bytes.length) return false;
  if (bytes[i] !== 0x3c) return false;
  const head = String.fromCharCode(...bytes.subarray(i, Math.min(i + 9, bytes.length))).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head');
}

export function bytesMatchSource(bytes: Uint8Array, kind: SourceKind): boolean {
  if (looksLikeHtmlBytes(bytes)) return false;
  const i = skipBomAndSpace(bytes);
  if (kind === 'flatgeobuf') {
    return (
      bytes.length >= i + 3 &&
      bytes[i] === 0x66 &&
      bytes[i + 1] === 0x67 &&
      bytes[i + 2] === 0x62
    );
  }
  return i < bytes.length && (bytes[i] === 0x7b || bytes[i] === 0x5b);
}

async function responseBytes(res: Response): Promise<Uint8Array> {
  return new Uint8Array(await res.arrayBuffer());
}

/** Vite SPA fallback은 없는 /data/*.fgb에도 HEAD/GET 200 text/html을 준다. */
export async function sourceExists(
  url: string,
  signal?: AbortSignal,
  kind: SourceKind = 'json',
): Promise<boolean> {
  if (!isLoaderPublicUrl(url)) return false;
  try {
    const head = await fetch(url, { method: 'HEAD', signal });
    if (head.ok && isHtmlContentType(head.headers.get('content-type'))) return false;

    const get = await fetch(url, {
      method: 'GET',
      signal,
      headers: { Range: 'bytes=0-63' },
    });
    if (!(get.ok || get.status === 206)) return false;
    if (isHtmlContentType(get.headers.get('content-type'))) return false;
    return bytesMatchSource(await responseBytes(get), kind);
  } catch {
    return false;
  }
}

/** GIS FGB/GeoJSON이 있으면 그걸 쓰고, 없으면 합성 데모. 부분(.part) 파일은 쓰지 않는다. */
export async function resolveBuildingSource(
  config: BuildingSourceConfig,
  signal?: AbortSignal,
): Promise<BuildingSource> {
  for (const candidate of config.buildingsRealCandidates ?? []) {
    if (!isLoaderPublicUrl(candidate.url)) continue;
    if (!(await sourceExists(candidate.url, signal, sourceKindFor(candidate)))) continue;
    if (
      candidate.metaUrl &&
      !(await sourceExists(candidate.metaUrl, signal, 'json'))
    ) {
      continue;
    }
    console.log('[BITGIL] building source', candidate.url);
    return candidate;
  }
  console.log('[BITGIL] building source fallback', config.buildings.url);
  return config.buildings;
}

export async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function metaFromUnknown(raw: unknown, fallbackCount: number): BuildingMeta {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    source: typeof o.source === 'string' ? o.source : 'unknown',
    synthetic: o.synthetic === true,
    downloadedAt: typeof o.downloadedAt === 'string' ? o.downloadedAt : null,
    featureCount:
      typeof o.featureCount === 'number' ? o.featureCount : fallbackCount,
    aoiBboxWgs84: Array.isArray(o.aoiBboxWgs84)
      ? (o.aoiBboxWgs84 as number[])
      : undefined,
    warning: typeof o.warning === 'string' ? o.warning : undefined,
    heightMeasuredRatio:
      typeof o.heightMeasuredRatio === 'number' ? o.heightMeasuredRatio : undefined,
    bufferMeters: typeof o.bufferMeters === 'number' ? o.bufferMeters : undefined,
  };
}

export async function loadBuildings(opts: {
  source: BuildingSource;
  origin: EnuOrigin;
  aoiBbox: BBox;
  bufferM?: number;
  signal?: AbortSignal;
}): Promise<LoadBuildingsResult> {
  const bufferM = opts.bufferM ?? spatialConfig.aoiBufferM;
  const buffered = bufferBboxMeters(opts.aoiBbox, bufferM);
  let features: GeoJsonFeature[] = [];

  if (opts.source.type === 'geojson') {
    const fc = await readJson<GeoJsonFC>(opts.source.url, opts.signal);
    features = fc.features ?? [];
  } else {
    features = await deserializeFlatGeobuf(
      opts.source.url,
      { minX: buffered[0], minY: buffered[1], maxX: buffered[2], maxY: buffered[3] },
      opts.signal,
    );
  }

  const buildings = buildingsFromGeoJson(
    { type: 'FeatureCollection', features },
    opts.origin,
    opts.aoiBbox,
    bufferM,
  );

  let meta: BuildingMeta = {
    source: opts.source.url,
    synthetic: false,
    downloadedAt: null,
    featureCount: buildings.length,
    bufferMeters: bufferM,
  };
  if (opts.source.metaUrl) {
    try {
      const raw = await readJson<unknown>(opts.source.metaUrl, opts.signal);
      meta = metaFromUnknown(raw, buildings.length);
      meta.bufferMeters = meta.bufferMeters ?? bufferM;
    } catch {
      /* 메타 파일 없음은 GeoJSON 경로에서 허용 */
    }
  }
  if (buildings.some((b) => b.heightSource === 'synthetic')) {
    meta.synthetic = true;
  }
  return { buildings, meta };
}
