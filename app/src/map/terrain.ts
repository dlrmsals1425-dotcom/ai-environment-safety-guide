import type { BBox } from '@/geo/aoi';
import { bboxIntersects } from '@/geo/aoi';
import type { TerrainMeta } from '@/types/seoul';

export const TERRAIN_SOURCE_ID = 'seoul-surface-dem';

function finite(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isBbox(v: unknown): v is BBox {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** /data/seoul/terrain/meta.json. 타일 경로가 없으면 지형 표시를 하지 않는다. */
export function parseTerrainMeta(raw: unknown): TerrainMeta | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const tiles = Array.isArray(o.tiles)
    ? o.tiles.filter((t): t is string => typeof t === 'string' && t.includes('{z}'))
    : [];
  if (tiles.length === 0) return null;
  return {
    tiles,
    bounds: isBbox(o.bounds) ? o.bounds : [126.5, 37.2, 127.4, 37.85],
    minzoom: finite(o.minzoom, 8),
    maxzoom: finite(o.maxzoom, 12),
    tileSize: finite(o.tileSize, 256),
    encoding: o.encoding === 'terrarium' ? 'terrarium' : 'mapbox',
    // 과장은 1로 고정한다. meta가 다른 값을 주더라도 1을 넘겨 쓰지 않는다.
    exaggeration: 1,
    nominalResolutionM:
      typeof o.nominalResolutionM === 'number' ? o.nominalResolutionM : null,
    attribution: typeof o.attribution === 'string' ? o.attribution : null,
  };
}

/** MapLibre raster-dem 소스 스펙. bounds를 넘겨 자료 범위 밖을 요청하지 않게 한다. */
export function terrainSourceSpec(meta: TerrainMeta) {
  return {
    type: 'raster-dem' as const,
    tiles: meta.tiles,
    tileSize: meta.tileSize,
    minzoom: meta.minzoom,
    maxzoom: meta.maxzoom,
    bounds: meta.bounds,
    encoding: meta.encoding,
    ...(meta.attribution ? { attribution: meta.attribution } : {}),
  };
}

export function terrainSpec(meta: TerrainMeta) {
  return { source: TERRAIN_SOURCE_ID, exaggeration: meta.exaggeration };
}

/** 현재 화면이 지형 자료 범위 안인지. 밖이면 "지형 자료 범위 밖"으로 안내한다. */
export function isViewWithinTerrain(meta: TerrainMeta | null, viewBbox: BBox): boolean {
  if (!meta) return false;
  return bboxIntersects(meta.bounds, viewBbox);
}
