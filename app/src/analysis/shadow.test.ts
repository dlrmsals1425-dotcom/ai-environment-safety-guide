import { describe, expect, it } from 'vitest';
import analysisConfig from '../../config/analysis.json';
import { gridFromAoi } from '@/analysis/grid';
import {
  isSunlit,
  rasterizeShadow,
  sampleAgreement,
  shadowLengthNorthMeters,
  sunHoursGrid,
} from '@/analysis/shadow';
import { daylightSunSamples } from '@/analysis/times';
import { squareBboxAround } from '@/geo/aoi';
import { SpatialIndex } from '@/geo/spatialIndex';
import { findSolarNoon } from '@/solar/sunVector';
import type { Building } from '@/types/building';

const ORIGIN = { lat0: 37.658, lon0: 126.832 };

function squareBuilding(id: string, half: number, height: number): Building {
  const ring = new Float64Array([
    -half, -half, half, -half, half, half, -half, half,
  ]);
  return {
    id,
    ring,
    baseZ: 0,
    height,
    heightSource: 'synthetic',
    minX: -half,
    minY: -half,
    maxX: half,
    maxY: half,
    lngLatPolygon: [],
  };
}

describe('shadow engine', () => {
  it('GT-3 solar-noon shadow length north of a 10m building', () => {
    const b = squareBuilding('g', 5, 10);
    const buildings = [b];
    const index = new SpatialIndex(buildings, 50);
    const cases = [
      { d: new Date(2026, 2, 20), expect: 7.72 },
      { d: new Date(2026, 5, 21), expect: 2.53 },
      { d: new Date(2026, 11, 21), expect: 18.11 },
    ];
    for (const c of cases) {
      const { sun } = findSolarNoon(c.d, ORIGIN.lat0, ORIGIN.lon0);
      const len = shadowLengthNorthMeters(b, sun.S, index, buildings, 40);
      expect(Math.abs(len - c.expect) / c.expect).toBeLessThanOrEqual(0.02);
    }
  });

  it('GT-8 night samples add no sun hours', () => {
    const b = squareBuilding('g', 5, 10);
    const buildings = [b];
    const index = new SpatialIndex(buildings, 50);
    const bbox = squareBboxAround(ORIGIN, 80);
    const spec = gridFromAoi(bbox, ORIGIN, 4);
    const night = { S: { x: 0, y: 0.2, z: -0.3 }, alt: -0.2 };
    const hours = sunHoursGrid({
      buildings,
      index,
      spec,
      times: [night, night],
      z0: 0,
      minAltDeg: 0,
      stepMinutes: 10,
    });
    for (let i = 0; i < hours.length; i++) expect(hours[i]).toBe(0);
  });

  it('GT-9 z0=5m ignores a 4m building', () => {
    const b = squareBuilding('low', 5, 4);
    const spec = gridFromAoi(squareBboxAround(ORIGIN, 80), ORIGIN, 4);
    const mask = new Uint8Array(spec.nx * spec.ny);
    const { sun } = findSolarNoon(new Date(2026, 2, 20), ORIGIN.lat0, ORIGIN.lon0);
    rasterizeShadow(b, sun.S, sun.alt, 5, mask, spec);
    expect(mask.every((v) => v === 0)).toBe(true);
    const index = new SpatialIndex([b], 50);
    expect(
      isSunlit({ x: 0, y: 20, z: 5 }, sun.S, [b], index),
    ).toBe(true);
  });

  it('GT-5 Method A vs B agreement ≥ 98% on 500 samples', () => {
    const buildings = [
      squareBuilding('a', 8, 12),
      squareBuilding('b', 6, 8),
    ];
    buildings[1] = {
      ...buildings[1],
      id: 'b',
      minX: 20,
      maxX: 32,
      minY: -6,
      maxY: 6,
      ring: new Float64Array([20, -6, 32, -6, 32, 6, 20, 6]),
    };
    const index = new SpatialIndex(buildings, 50);
    const bbox = squareBboxAround(ORIGIN, 80);
    const spec = gridFromAoi(bbox, ORIGIN, 4);
    const date = new Date(2026, 2, 20);
    const times = daylightSunSamples(
      date,
      ORIGIN.lat0,
      ORIGIN.lon0,
      analysisConfig.stepMinutes,
    );
    const hours = sunHoursGrid({
      buildings,
      index,
      spec,
      times: times.map((t) => ({ S: t.S, alt: t.alt })),
      z0: 0,
      minAltDeg: 0,
      stepMinutes: analysisConfig.stepMinutes,
    });
    const ratio = sampleAgreement(
      hours,
      spec,
      buildings,
      index,
      times.map((t) => ({ S: t.S, alt: t.alt })),
      0,
      0,
      analysisConfig.stepMinutes,
      500,
    );
    expect(ratio).toBeGreaterThanOrEqual(0.98);
  });

  it('courtyard hole is sunlit while inner-wall shadow and other buildings still occlude', () => {
    const outer = new Float64Array([-10, -10, 10, -10, 10, 10, -10, 10]);
    const hole = new Float64Array([-5, -5, -5, 5, 5, 5, 5, -5]);
    const courtyard: Building = {
      id: 'courtyard',
      ring: outer,
      holes: [hole],
      baseZ: 0,
      height: 2,
      heightSource: 'synthetic',
      minX: -10,
      minY: -10,
      maxX: 10,
      maxY: 10,
      lngLatPolygon: [],
    };
    const S = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
    const alt = Math.PI / 4;
    const index = new SpatialIndex([courtyard], 50);

    expect(isSunlit({ x: 0, y: 0, z: 0 }, S, [courtyard], index)).toBe(true);

    const open = new Uint8Array(1);
    rasterizeShadow(courtyard, S, alt, 0, open, {
      originX: -0.5,
      originY: -0.5,
      cellSize: 1,
      nx: 1,
      ny: 1,
    });
    expect(open[0]).toBe(0);

    expect(isSunlit({ x: 0, y: -4, z: 0 }, S, [courtyard], index)).toBe(false);
    const inner = new Uint8Array(1);
    rasterizeShadow(courtyard, S, alt, 0, inner, {
      originX: -0.5,
      originY: -4.5,
      cellSize: 1,
      nx: 1,
      ny: 1,
    });
    expect(inner[0]).toBe(1);

    const block = squareBuilding('in-court', 1, 10);
    const both = [courtyard, block];
    const index2 = new SpatialIndex(both, 50);
    expect(isSunlit({ x: 0, y: 0, z: 0 }, S, both, index2)).toBe(false);
  });

  it('zenith ray inside a solid 2m building is blocked', () => {
    const b = squareBuilding('solid', 10, 2);
    const index = new SpatialIndex([b], 50);
    const S = { x: 0, y: 0, z: 1 };
    expect(isSunlit({ x: 0, y: 0, z: 0 }, S, [b], index)).toBe(false);
    expect(isSunlit({ x: 0, y: 0, z: 2 }, S, [b], index)).toBe(true);
    expect(isSunlit({ x: 20, y: 0, z: 0 }, S, [b], index)).toBe(true);
    const mask = new Uint8Array(1);
    rasterizeShadow(b, S, Math.PI / 2, 0, mask, {
      originX: -0.5,
      originY: -0.5,
      cellSize: 1,
      nx: 1,
      ny: 1,
    });
    expect(mask[0]).toBe(1);
  });

  it('diagonal ray through a building vertex is occluded at independent expected values', () => {
    const b = squareBuilding('solid', 10, 2);
    const index = new SpatialIndex([b], 50);
    const throughVertex = { x: -1, y: -1, z: 0.01 };
    expect(isSunlit({ x: 20, y: 20, z: 0 }, throughVertex, [b], index)).toBe(false);

    const throughEdge = { x: -1, y: 0, z: 0.01 };
    expect(isSunlit({ x: 20, y: 0, z: 0 }, throughEdge, [b], index)).toBe(false);
    expect(isSunlit({ x: 20, y: 20, z: 0 }, throughEdge, [b], index)).toBe(true);

    const mask = new Uint8Array(1);
    rasterizeShadow(b, throughVertex, Math.atan2(0.01, Math.SQRT2), 0, mask, {
      originX: 19.5,
      originY: 19.5,
      cellSize: 1,
      nx: 1,
      ny: 1,
    });
    expect(mask[0]).toBe(1);
  });

  it('zenith ray in a courtyard hole is sunlit', () => {
    const courtyard: Building = {
      id: 'courtyard',
      ring: new Float64Array([-10, -10, 10, -10, 10, 10, -10, 10]),
      holes: [new Float64Array([-5, -5, -5, 5, 5, 5, 5, -5])],
      baseZ: 0,
      height: 2,
      heightSource: 'synthetic',
      minX: -10,
      minY: -10,
      maxX: 10,
      maxY: 10,
      lngLatPolygon: [],
    };
    const S = { x: 0, y: 0, z: 1 };
    const index = new SpatialIndex([courtyard], 50);
    expect(isSunlit({ x: 0, y: 0, z: 0 }, S, [courtyard], index)).toBe(true);
  });
});
