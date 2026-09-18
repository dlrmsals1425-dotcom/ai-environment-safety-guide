import type {
  SeoulBuildingFeature,
  SeoulBuildingProps,
  SeoulHeightSource,
  SeoulTreeFeature,
  SeoulTreeProps,
  TileEntry,
  TreeQuality,
} from '@/types/seoul';
import type { BBox } from '@/geo/aoi';

/** Keep complete edge-crossing buildings, while excluding unrelated objects in a tile. */
export function featureIntersectsBbox(
  feature: SeoulBuildingFeature | SeoulTreeFeature,
  bbox: BBox,
): boolean {
  const geometry = feature.geometry;
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates;
    return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
  }
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const polygon of polygons) for (const ring of polygon) for (const [x, y] of ring) {
    west = Math.min(west, x); south = Math.min(south, y);
    east = Math.max(east, x); north = Math.max(north, y);
  }
  return west <= bbox[2] && east >= bbox[0] && south <= bbox[3] && north >= bbox[1];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function text(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function heightSourceOf(v: unknown): SeoulHeightSource {
  return v === 'measured' || v === 'estimated' ? v : 'unknown';
}

function qualityOf(v: unknown): TreeQuality {
  return v === 'valid' ? 'valid' : 'review';
}

/** 파일은 있으나 계약과 다른 경우. 조용히 빈 목록으로 넘기지 않는다. */
export class SchemaError extends Error {
  constructor(url: string, detail: string) {
    super(`${url}: ${detail}`);
    this.name = 'SchemaError';
  }
}

/** 파일 자체가 없을 때. "자료 없음"으로 안내하며 로딩 오류와 구분한다. */
export class MissingDataError extends Error {
  constructor(url: string) {
    super(`${url} 없음`);
    this.name = 'MissingDataError';
  }
}

/**
 * 건물 속성 정규화.
 * 높이는 준비 단계에서 정제된 값을 **그대로 존중**한다.
 * 앱에서는 상한을 다시 깎거나 층수로 재추정하지 않으며, unknown이면 0으로 둔다.
 */
export function normalizeBuildingProps(
  raw: unknown,
  fallbackId: string,
): SeoulBuildingProps {
  const p = asRecord(raw);
  const declared = heightSourceOf(p.heightSource);
  const height = finite(p.height);
  const usable = declared !== 'unknown' && height != null && height > 0;
  return {
    id: text(p.id) ?? fallbackId,
    sourceId: text(p.sourceId),
    pnu: text(p.pnu),
    name: text(p.name),
    address: text(p.address),
    useName: text(p.useName),
    floors: finite(p.floors),
    height: usable ? (height as number) : 0,
    heightSource: usable ? declared : 'unknown',
    heightRaw: finite(p.heightRaw),
    sourceDate: text(p.sourceDate),
  };
}

export function normalizeBuildingFeature(
  raw: unknown,
  index: number,
): SeoulBuildingFeature | null {
  const f = asRecord(raw);
  const geometry = asRecord(f.geometry);
  const type = geometry.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') return null;
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return null;
  }
  return {
    type: 'Feature',
    properties: normalizeBuildingProps(f.properties, `b${index}`),
    geometry: geometry as unknown as SeoulBuildingFeature['geometry'],
  };
}

/**
 * 수목 속성 정규화.
 * 준비 단계에서 범위를 벗어난 값은 이미 null이며 원천값은 rawHeight/rawCrownWidth로 남는다.
 * 앱은 null을 채우지 않는다.
 */
export function normalizeTreeProps(raw: unknown, fallbackId: string): SeoulTreeProps {
  const p = asRecord(raw);
  const heightM = finite(p.heightM);
  const crownWidthM = finite(p.crownWidthM);
  return {
    id: text(p.id) ?? fallbackId,
    dataset: text(p.dataset) ?? 'unknown',
    gu: text(p.gu),
    species: text(p.species),
    heightM: heightM != null && heightM > 0 ? heightM : null,
    crownWidthM: crownWidthM != null && crownWidthM > 0 ? crownWidthM : null,
    rawHeight: finite(p.rawHeight),
    rawCrownWidth: finite(p.rawCrownWidth),
    quality: qualityOf(p.quality),
    sourceYear: finite(p.sourceYear) ?? 2013,
  };
}

export function normalizeTreeFeature(
  raw: unknown,
  index: number,
): SeoulTreeFeature | null {
  const f = asRecord(raw);
  const geometry = asRecord(f.geometry);
  if (geometry.type !== 'Point') return null;
  const coords = geometry.coordinates;
  if (
    !Array.isArray(coords) ||
    coords.length < 2 ||
    typeof coords[0] !== 'number' ||
    typeof coords[1] !== 'number' ||
    !Number.isFinite(coords[0]) ||
    !Number.isFinite(coords[1])
  ) {
    return null;
  }
  return {
    type: 'Feature',
    properties: normalizeTreeProps(f.properties, `t${index}`),
    geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
  };
}

export function normalizeSnowBaseFeature(
  raw: unknown,
  index: number,
): import('@/types/seoul').SnowBaseFeature | null {
  const f = asRecord(raw);
  const geometry = asRecord(f.geometry);
  if (geometry.type !== 'Point') return null;
  const coords = geometry.coordinates;
  if (
    !Array.isArray(coords) ||
    typeof coords[0] !== 'number' ||
    typeof coords[1] !== 'number' ||
    !Number.isFinite(coords[0]) ||
    !Number.isFinite(coords[1])
  ) {
    return null;
  }
  const p = asRecord(f.properties);
  return {
    type: 'Feature',
    properties: {
      id: text(p.id) ?? `snow${index}`,
      agency: text(p.agency),
      baseId: text(p.baseId),
      kind: text(p.kind),
      location: text(p.location),
      coordinateStatus: text(p.coordinateStatus),
    },
    geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
  };
}

export function parseSnowBaseMeta(raw: unknown): import('@/types/seoul').SnowBaseMeta {
  const o = asRecord(raw);
  return {
    source: text(o.source),
    totalRows: finite(o.totalRows),
    mappedRows: finite(o.mappedRows),
    unmappedRows: finite(o.unmappedRows),
    warning: text(o.warning),
  };
}

export interface ParsedTile<T> {
  features: T[];
  /** 기하가 없어 쓰지 못한 피처 수. 0이 아니면 UI에 알린다. */
  skipped: number;
}

/** FeatureCollection이 아니면 SchemaError. 일부 피처만 불량이면 건너뛴 수를 돌려준다. */
export function parseFeatureCollection<T>(
  raw: unknown,
  normalize: (feature: unknown, index: number) => T | null,
  url = 'tile',
): ParsedTile<T> {
  const fc = asRecord(raw);
  if (!Array.isArray(fc.features)) {
    throw new SchemaError(url, 'FeatureCollection.features 배열이 없습니다');
  }
  const features: T[] = [];
  let skipped = 0;
  fc.features.forEach((f, i) => {
    const norm = normalize(f, i);
    if (norm) features.push(norm);
    else skipped += 1;
  });
  return { features, skipped };
}

export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (res.status === 404) throw new MissingDataError(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (/text\/html/i.test(contentType)) {
    // dev 서버 SPA 폴백이 index.html을 돌려주는 경우도 "자료 없음"으로 본다.
    throw new MissingDataError(url);
  }
  return res.json();
}

/** 선택된 타일을 모두 읽어 합친다. 한 타일이라도 실패하면 오류다(부분 표시 금지). */
export async function loadTileFeatures<T>(
  tiles: TileEntry[],
  normalize: (feature: unknown, index: number) => T | null,
  signal?: AbortSignal,
): Promise<ParsedTile<T>> {
  const chunks = await Promise.all(
    tiles.map(async (t) =>
      parseFeatureCollection(await fetchJson(t.url, signal), normalize, t.url),
    ),
  );
  return {
    features: chunks.flatMap((c) => c.features),
    skipped: chunks.reduce((sum, c) => sum + c.skipped, 0),
  };
}

/** 표시 상한. 수목처럼 표시만 하는 자료에만 쓴다(건물 분석에는 쓰지 않는다). */
export function capFeatures<T>(
  features: T[],
  cap: number,
): { shown: T[]; capped: boolean } {
  if (features.length <= cap) return { shown: features, capped: false };
  return { shown: features.slice(0, cap), capped: true };
}
