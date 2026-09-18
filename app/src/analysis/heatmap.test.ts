import { describe, expect, it } from 'vitest';
import { sunHoursImageCoordinates, sunHoursToRgba } from '@/analysis/heatmap';
import type { GridSpec } from '@/analysis/grid';

describe('sunHoursToRgba', () => {
  it('increases luminance from 0h to max', () => {
    const spec: GridSpec = { originX: 0, originY: 0, cellSize: 4, nx: 2, ny: 1 };
    const hours = new Float32Array([0, 8]);
    const rgba = sunHoursToRgba(hours, spec, 8);
    const lum0 = rgba[0] + rgba[1] + rgba[2];
    const lum1 = rgba[4] + rgba[5] + rgba[6];
    expect(lum1).toBeGreaterThan(lum0);
  });

  it('places the northern row at canvas top when northUp so Bitmap/Map image is not flipped', () => {
    const spec: GridSpec = { originX: 0, originY: 0, cellSize: 4, nx: 1, ny: 2 };
    const hours = new Float32Array([1, 8]);
    const raw = sunHoursToRgba(hours, spec, 8, false);
    const display = sunHoursToRgba(hours, spec, 8, true);
    const lum = (buf: Uint8ClampedArray, row: number) =>
      buf[row * 4] + buf[row * 4 + 1] + buf[row * 4 + 2];
    expect(lum(raw, 0)).toBeLessThan(lum(raw, 1));
    expect(lum(display, 0)).toBeGreaterThan(lum(display, 1));
    expect(lum(display, 0)).toBe(lum(raw, 1));
    expect(lum(display, 1)).toBe(lum(raw, 0));
  });

  it('orders image coordinates NW, NE, SE, SW', () => {
    expect(sunHoursImageCoordinates([126.8, 37.6, 126.9, 37.7])).toEqual([
      [126.8, 37.7],
      [126.9, 37.7],
      [126.9, 37.6],
      [126.8, 37.6],
    ]);
  });
});
