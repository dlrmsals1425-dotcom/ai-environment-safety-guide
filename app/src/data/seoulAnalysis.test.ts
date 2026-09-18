import { describe, expect, it } from 'vitest';
import { toAnalysisBuildings, toFeatureCollection } from '@/data/seoulAnalysis';
import type { SeoulBuildingFeature } from '@/types/seoul';

const origin = { lat0: 37.5445, lon0: 127.0374 };

function squareFeature(
  id: string,
  height: number,
  heightSource: 'measured' | 'estimated' | 'unknown',
): SeoulBuildingFeature {
  return {
    type: 'Feature',
    properties: {
      id,
      sourceId: null,
      pnu: null,
      name: null,
      address: null,
      useName: null,
      floors: null,
      height,
      heightSource,
      heightRaw: null,
      sourceDate: null,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [127.0374, 37.5445],
          [127.0376, 37.5445],
          [127.0376, 37.5447],
          [127.0374, 37.5447],
          [127.0374, 37.5445],
        ],
      ],
    },
  };
}

describe('toAnalysisBuildings', () => {
  it('converts positive-height buildings into ENU geometry', () => {
    const { buildings, excludedUnknownHeight } = toAnalysisBuildings(
      [squareFeature('b1', 12, 'measured')],
      origin,
    );
    expect(excludedUnknownHeight).toBe(0);
    expect(buildings).toHaveLength(1);
    expect(buildings[0].height).toBe(12);
    expect(buildings[0].heightSource).toBe('measured');
    expect(buildings[0].ring.length).toBe(8);
    expect(buildings[0].maxX).toBeGreaterThan(buildings[0].minX);
    expect(buildings[0].lngLatPolygon[0][0]).toEqual([127.0374, 37.5445, 0]);
  });

  it('uses the same elevated foundation for rendering and shadow prisms', () => {
    const ground = {width:2,height:2,west:127.03,north:37.55,step:0.02,
      values:new Float32Array([145,145,145,145])};
    const {buildings} = toAnalysisBuildings([squareFeature('hill-house',12,'measured')],origin,ground);
    expect(buildings[0].baseZ).toBe(145);
    expect(buildings[0].height).toBe(12);
    expect(buildings[0].lngLatPolygon.flat().every((p) => p[2] === 145)).toBe(true);
  });

  it('excludes unknown-height buildings instead of estimating them', () => {
    const { buildings, excludedUnknownHeight } = toAnalysisBuildings(
      [squareFeature('b1', 12, 'measured'), squareFeature('b2', 0, 'unknown')],
      origin,
    );
    expect(buildings.map((b) => b.id)).toEqual(['b1']);
    expect(excludedUnknownHeight).toBe(1);
  });

  it('splits MultiPolygon parts with suffixed ids', () => {
    const base = squareFeature('m1', 9, 'estimated');
    const multi: SeoulBuildingFeature = {
      ...base,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          (base.geometry as { coordinates: number[][][] }).coordinates,
          (base.geometry as { coordinates: number[][][] }).coordinates,
        ],
      },
    };
    const { buildings } = toAnalysisBuildings([multi], origin);
    expect(buildings.map((b) => b.id)).toEqual(['m1-0', 'm1-1']);
  });
});

describe('toFeatureCollection', () => {
  it('wraps features without touching their properties', () => {
    const f = squareFeature('b1', 12, 'measured');
    const fc = toFeatureCollection([f]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features[0].properties).toBe(f.properties);
  });
});
