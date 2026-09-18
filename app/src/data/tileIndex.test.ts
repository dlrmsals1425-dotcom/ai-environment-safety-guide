import { describe, expect, it } from 'vitest';
import {
  isOutsideBounds,
  parseDatasetMeta,
  parseTileIndex,
  resolveMetaUrl,
  sameTileSet,
  selectTiles,
  tileIdsOf,
} from '@/data/tileIndex';
import type { TileEntry } from '@/types/seoul';

const tile = (id: string, bbox: [number, number, number, number]): TileEntry => ({
  id,
  url: `/data/seoul/buildings/${id}.geojson`,
  bbox,
  featureCount: 10,
});

describe('parseTileIndex', () => {
  it('reads the version-1 contract and drops malformed tiles', () => {
    const idx = parseTileIndex({
      version: 1,
      kind: 'buildings',
      metaUrl: '/data/seoul/buildings/meta.json',
      featureCount: 695754,
      bounds: [126.7, 37.35, 127.3, 37.8],
      tiles: [
        { id: 'a', url: '/a.geojson', bbox: [127, 37.5, 127.01, 37.51], featureCount: 3 },
        { id: 'bad-bbox', url: '/b.geojson', bbox: [127, 37.5], featureCount: 1 },
        { id: 'no-url', bbox: [127, 37.5, 127.01, 37.51] },
        'nope',
      ],
    });
    expect(idx.version).toBe(1);
    expect(idx.kind).toBe('buildings');
    expect(idx.metaUrl).toBe('/data/seoul/buildings/meta.json');
    expect(idx.featureCount).toBe(695754);
    expect(idx.bounds).toEqual([126.7, 37.35, 127.3, 37.8]);
    expect(idx.tiles).toEqual([
      { id: 'a', url: '/a.geojson', bbox: [127, 37.5, 127.01, 37.51], featureCount: 3 },
    ]);
  });

  it('returns an empty tile list for garbage input', () => {
    expect(parseTileIndex(null).tiles).toEqual([]);
    expect(parseTileIndex({ tiles: 'x' }).tiles).toEqual([]);
    expect(parseTileIndex({}).bounds).toBeNull();
  });
});

describe('parseDatasetMeta', () => {
  it('reads building meta including height counts', () => {
    const meta = parseDatasetMeta({
      source: 'GIS건물통합정보',
      synthetic: false,
      featureCount: 695754,
      tileCount: 120,
      downloadedAt: '2026-09-18',
      dataDate: '2026-09-09',
      warning: '높이 미상 다수',
      preparationCounts: { input: 695754, kept: 695754, skipped: 0 },
      heightMeasuredRatio: 0.439456,
      heightCounts: { measured: 305753, estimated: 100, unknown: 389901 },
    });
    expect(meta.synthetic).toBe(false);
    expect(meta.dataDate).toBe('2026-09-09');
    expect(meta.heightCounts).toEqual({ measured: 305753, estimated: 100, unknown: 389901 });
    expect(meta.preparationCounts).toEqual({ input: 695754, kept: 695754, skipped: 0 });
  });

  it('omits building-only fields for tree meta', () => {
    const meta = parseDatasetMeta({ source: '서울 가로수', synthetic: false, featureCount: 257235 });
    expect(meta.heightCounts).toBeUndefined();
    expect(meta.heightMeasuredRatio).toBeUndefined();
    expect(meta.warning).toBeNull();
  });
});

describe('selectTiles', () => {
  const tiles = [
    tile('t1', [126.99, 37.54, 127.0, 37.55]),
    tile('t2', [127.0, 37.54, 127.01, 37.55]),
    tile('t3', [127.2, 37.54, 127.21, 37.55]),
  ];

  it('returns only tiles intersecting the view bbox', () => {
    const got = selectTiles(tiles, [126.995, 37.545, 127.005, 37.548], 16);
    expect(tileIdsOf(got).sort()).toEqual(['t1', 't2']);
  });

  it('never returns the whole city: caps the count nearest to the view center', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      tile(`m${i}`, [127 + i * 0.001, 37.5, 127 + i * 0.001 + 0.001, 37.501]),
    );
    const got = selectTiles(many, [127, 37.5, 127.03, 37.501], 5);
    expect(got).toHaveLength(5);
    // 화면 중심(127.015)에서 가장 가까운 타일부터 고른다.
    expect(['m14', 'm15']).toContain(got[0].id);
  });

  it('returns an empty list when nothing intersects', () => {
    expect(selectTiles(tiles, [128, 38, 128.01, 38.01], 16)).toEqual([]);
  });
});

describe('sameTileSet', () => {
  it('ignores order but not membership', () => {
    expect(sameTileSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameTileSet(['a'], ['a', 'b'])).toBe(false);
    expect(sameTileSet(['a', 'c'], ['a', 'b'])).toBe(false);
  });
});

describe('isOutsideBounds', () => {
  it('flags a view completely outside the dataset bounds', () => {
    const bounds: [number, number, number, number] = [126.7, 37.35, 127.3, 37.8];
    expect(isOutsideBounds(bounds, [129, 35, 129.1, 35.1])).toBe(true);
    expect(isOutsideBounds(bounds, [127, 37.5, 127.01, 37.51])).toBe(false);
    expect(isOutsideBounds(null, [129, 35, 129.1, 35.1])).toBe(false);
  });
});

describe('resolveMetaUrl', () => {
  it('keeps absolute meta paths and resolves relative ones next to the index', () => {
    expect(resolveMetaUrl('/data/seoul/buildings/index.json', '/data/seoul/buildings/meta.json')).toBe(
      '/data/seoul/buildings/meta.json',
    );
    expect(resolveMetaUrl('/data/seoul/trees/index.json', 'meta.json')).toBe(
      '/data/seoul/trees/meta.json',
    );
    expect(resolveMetaUrl('/data/seoul/trees/index.json', null)).toBe(
      '/data/seoul/trees/meta.json',
    );
  });
});
import { hasCompleteCoverage } from '@/data/tileIndex';

describe('team sample coverage',()=>{
  it('requires the whole requested buffer inside a supplied coverage area',()=>{
    const index=parseTileIndex({tiles:[],coverageAreas:[[126.9,37.5,127.0,37.6]]});
    expect(hasCompleteCoverage(index,[126.92,37.52,126.98,37.58])).toBe(true);
    expect(hasCompleteCoverage(index,[126.89,37.52,126.98,37.58])).toBe(false);
    expect(hasCompleteCoverage(index,[127.2,37.5,127.3,37.6])).toBe(false);
  });
  it('does not constrain the full dataset but fails closed for an empty sample coverage list',()=>{
    expect(hasCompleteCoverage(parseTileIndex({tiles:[]}),[126.9,37.5,127,37.6])).toBe(true);
    expect(hasCompleteCoverage(parseTileIndex({tiles:[],coverageAreas:[]}),[126.9,37.5,127,37.6])).toBe(false);
  });
});
