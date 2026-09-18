import { describe, expect, it } from 'vitest';
import {
  capFeatures,
  featureIntersectsBbox,
  normalizeBuildingFeature,
  normalizeBuildingProps,
  normalizeTreeFeature,
  normalizeTreeProps,
  parseFeatureCollection,
  SchemaError,
} from '@/data/seoulData';

describe('spatial filtering within a loaded tile', () => {
  it('keeps a building crossing the buffer edge without clipping its full geometry', () => {
    const feature = normalizeBuildingFeature({ geometry: { type: 'Polygon', coordinates: [
      [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]],
      [[0.5, 0.5], [0.5, 1], [1, 1], [1, 0.5], [0.5, 0.5]],
    ] }, properties: { id: 'crossing', height: 10, heightSource: 'measured' } }, 0)!;
    const original = JSON.stringify(feature.geometry);
    expect(featureIntersectsBbox(feature, [1.9, 1.9, 3, 3])).toBe(true);
    expect(featureIntersectsBbox(feature, [3, 3, 4, 4])).toBe(false);
    expect(JSON.stringify(feature.geometry)).toBe(original);
  });

  it('excludes unrelated tree points even when their source tile intersects the view', () => {
    const feature = normalizeTreeFeature({ geometry: { type: 'Point', coordinates: [127, 37.5] }, properties: {} }, 0)!;
    expect(featureIntersectsBbox(feature, [126.99, 37.49, 127.01, 37.51])).toBe(true);
    expect(featureIntersectsBbox(feature, [126.9, 37.4, 126.95, 37.45])).toBe(false);
  });
});

describe('normalizeBuildingProps', () => {
  it('keeps the prepared height and its raw source value', () => {
    const p = normalizeBuildingProps(
      {
        id: 'b1',
        sourceId: 'src-1',
        pnu: '1111',
        name: '가',
        address: '서울 성동구',
        useName: '단독주택',
        floors: 3,
        height: 9.4,
        heightSource: 'measured',
        heightRaw: 9.4,
        sourceDate: '2026-09-09',
      },
      'fallback',
    );
    expect(p).toEqual({
      id: 'b1',
      sourceId: 'src-1',
      pnu: '1111',
      name: '가',
      address: '서울 성동구',
      useName: '단독주택',
      floors: 3,
      height: 9.4,
      heightSource: 'measured',
      heightRaw: 9.4,
      sourceDate: '2026-09-09',
    });
  });

  it('respects a prepared tall height instead of clipping it', () => {
    const p = normalizeBuildingProps({ height: 555, heightSource: 'measured' }, 'f');
    expect(p.height).toBe(555);
    expect(p.heightSource).toBe('measured');
  });

  it('keeps a prepared estimated height without re-estimating', () => {
    const p = normalizeBuildingProps(
      { height: 33, heightSource: 'estimated', floors: 11, heightRaw: 99999 },
      'f',
    );
    expect(p.height).toBe(33);
    expect(p.heightSource).toBe('estimated');
    expect(p.heightRaw).toBe(99999);
  });

  it('never fills an unknown height, even when floors exist', () => {
    const p = normalizeBuildingProps(
      { id: 'b2', floors: 12, height: 0, heightSource: 'unknown', heightRaw: null },
      'f',
    );
    expect(p.height).toBe(0);
    expect(p.heightSource).toBe('unknown');
  });

  it('treats a non-positive or missing height as unknown', () => {
    expect(normalizeBuildingProps({ height: -5, heightSource: 'measured' }, 'f').height).toBe(0);
    expect(
      normalizeBuildingProps({ height: -5, heightSource: 'measured' }, 'f').heightSource,
    ).toBe('unknown');
    expect(normalizeBuildingProps({}, 'f').heightSource).toBe('unknown');
    expect(normalizeBuildingProps({}, 'f').id).toBe('f');
  });
});

describe('normalizeBuildingFeature', () => {
  it('accepts Polygon and MultiPolygon, rejects other geometry', () => {
    const poly = normalizeBuildingFeature(
      {
        type: 'Feature',
        properties: { height: 10, heightSource: 'measured' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[127, 37], [127.001, 37], [127.001, 37.001], [127, 37]]],
        },
      },
      0,
    );
    expect(poly?.geometry.type).toBe('Polygon');
    const multi = normalizeBuildingFeature(
      {
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[127, 37], [127.001, 37], [127.001, 37.001], [127, 37]]]],
        },
      },
      1,
    );
    expect(multi?.geometry.type).toBe('MultiPolygon');
    expect(
      normalizeBuildingFeature({ geometry: { type: 'Point', coordinates: [127, 37] } }, 2),
    ).toBeNull();
    expect(normalizeBuildingFeature({ geometry: { type: 'Polygon', coordinates: [] } }, 3)).toBeNull();
  });
});

describe('normalizeTreeProps', () => {
  it('keeps prepared measurements, raw values and the 2013 source year', () => {
    const p = normalizeTreeProps(
      {
        id: 't1',
        dataset: 'street',
        gu: '성동구',
        species: '은행나무',
        heightM: 8,
        crownWidthM: 5,
        rawHeight: 8,
        rawCrownWidth: 5,
        quality: 'valid',
        sourceYear: 2013,
      },
      'f',
    );
    expect(p.heightM).toBe(8);
    expect(p.crownWidthM).toBe(5);
    expect(p.quality).toBe('valid');
    expect(p.sourceYear).toBe(2013);
    expect(p.dataset).toBe('street');
  });

  it('keeps out-of-range values as null while preserving the raw numbers', () => {
    const p = normalizeTreeProps(
      { heightM: null, crownWidthM: null, rawHeight: 1911, rawCrownWidth: 0, quality: 'review' },
      'f',
    );
    expect(p.heightM).toBeNull();
    expect(p.crownWidthM).toBeNull();
    expect(p.rawHeight).toBe(1911);
    expect(p.rawCrownWidth).toBe(0);
    expect(p.quality).toBe('review');
  });

  it('defaults an unknown quality flag to review', () => {
    expect(normalizeTreeProps({ quality: 'weird' }, 'f').quality).toBe('review');
  });
});

describe('normalizeTreeFeature', () => {
  it('requires a finite Point geometry', () => {
    expect(
      normalizeTreeFeature({ geometry: { type: 'Point', coordinates: [127, 37.5] } }, 0),
    ).not.toBeNull();
    expect(
      normalizeTreeFeature({ geometry: { type: 'Point', coordinates: ['x', 37.5] } }, 1),
    ).toBeNull();
    expect(normalizeTreeFeature({ geometry: { type: 'Polygon', coordinates: [] } }, 2)).toBeNull();
  });
});

describe('parseFeatureCollection', () => {
  it('reports skipped features instead of dropping them silently', () => {
    const out = parseFeatureCollection(
      {
        type: 'FeatureCollection',
        features: [
          { geometry: { type: 'Point', coordinates: [127, 37.5] } },
          { geometry: { type: 'Polygon', coordinates: [] } },
        ],
      },
      normalizeTreeFeature,
    );
    expect(out.features).toHaveLength(1);
    expect(out.skipped).toBe(1);
  });

  it('throws a schema error when the tile is not a FeatureCollection', () => {
    expect(() => parseFeatureCollection({}, normalizeTreeFeature, '/t.geojson')).toThrow(
      SchemaError,
    );
  });
});

describe('capFeatures', () => {
  it('reports when the render cap truncates the list', () => {
    expect(capFeatures([1, 2, 3], 5)).toEqual({ shown: [1, 2, 3], capped: false });
    expect(capFeatures([1, 2, 3], 2)).toEqual({ shown: [1, 2], capped: true });
  });
});
