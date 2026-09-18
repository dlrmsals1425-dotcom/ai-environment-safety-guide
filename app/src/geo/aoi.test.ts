import { describe, expect, it } from 'vitest';
import {
  bboxCenter,
  bboxSizeMeters,
  bufferBboxMeters,
  DEFAULT_AOI_SIZE_M,
  isAoiOversized,
  MAX_AOI_SIZE_M,
  squareBboxAround,
} from '@/geo/aoi';

const ILSAN = { lat0: 37.658, lon0: 126.832 };

describe('AOI helpers', () => {
  it('squareBboxAround(500) is ~500m × 500m and centered on origin', () => {
    const bbox = squareBboxAround(ILSAN, DEFAULT_AOI_SIZE_M);
    const size = bboxSizeMeters(bbox);
    expect(size.width).toBeCloseTo(DEFAULT_AOI_SIZE_M, 6);
    expect(size.height).toBeCloseTo(DEFAULT_AOI_SIZE_M, 6);
    const c = bboxCenter(bbox);
    expect(c.lat0).toBeCloseTo(ILSAN.lat0, 10);
    expect(c.lon0).toBeCloseTo(ILSAN.lon0, 10);
  });

  it('rejects sizes above 1500m', () => {
    const ok = squareBboxAround(ILSAN, MAX_AOI_SIZE_M);
    const over = squareBboxAround(ILSAN, MAX_AOI_SIZE_M + 1);
    expect(isAoiOversized(ok)).toBe(false);
    expect(isAoiOversized(over)).toBe(true);
  });

  it('bufferBboxMeters expands the box by ~300m', () => {
    const bbox = squareBboxAround(ILSAN, 500);
    const buffered = bufferBboxMeters(bbox, 300);
    const size = bboxSizeMeters(buffered);
    expect(size.width).toBeCloseTo(1100, 0);
    expect(size.height).toBeCloseTo(1100, 0);
  });
});
