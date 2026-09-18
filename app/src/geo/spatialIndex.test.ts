import { describe, expect, it } from 'vitest';
import { SpatialIndex } from '@/geo/spatialIndex';
import type { Building } from '@/types/building';

function box(
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Building {
  return {
    id,
    ring: new Float64Array([minX, minY, maxX, minY, maxX, maxY, minX, maxY]),
    baseZ: 0,
    height: 10,
    heightSource: 'synthetic',
    minX,
    minY,
    maxX,
    maxY,
    lngLatPolygon: [],
  };
}

function indexCovering() {
  return new SpatialIndex(
    [
      box('a', -10, -10, 10, 10),
      box('b', 40, -10, 60, 10),
      box('c', 90, -10, 110, 10),
      box('d', -10, 40, 10, 60),
    ],
    50,
  );
}

describe('SpatialIndex DDA', () => {
  it('east 100m ray visits x-monotonic unique buckets', () => {
    const idx = indexCovering();
    const cells = [...idx.traverseRay({ x: 0, y: 0 }, { x: 1, y: 0 }, 100)];
    expect(cells.length).toBeGreaterThan(0);
    const xs = cells.map((c) => c.ix);
    const keys = cells.map((c) => `${c.ix},${c.iy}`);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect(xs[xs.length - 1]).toBeGreaterThan(xs[0]);
  });

  it('west (negative) ray is x-monotonic decreasing without duplicates', () => {
    const idx = indexCovering();
    const cells = [...idx.traverseRay({ x: 100, y: 0 }, { x: -1, y: 0 }, 100)];
    const xs = cells.map((c) => c.ix);
    const keys = cells.map((c) => `${c.ix},${c.iy}`);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeLessThanOrEqual(xs[i - 1]);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('north axis-parallel ray is y-monotonic increasing', () => {
    const idx = indexCovering();
    const cells = [...idx.traverseRay({ x: 0, y: 0 }, { x: 0, y: 1 }, 80)];
    const ys = cells.map((c) => c.iy);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1]);
    }
    expect(new Set(cells.map((c) => `${c.ix},${c.iy}`)).size).toBe(cells.length);
  });

  it('south axis-parallel ray is y-monotonic decreasing', () => {
    const idx = indexCovering();
    const cells = [...idx.traverseRay({ x: 0, y: 50 }, { x: 0, y: -1 }, 80)];
    const ys = cells.map((c) => c.iy);
    expect(cells.length).toBeGreaterThan(0);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
    }
    expect(new Set(cells.map((c) => `${c.ix},${c.iy}`)).size).toBe(cells.length);
  });

  it('zero-length direction yields the start cell once and terminates', () => {
    const idx = indexCovering();
    const cells = [...idx.traverseRay({ x: 0, y: 0 }, { x: 0, y: 0 }, 100)];
    expect(cells).toHaveLength(1);
    expect(cells[0]).toEqual(idx.worldToCell(0, 0));
  });

  it('starting on a grid boundary does not skip or duplicate', () => {
    const idx = indexCovering();
    const start = { x: idx.originX + idx.cellSize, y: 0 };
    const cells = [...idx.traverseRay(start, { x: 1, y: 0 }, 50)];
    const keys = cells.map((c) => `${c.ix},${c.iy}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(cells.length).toBeGreaterThan(0);
  });
});
