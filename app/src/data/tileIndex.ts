import { bboxIntersects, type BBox } from '@/geo/aoi';
import type { DatasetMeta, HeightCounts, TileEntry, TileIndex } from '@/types/seoul';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function isBbox(v: unknown): v is BBox {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toTileEntry(raw: unknown): TileEntry | null {
  const o = asRecord(raw);
  const id = text(o.id);
  const url = text(o.url);
  if (!id || !url || !isBbox(o.bbox)) return null;
  return { id, url, bbox: o.bbox, featureCount: finite(o.featureCount) ?? 0 };
}

export function parseTileIndex(raw: unknown): TileIndex {
  const o = asRecord(raw);
  const tiles = Array.isArray(o.tiles)
    ? o.tiles.map(toTileEntry).filter((t): t is TileEntry => t !== null)
    : [];
  return {
    version: finite(o.version) ?? 1,
    kind: text(o.kind),
    metaUrl: text(o.metaUrl),
    featureCount: finite(o.featureCount),
    bounds: isBbox(o.bounds) ? o.bounds : null,
    ...(Array.isArray(o.coverageAreas) ? {coverageAreas:o.coverageAreas.filter(isBbox)} : {}),
    tiles,
  };
}

export function hasCompleteCoverage(index:TileIndex, bbox:BBox):boolean {
  return !index.coverageAreas || index.coverageAreas.some(area=>
    area[0]<=bbox[0] && area[1]<=bbox[1] && area[2]>=bbox[2] && area[3]>=bbox[3]);
}

function toHeightCounts(raw: unknown): HeightCounts | undefined {
  const o = asRecord(raw);
  const measured = finite(o.measured);
  const estimated = finite(o.estimated);
  const unknown = finite(o.unknown);
  if (measured == null && estimated == null && unknown == null) return undefined;
  return {
    measured: measured ?? 0,
    estimated: estimated ?? 0,
    unknown: unknown ?? 0,
  };
}

function toCountMap(raw: unknown): Record<string, number> | null {
  const o = asRecord(raw);
  const entries = Object.entries(o).filter(
    (e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function parseDatasetMeta(raw: unknown): DatasetMeta {
  const o = asRecord(raw);
  const ratio = finite(o.heightMeasuredRatio);
  const counts = toHeightCounts(o.heightCounts);
  return {
    source: text(o.source),
    synthetic: o.synthetic === true,
    featureCount: finite(o.featureCount),
    tileCount: finite(o.tileCount),
    downloadedAt: text(o.downloadedAt),
    dataDate: text(o.dataDate),
    warning: text(o.warning),
    preparationCounts: toCountMap(o.preparationCounts),
    ...(ratio != null ? { heightMeasuredRatio: ratio } : {}),
    ...(counts ? { heightCounts: counts } : {}),
  };
}

function bboxCenterPoint(bbox: BBox): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/**
 * 화면(또는 AOI) bbox와 교차하는 타일만 고른다.
 * 서울 전체를 한 번에 읽지 않기 위해 개수 상한을 두고, 중심에 가까운 타일을 우선한다.
 */
export function selectTiles(
  tiles: TileEntry[],
  viewBbox: BBox,
  maxTiles: number,
): TileEntry[] {
  const hit = tiles.filter((t) => bboxIntersects(t.bbox, viewBbox));
  if (hit.length <= maxTiles) return hit;
  const [cx, cy] = bboxCenterPoint(viewBbox);
  return [...hit]
    .sort((a, b) => {
      const [ax, ay] = bboxCenterPoint(a.bbox);
      const [bx, by] = bboxCenterPoint(b.bbox);
      return Math.hypot(ax - cx, ay - cy) - Math.hypot(bx - cx, by - cy);
    })
    .slice(0, maxTiles);
}

export function tileIdsOf(tiles: TileEntry[]): string[] {
  return tiles.map((t) => t.id);
}

/** 같은 타일 조합이면 다시 읽지 않는다. */
export function sameTileSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/** 데이터 제공 범위 밖을 보고 있으면 "자료 없음"과 구분해 안내한다. */
export function isOutsideBounds(bounds: BBox | null, viewBbox: BBox): boolean {
  if (!bounds) return false;
  return !bboxIntersects(bounds, viewBbox);
}

export function resolveMetaUrl(indexUrl: string, metaUrl: string | null): string {
  if (metaUrl && metaUrl.startsWith('/')) return metaUrl;
  const base = indexUrl.slice(0, indexUrl.lastIndexOf('/') + 1);
  return `${base}${metaUrl ?? 'meta.json'}`;
}
