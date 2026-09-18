import { describe, expect, it } from 'vitest';
import { intersectRaySolid2D, pointInSolid } from '@/analysis/rayPolygon';

const square = new Float64Array([-10, -10, 10, -10, 10, 10, -10, 10]);
const hole = new Float64Array([-5, -5, -5, 5, 5, 5, 5, -5]);

describe('intersectRaySolid2D', () => {
  it('hits a square through the far vertex even when both edges share the same t', () => {
    const hit = intersectRaySolid2D(20, 20, -1, -1, square);
    expect(hit).not.toBeNull();
    expect(hit!.tIn).toBeCloseTo(10 * Math.SQRT2, 6);
    expect(hit!.tOut).toBeCloseTo(30 * Math.SQRT2, 6);
    expect(pointInSolid(20 - 1e-4, 20 - 1e-4, square)).toBe(false);
    expect(pointInSolid(10 - 1e-4, 10 - 1e-4, square)).toBe(true);
  });

  it('does not enter when the ray only grazes a vertex', () => {
    const hit = intersectRaySolid2D(20, 5, -10, 5, square);
    expect(hit).toBeNull();
  });

  it('hits the interior of an edge', () => {
    const hit = intersectRaySolid2D(20, 0, -1, 0, square);
    expect(hit).not.toBeNull();
    expect(hit!.tIn).toBeCloseTo(10, 6);
    expect(hit!.tOut).toBeCloseTo(30, 6);
  });

  it('enters courtyard solid at the inner wall, not the filled hole', () => {
    expect(pointInSolid(0, 0, square, [hole])).toBe(false);
    const hit = intersectRaySolid2D(0, 0, 0, -1, square, [hole]);
    expect(hit).not.toBeNull();
    expect(hit!.tIn).toBeCloseTo(5, 6);
    expect(hit!.tOut).toBeCloseTo(10, 6);
  });
});
