import { describe, expect, it } from 'vitest';
import { fromEnu, metersPerDegree, toEnu } from '@/geo/enu';

const ILSAN = { lat0: 37.658, lon0: 126.832 };

describe('metersPerDegree', () => {
  it('returns Vincenty coefficients for 고양시 일산동구 (±1m)', () => {
    const { mPerDegLat, mPerDegLon } = metersPerDegree(37.658);
    expect(mPerDegLat).toBeGreaterThanOrEqual(110989.0);
    expect(mPerDegLat).toBeLessThanOrEqual(110991.0);
    expect(mPerDegLon).toBeGreaterThanOrEqual(88237.9);
    expect(mPerDegLon).toBeLessThanOrEqual(88239.9);
    expect(mPerDegLat).toBeCloseTo(110990.0, 0);
    expect(mPerDegLon).toBeCloseTo(88238.9, 0);
  });
});

describe('toEnu / fromEnu', () => {
  it('maps the origin to (0, 0)', () => {
    const p = toEnu(ILSAN.lon0, ILSAN.lat0, ILSAN);
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(0, 12);
  });

  it('round-trips ENU → WGS84 → ENU with error < 0.01m', () => {
    const samples = [
      { x: 0, y: 0 },
      { x: 250, y: -250 },
      { x: 750, y: 750 },
      { x: -1500, y: 20 },
      { x: 12.345, y: -0.001 },
    ];
    for (const p of samples) {
      const ll = fromEnu(p.x, p.y, ILSAN);
      const back = toEnu(ll.lon, ll.lat, ILSAN);
      const err = Math.hypot(back.x - p.x, back.y - p.y);
      expect(err).toBeLessThan(0.01);
    }
  });

  it('round-trips WGS84 → ENU → WGS84 with error < 0.01m', () => {
    const lon = 126.835;
    const lat = 37.661;
    const enu = toEnu(lon, lat, ILSAN);
    const back = fromEnu(enu.x, enu.y, ILSAN);
    const errEnu = toEnu(back.lon, back.lat, ILSAN);
    expect(Math.hypot(errEnu.x - enu.x, errEnu.y - enu.y)).toBeLessThan(0.01);
  });
});
